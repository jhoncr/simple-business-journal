// backend/functions/src/helpers/email-utils.ts

/**
 * Normalizes an email address for consistent case-insensitive comparisons and storage.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Escapes dots in a normalized email address so it can safely be used as a Firestore map key.
 */
export function escapeEmailKey(email: string): string {
  return normalizeEmail(email).replace(/\./g, ',');
}

/**
 * Finds a matching key in a pendingAccess map, supporting both normalized lowercase
 * keys and legacy mixed-case keys.
 */
export function findPendingAccessKey(
  pendingAccess: Record<string, string> | undefined,
  email: string,
): string | undefined {
  if (!pendingAccess) return undefined;
  const normalizedKey = escapeEmailKey(email);
  if (Object.prototype.hasOwnProperty.call(pendingAccess, normalizedKey)) {
    return normalizedKey;
  }
  return Object.keys(pendingAccess).find(
    (key) => key.trim().toLowerCase() === normalizedKey,
  );
}
