import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { z } from 'zod';
import { ROLES } from '../common/schemas/common_schemas';
import { ALLOWED_ORIGINS } from '../lib/bg-consts';

type AuditedCallableOptions = {
  isCreateOperation?: boolean;
};

/**
 * Keys whose values must never be written to the audit log verbatim.
 * thumbnailBase64 can be hundreds of KB of image data — persisting it in the
 * `events` subcollection wastes storage and can exceed Firestore's 1 MiB
 * document limit, which would fail the audit write *after* the entry was
 * already created (surfacing a phantom error and inviting duplicate retries).
 */
const AUDIT_STRIPPED_KEYS = new Set(['thumbnailBase64', 'thumbnail']);

/** Cap for the serialized audit payload; anything larger is truncated. */
const MAX_AUDIT_JSON_BYTES = 8192;

/**
 * Returns a logging-safe copy of the callable input: strips
 * large/binary-ish fields, truncates long strings, and caps total size.
 * Exported for unit tests.
 */
export function sanitizeAuditInput(data: unknown): unknown {
  const seen = new WeakSet<object>();

  const clean = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      return value.length > 2000 ?
        value.slice(0, 2000) + `…[truncated ${value.length} chars]` :
        value;
    }
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map(clean);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (AUDIT_STRIPPED_KEYS.has(key)) {
        const size =
          typeof val === 'string' ? `${val.length} chars` : typeof val;
        out[key] = `[stripped from audit log (${size})]`;
        continue;
      }
      out[key] = clean(val);
    }
    return out;
  };

  const cleaned = clean(data);
  let json: string;
  try {
    json = JSON.stringify(cleaned);
  } catch {
    return { _auditNote: 'input was not JSON-serializable' };
  }
  if (json.length > MAX_AUDIT_JSON_BYTES) {
    return {
      _auditNote: `input truncated to ${MAX_AUDIT_JSON_BYTES} chars (was ${json.length})`,
      preview: json.slice(0, MAX_AUDIT_JSON_BYTES),
    };
  }
  return cleaned;
}

export const createAuditedCallable = <T extends z.ZodType>(
  functionName: string,
  collectionName: string,
  allowedRoles: readonly (typeof ROLES)[number][] | (typeof ROLES)[number][],
  inputSchema: T,
  handler: (request: functions.https.CallableRequest) => Promise<any>,
  options: AuditedCallableOptions = {},
) => {
  return functions.https.onCall({
    cors: ALLOWED_ORIGINS,
    enforceAppCheck: true,
  }, async (request) => {
    const db = getFirestore();
    // 1. Authentication Check
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in.',
      );
    }

    // 2. Input Validation
    const validationResult = inputSchema.safeParse(request.data);
    if (!validationResult.success) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid data provided.',
        validationResult.error.flatten(),
      );
    }

    const data = validationResult.data as any;
    const baseId = data.jid;

    // If allowedRoles is not empty, we require a baseId and role check.
    if (allowedRoles.length > 0 && !options.isCreateOperation) {
      if (!baseId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Journal ID is required for this operation.',
        );
      }

      const journalRef = db.collection(collectionName).doc(baseId);
      const journalDoc = await journalRef.get();

      if (!journalDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Journal not found.',
        );
      }

      // 3. Authorization (RBAC) Check
      const journalData = journalDoc.data();
      if (journalData?.isActive === false) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'This journal is not active.',
        );
      }
      const userRole = journalData?.access?.[request.auth.uid]?.role;
      const isAuthorized = userRole && allowedRoles.includes(userRole);
      if (!isAuthorized) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to perform this action.',
        );
      }
    }

    // 4. Execute Core Logic
    const { id, response } = await handler(request);

    // 5. Log Audit Event for non-creation functions.
    // Best-effort: the audit write must never fail the user's operation
    // (it runs after the handler already committed its changes).
    if (id) {
      try {
        const docRef = db.collection(collectionName).doc(id);
        const eventRef = docRef.collection('events').doc();
        await eventRef.set({
          type: `FUNCTION_CALL_${functionName.toUpperCase()}`,
          userId: request.auth.uid,
          timestamp: FieldValue.serverTimestamp(),
          details: { input: sanitizeAuditInput(request.data) },
        });
      } catch (auditError) {
        logger.warn(
          `Audit log write failed for ${functionName}; user operation already committed.`,
          auditError,
        );
      }
    }

    return response;
  });
};
