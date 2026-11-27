// backend/functions/src/bg-payments.ts
//
// Transactional payment mutations for estimate entries.
//
// Previously, payments were edited by rewriting the ENTIRE estimate `details`
// blob from the client's last-loaded state on every save. Two tabs/users
// adding payments concurrently would silently drop one of them
// (last-writer-wins). This callable instead mutates ONLY the
// `details.payments` array inside a single Firestore transaction, so
// concurrent writers serialize instead of clobbering each other. It also
// enforces server-side invariants the old path never had: unique payment ids,
// positive amounts, no editing voided payments, and no overpaying the
// estimate total.
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { randomUUID } from 'crypto';
import * as z from 'zod';
import { JOURNAL_COLLECTION } from './common/const';
import { ENTRY_CONFIG } from './common/schemas/configmap';
import {
  paymentSchema,
} from './common/schemas/estimate_schema';
import {
  docIdSchema,
  firestoreDateSchema,
} from './common/schemas/common_schemas';
import {
  computeGrandTotal,
  totalPaidFor,
  MONEY_EPSILON,
} from './common/payment-math';
import { createAuditedCallable } from './helpers/audited-function';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// New payments: the server assigns id/createdAt/createdBy; the client must not.
const newPaymentInputSchema = paymentSchema.omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
  isDeleted: true,
});

