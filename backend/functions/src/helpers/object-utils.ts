import { FieldValue } from 'firebase-admin/firestore';

/**
 * Flattens a nested object into Firestore dot-notation key-value pairs.
 * - Leaves undefined fields out (preserves them in Firestore).
 * - Converts null and empty string "" values to FieldValue.delete() to remove the key from Firestore.
 * - Recursively flattens plain objects into dot-paths (e.g. 'details.contactInfo.phone').
 * - Preserves arrays, Dates, FieldValue instances as atomic values.
 */
export function flattenToDotNotation(
  obj: Record<string, any>,
  prefix = '',
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
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
      Object.assign(result, flattenToDotNotation(value, path));
    } else {
      result[path] = value;
    }
  }

  return result;
}
