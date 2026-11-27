import { HttpsError } from 'firebase-functions/https';
import type { SafeParseError } from 'zod';

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * Anchored project subdomains allowed on Firebase Hosting (.web.app / .firebaseapp.com),
 * including preview channels (`<project>--<channel>`).
 */
const FIREBASE_HOSTING_PROJECTS = '(?:nessedia-3d219|simple-log-19f86|demo-dummy)';

export const PRODUCTION_ALLOWED_ORIGINS: (string | RegExp)[] = [
  new RegExp(`^https:\\/\\/${FIREBASE_HOSTING_PROJECTS}(--[a-z0-9-]+)?\\.web\\.app$`),
  new RegExp(`^https:\\/\\/${FIREBASE_HOSTING_PROJECTS}(--[a-z0-9-]+)?\\.firebaseapp\\.com$`),
  /^https:\/\/([a-z0-9-]+\.)?j3cordeiro\.com$/,
];

export const EMULATOR_ALLOWED_ORIGINS: (string | RegExp)[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * CORS origins for callable functions.
 *
 * Production: strictly anchored HTTPS origins for this project's Firebase
 * Hosting subdomains and the j3cordeiro.com custom domain. The emulator allows
 * localhost / 127.0.0.1 so local development keeps working.
 */
export const ALLOWED_ORIGINS: (string | RegExp)[] = isEmulator ?
  EMULATOR_ALLOWED_ORIGINS :
  PRODUCTION_ALLOWED_ORIGINS;

/**
 * Handles a schema validation error by throwing an HttpsError with detailed information.
 *
 * @param {string} entryType - The type of entry which failed validation.
 * @param {SafeParseError<unknown>} detailsResult - The result from a safe parse operation containing validation issues.
 * @throws {HttpsError} Throws an error indicating an invalid argument if schema validation fails.
 */
export function handleSchemaValidationError(
  entryType: string,
  detailsResult: SafeParseError<unknown>,
): never {
  throw new HttpsError(
    'invalid-argument',
    `Invalid entry details for entryType ${entryType}: \n${detailsResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`,
  );
}
