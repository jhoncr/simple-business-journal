import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import * as logger from 'firebase-functions/logger';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Checks whether any template fields mirrored into `fast-cache/templates` changed.
 */
function hasCachedFieldsChanged(
  beforeData: FirebaseFirestore.DocumentData | undefined,
  afterData: FirebaseFirestore.DocumentData | undefined,
): boolean {
  if (!beforeData || !afterData) return true;
  const beforeDetails = (beforeData.details ?? {}) as Record<string, unknown>;
  const afterDetails = (afterData.details ?? {}) as Record<string, unknown>;
  return (
    beforeData.name !== afterData.name ||
    beforeData.isActive !== afterData.isActive ||
    beforeDetails.description !== afterDetails.description ||
    beforeDetails.thumbnailUrl !== afterDetails.thumbnailUrl
  );
}

export const onTemplateWritten = onDocumentWritten(
  {
    document: 'journals/{journalId}/templates/{templateId}',
    retry: true,
  },
  async (event) => {
    const { journalId, templateId } = event.params;

    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;

    // Skip cache write when none of the cached fields changed between before and after
    if (
      beforeExists &&
      afterExists &&
      !hasCachedFieldsChanged(event.data?.before.data(), event.data?.after.data())
    ) {
      return;
    }

    const templateDocRef = db.doc(
      `journals/${journalId}/templates/${templateId}`,
    );
    const cacheDocRef = db.doc(`journals/${journalId}/fast-cache/templates`);

    // Read canonical template state inside a transaction so out-of-order / retried
    // trigger events can never overwrite newer cache state with stale snapshots.
    await db.runTransaction(async (transaction) => {
      const canonicalSnap = await transaction.get(templateDocRef);

      if (!canonicalSnap.exists) {
        logger.info(`Template ${templateId} deleted. Removing from cache...`);
        transaction.set(
          cacheDocRef,
          { [templateId]: FieldValue.delete() },
          { merge: true },
        );
        return;
      }

      const data = canonicalSnap.data();
      if (!data || data.isActive === false) {
        logger.info(
          `Template ${templateId} is inactive. Removing from cache...`,
        );
        transaction.set(
          cacheDocRef,
          { [templateId]: FieldValue.delete() },
          { merge: true },
        );
        return;
      }

      const name = typeof data.name === 'string' && data.name ?
        data.name :
        'Untitled Template';
      const details = (data.details ?? {}) as Record<string, unknown>;
      let description =
        typeof details.description === 'string' ? details.description : '';
      if (description.length > 200) {
        description = description.substring(0, 200);
      }
      const thumbnailUrl =
        typeof details.thumbnailUrl === 'string' ? details.thumbnailUrl : '';

      const cacheEntry: Record<string, string | FieldValue> = {
        n: name,
        d: description || FieldValue.delete(),
        t: thumbnailUrl || FieldValue.delete(),
      };

      logger.info(`Updating cache for template ${templateId}`);
      transaction.set(
        cacheDocRef,
        { [templateId]: cacheEntry },
        { merge: true },
      );
    });
  },
);
