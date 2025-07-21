import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const db = getFirestore();

type AuditedCallableOptions = {
  isCreateOperation?: boolean;
};

export const createAuditedCallable = <T extends z.ZodType>(
  functionName: string,
  collectionName: string,
  allowedRoles: ("admin" | "staff")[],
  inputSchema: T,
  handler: (request: functions.https.CallableRequest) => Promise<any>,
  options: AuditedCallableOptions = {},
) => {
  return functions.https.onCall(async (request) => {
    // 1. Authentication Check
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in.",
      );
    }

    // 2. Input Validation
    const validationResult = inputSchema.safeParse(request.data);
    if (!validationResult.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid data provided.",
        validationResult.error.flatten(),
      );
    }

    const data = validationResult.data as any;
    const baseId = data.id;

    // If allowedRoles is not empty, we require a baseId and role check.
    if (allowedRoles.length > 0 && !options.isCreateOperation) {
      if (!baseId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Business ID is required for this operation.",
        );
      }

      const businessRef = db.collection(collectionName).doc(baseId);
      const businessDoc = await businessRef.get();

      if (!businessDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Business not found.",
        );
      }

      // 3. Authorization (RBAC) Check
      const businessData = businessDoc.data();
      if (businessData?.isActive === false) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "This business is not active.",
        );
      }
      const userRole = businessData?.access[request.auth.uid]?.role;
      const isAuthorized = userRole && allowedRoles.includes(userRole);
      if (!isAuthorized) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permission to perform this action.",
        );
      }
    }

    // 4. Execute Core Logic
    const { id, response } = await handler(request);

    // 5. Log Audit Event for non-creation functions
    if (id) {
      const db = getFirestore();
      const docRef = db.collection(collectionName).doc(id);
      const eventRef = docRef.collection("events").doc();
      await eventRef.set({
        type: `FUNCTION_CALL_${functionName.toUpperCase()}`,
        userId: request.auth.uid,
        timestamp: FieldValue.serverTimestamp(),
        details: { input: request.data },
      });
    }

    return response;
  });
};
