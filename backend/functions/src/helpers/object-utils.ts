import { FieldValue } from 'firebase-admin/firestore';

/**
 * Flattens a nested object into Firestore dot-notation key-value pairs.
 * - Rejects keys containing `.` to prevent Firestore field-path injection.
 * - Leaves undefined fields out (preserves them in Firestore).
 * - Converts null and empty string "" values to FieldValue.delete() to remove the key from Firestore.
 * - Recursively flattens plain objects into dot-paths (e.g. 'details.contactInfo.phone').
 * - Preserves arrays, Dates, FieldValue instances as atomic values.
 */
export function flattenToDotNotation(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.includes('.')) {
      throw new Error(
        `Invalid key "${key}": keys must not contain "." in dot-notation flattening.`,
      );
    }
    if (value === undefined) continue;

    const path = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === '') {
      result[path] = FieldValue.delete();
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof FieldValue)
    ) {
      Object.assign(
        result,
        flattenToDotNotation(value as Record<string, unknown>, path),
      );
    } else {
      result[path] = value;
    }
  }

  return result;
}