const paymentPatchSchema = z
  .object({
    id: z.string().min(1),
    amount: z
      .number()
      .finite()
      .positive('Payment amount must be positive.')
      .optional(),
    date: firestoreDateSchema.optional(),
    method: z.string().max(60).optional().nullable(),
    transactionId: z.string().max(120).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();

const mutatePaymentsSchema = z
  .object({
    jid: docIdSchema,
    entryId: docIdSchema,
    add: z.array(newPaymentInputSchema).max(50).optional(),
    update: z.array(paymentPatchSchema).max(50).optional(),
    void: z.array(z.string().min(1)).max(50).optional(),
    restore: z.array(z.string().min(1)).max(50).optional(),
  })
  .strict()
  .refine(
    (d) =>
      (d.add?.length ?? 0) +
        (d.update?.length ?? 0) +
        (d.void?.length ?? 0) +
        (d.restore?.length ?? 0) >
      0,
    { message: 'At least one payment operation is required.' },
  );

type PaymentRecord = Record<string, unknown>;

/** Normalizes Firestore Timestamps/Dates/numbers/ISO strings to millis for the callable response. */
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'object' &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Strips keys whose value is undefined so Firestore never rejects optional fields. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/** Normalizes Firestore Timestamps/Dates to millis for the callable response. */
function paymentToMillis(payment: PaymentRecord): PaymentRecord {
  const out: PaymentRecord = { ...payment };
  for (const key of ['date', 'createdAt', 'updatedAt', 'deletedAt']) {
    if (key in out) out[key] = toMillis(out[key]);
  }
  return out;
}

export type PaymentMutationOps = {
  add?: z.infer<typeof newPaymentInputSchema>[];
  update?: z.infer<typeof paymentPatchSchema>[];
  voidIds?: string[];
  restoreIds?: string[];
};

/**
 * Applies payment mutations (add/update/void/restore) and validates invariants.
 * Uses a concrete Firestore Timestamp (never FieldValue.serverTimestamp(), which
 * Firestore rejects inside arrays). Exported for unit tests.
 */
export function applyPaymentMutations(
  details: Record<string, unknown>,
  ops: PaymentMutationOps,
  uid: string,
  paymentNow: Timestamp = Timestamp.now(),
): PaymentRecord[] {
  const {
    add = [],
    update = [],
    voidIds = [],
    restoreIds = [],
  } = ops;

  // Backfill missing IDs on legacy payments so pre-migration estimates do not fail
  // uniqueness validation when new payment mutations are applied.
  const payments: PaymentRecord[] = Array.isArray(details.payments) ?
    (details.payments as PaymentRecord[]).map((p) => ({
      ...p,
      id: typeof p.id === 'string' && p.id.trim() ? p.id : randomUUID(),
    })) :
    [];
  const byId = new Map<string, PaymentRecord>(
    payments.map((p) => [String(p.id), p]),
  );

  // --- ADD: server assigns id + audit fields; client input already zod-validated ---
  for (const input of add) {
    const id = randomUUID();
    const created: PaymentRecord = {
      ...stripUndefined(input as Record<string, unknown>),
      id,
      createdAt: paymentNow,
      createdBy: uid,
      updatedAt: paymentNow,
      updatedBy: uid,
      isDeleted: false,
    };
    payments.push(created);
    byId.set(id, created);
  }

  // --- UPDATE: patch allowed fields on live payments ---
  for (const patch of update) {
    const target = byId.get(patch.id);
    if (!target) {
      throw new HttpsError(
        'invalid-argument',
        `Payment ${patch.id} not found.`,
      );
    }
    if (target.isDeleted || target.deletedAt) {
      throw new HttpsError(
        'failed-precondition',
        `Payment ${patch.id} is voided and cannot be edited. Restore it first.`,
      );
    }
    // patch.id already equals target.id (we looked it up by id), so
    // assigning the stripped patch is safe.
    Object.assign(target, stripUndefined(patch as Record<string, unknown>), {
      updatedAt: paymentNow,
      updatedBy: uid,
    });
  }

  // --- VOID: soft-delete ---
  for (const pid of voidIds) {
    const target = byId.get(pid);
    if (!target) {
      throw new HttpsError(
        'invalid-argument',
        `Payment ${pid} not found.`,
      );
    }
    if (target.isDeleted || target.deletedAt) {
      throw new HttpsError(
        'failed-precondition',
        `Payment ${pid} is already voided.`,
      );
    }
    Object.assign(target, {
      isDeleted: true,
      deletedAt: paymentNow,
      deletedBy: uid,
      updatedAt: paymentNow,
      updatedBy: uid,
    });
  }

  // --- RESTORE: un-void ---
  for (const pid of restoreIds) {
    const target = byId.get(pid);
    if (!target) {
      throw new HttpsError(
        'invalid-argument',
        `Payment ${pid} not found.`,
      );
    }
    if (!target.isDeleted && !target.deletedAt) {
      throw new HttpsError(
        'failed-precondition',
        `Payment ${pid} is not voided.`,
      );
    }
    Object.assign(target, {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedAt: paymentNow,
      updatedBy: uid,
    });
  }

  // --- Invariants across the whole array ---
  const seen = new Set<string>();
  for (const p of payments) {
    if (!p.id || seen.has(String(p.id))) {
      throw new HttpsError(
        'invalid-argument',
        'Duplicate payment id detected.',
      );
    }
    seen.add(String(p.id));
    if (
      typeof p.amount !== 'number' ||
      !Number.isFinite(p.amount) ||
      !(p.amount > 0)
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Payment amounts must be positive finite numbers.',
      );
    }
  }
  const grandTotal = computeGrandTotal(details);
  const paid = totalPaidFor(payments);
  if (paid - grandTotal > MONEY_EPSILON) {
    throw new HttpsError(
      'failed-precondition',
      `Payments (${paid.toFixed(2)}) would exceed the estimate total (${grandTotal.toFixed(2)}).`,
    );
  }

  return payments;
}

export const mutatePayments = createAuditedCallable(
  'mutatePayments',
  JOURNAL_COLLECTION,
  [], // Custom role check below (estimate entry writers)
  mutatePaymentsSchema,
  async (request) => {
    const uid = request.auth!.uid;
    // request.data is already parsed through mutatePaymentsSchema by createAuditedCallable
    const {
      jid: journalId,
      entryId,
      add = [],
      update = [],
      void: voidIds = [],
      restore: restoreIds = [],
    } = request.data;

    const { allowedRoles, subcollection } = ENTRY_CONFIG.estimate;
    const entryRef = db
      .collection(JOURNAL_COLLECTION)
      .doc(journalId)
      .collection(subcollection)
      .doc(entryId);

    await db.runTransaction(async (tx) => {
      // --- Authorization: must be able to write estimate entries ---
      const journalSnap = await tx.get(
        db.collection(JOURNAL_COLLECTION).doc(journalId),
      );
      const journalData = journalSnap.data();
      const role = journalData?.access?.[uid]?.role;
      if (
        !journalSnap.exists ||
        journalData?.isActive === false ||
        !role ||
        !allowedRoles.includes(role)
      ) {
        throw new HttpsError(
          'permission-denied',
          'You do not have permission to modify payments on this estimate.',
        );
      }

      const entrySnap = await tx.get(entryRef);
      if (!entrySnap.exists) {
        throw new HttpsError('not-found', 'Estimate entry not found.');
      }
      const entryData = entrySnap.data() ?? {};
      if (entryData.isActive === false) {
        throw new HttpsError(
          'failed-precondition',
          'This estimate was deleted.',
        );
      }

      const details = (entryData.details ?? {}) as Record<string, unknown>;
      // Firestore forbids FieldValue.serverTimestamp() inside arrays, so use
      // concrete Timestamp.now() for per-payment audit fields and keep
      // FieldValue.serverTimestamp() for the top-level document updatedAt.
      const payments = applyPaymentMutations(
        details,
        { add, update, voidIds, restoreIds },
        uid,
        Timestamp.now(),
      );

      // Only the payments array (and updatedAt) is touched — concurrent edits
      // to other estimate fields no longer clobber payments and vice versa.
      tx.update(entryRef, {
        'details.payments': payments,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });

    // Read back canonical state so the client can sync without refetching.
    const snap = await entryRef.get();
    const snapData = snap.data() ?? {};
    const outPayments = (
      (snapData.details?.payments ?? []) as PaymentRecord[]
    ).map(paymentToMillis);

    logger.info(
      `mutatePayments: journal ${journalId} entry ${entryId} by ${uid} ` +
        `(+${add.length}/~${update.length}/-${voidIds.length}/R${restoreIds.length})`,
    );

    return {
      id: journalId,
      response: {
        payments: outPayments,
        updatedAtMillis: toMillis(snapData.updatedAt),
      },
    };
  },
);
