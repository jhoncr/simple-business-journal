import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import * as logger from 'firebase-functions/logger';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const onTemplateWritten = onDocumentWritten(
  'journals/{journalId}/templates/{templateId}',
  async (event) => {
    const { journalId, templateId } = event.params;
    const cacheDocRef = db.doc(`journals/${journalId}/fast-cache/templates`);

    // If the document was deleted
    if (!event.data?.after.exists) {
      logger.info(`Template ${templateId} deleted. Removing from cache...`);
      await cacheDocRef.set(
        { [templateId]: FieldValue.delete() },
        { merge: true }
      );
      return;
    }

    // If it was created or updated
    const data = event.data.after.data();
    if (!data) return;

    // A "soft delete" could be indicated by isActive === false
    if (data.isActive === false) {
      logger.info(`Template ${templateId} is inactive. Removing from cache...`);
      await cacheDocRef.set(
        { [templateId]: FieldValue.delete() },
        { merge: true }
      );
      return;
    }

    // Extract relevant fields
    const name = data.name || "Untitled Template";
    const details = data.details || {};
    let description = details.description || "";
    if (description.length > 200) {
      description = description.substring(0, 200);
    }
    const thumbnailUrl = details.thumbnailUrl || "";

    const cacheEntry: any = {
      n: name,
      d: description || FieldValue.delete(),
      t: thumbnailUrl || FieldValue.delete(),
    };

    logger.info(`Updating cache for template ${templateId}`);

    // Ensure the fast-cache document and templates map exists
    await cacheDocRef.set(
      { [templateId]: cacheEntry },
      { merge: true }
    );
  }
);
