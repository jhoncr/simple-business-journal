import { HttpsError } from 'firebase-functions/https';
import type { SafeParseError } from 'zod';

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * CORS origins for callable functions.
 *
 * Production: only Firebase Hosting's default domains. If a custom domain is
 * ever attached to hosting, add it here explicitly. The emulator allows
 * localhost so local development keeps working.
 */
export const ALLOWED_ORIGINS: (string | RegExp)[] = isEmulator ?
  [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/] :
  [/\.web\.app$/, /\.firebaseapp\.com$/];

/**
 * Handles a schema validation error by throwing an HttpsError with detailed information.
 *
 * @param {string} entryType - The type of entry which failed validation.
 * @param {SafeParseError<any>} detailsResult - The result from a safe parse operation containing validation issues.
 * @throws {HttpsError} Throws an error indicating an invalid argument if schema validation fails.
 *
 * @remarks
 * This function aggregates all issue messages into a single formatted error message and throws an error.
 */
export function handleSchemaValidationError(
  entryType: string, // Renamed parameter
  detailsResult: SafeParseError<any>,
): never {
  throw new HttpsError(
    'invalid-argument',
    `Invalid entry details for entryType ${entryType}: \n${detailsResult.error.issues // Updated message
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`,
  );
}
