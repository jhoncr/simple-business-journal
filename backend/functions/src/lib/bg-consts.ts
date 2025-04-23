import { HttpsError } from "firebase-functions/https";
import type { SafeParseError } from "zod";

// allow localhost in CORS if running in developemtn enviroment
const ALLOWED = ["*"];
if (process.env.NODE_ENV === "development") {
  ALLOWED.push("http://localhost:3000");
}

export { ALLOWED }; // Utility function to handle schema validation errors

/**
 * Handles a schema validation error by throwing an HttpsError with detailed information.
 *
 * @param {string} journalType - The type of journal which failed validation.
 * @param {SafeParseError<any>} detailsResult - The result from a safe parse operation containing validation issues.
 * @throws {HttpsError} Throws an error indicating an invalid argument if schema validation fails.
 *
 * @remarks
 * This function aggregates all issue messages into a single formatted error message and throws an error.
 */
export function handleSchemaValidationError(
  journalType: string,
  detailsResult: SafeParseError<any>,
): never {
  throw new HttpsError(
    "invalid-argument",
    `Invalid entry details for journalType ${journalType}: \n${detailsResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`,
  );
}
