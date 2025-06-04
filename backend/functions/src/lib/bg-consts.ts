import { HttpsError } from "firebase-functions/https";
import type { SafeParseError } from "zod";

// TODO: CORS configuration should be made more restrictive for production environments.
// Currently, it allows all origins. For production, specify allowed origins explicitly.
const ALLOWED = ["*"];
// The conditional addition of "http://localhost:3000" for development is redundant
// if "*" is already present, as "*" includes localhost.
// If specific origins are needed for production and localhost for development,
// this logic should be:
// const ALLOWED = process.env.NODE_ENV === "development" ? ["http://localhost:3000", "other-dev-allowed-origin"] : ["prod-allowed-origin-1", "prod-allowed-origin-2"];

export { ALLOWED };

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
    "invalid-argument",
    `Invalid entry details for entryType ${entryType}: \n${detailsResult.error.issues // Updated message
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`,
  );
}
