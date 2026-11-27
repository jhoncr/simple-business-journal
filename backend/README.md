# Backend

This directory contains the Firebase backend for **Simple Business Journal**, including Cloud Functions v2 (Node.js 22 / TypeScript), shared Zod schemas, Firestore security rules and indexes, Cloud Storage security rules, and the local Firebase Emulator configuration.

## Directory Structure

* **`functions/`**: Firebase Cloud Functions package.
  * **`src/index.ts`**: Exports all callable and event-driven Cloud Functions.
  * **`src/bg-*.ts`**: Individual Cloud Function implementations.
  * **`src/common/`**: Shared constants, types, payment math, and strict Zod schemas (`schemas/JournalSchema.ts`, `schemas/common_schemas.ts`, `schemas/configmap.ts`, `schemas/estimate_schema.ts`, `schemas/studio.ts`) imported by both backend and frontend (`@backend/common/...`).
  * **`src/helpers/`**: Shared server utilities:
    * `audited-function.ts`: Wrapper that logs sanitized invocation events to `/journals/{journalId}/events`.
    * `email-utils.ts`: Email escaping/unescaping for Firestore map keys (`pendingAccess`).
    * `object-utils.ts`: Safe dot-notation flattening for partial Firestore updates.
  * **`src/lib/bg-consts.ts`**: Backend configuration constants.
  * **`tests/`**: Automated Node.js (`node --test`) test suites covering RBAC, security refinements, transactional payments, Zod/Firestore compatibility, financial math, CSV formatting, i18n parity, and 3D Studio math/print pipelines.
* **`firebase.json`**: Firebase configuration for Functions, Firestore, Storage, and Emulators.
* **`firestore.rules`**: Firestore security rules. Clients are read-only and scoped to active journals where their UID is in `access_array`. Explicit subcollection matchers grant read access only to `/estimates`, `/templates`, and `/fast-cache`, leaving `/events` strictly inaccessible to clients.
* **`firestore.indexes.json`**: Firestore composite index definitions.
* **`storage.rules`**: Cloud Storage security rules forbidding direct client writes and restricting thumbnail reads to active journal members.
* **`package.json`**: Root backend scripts for emulators, tests, and deploying functions alongside security rules and indexes.

## Implemented Cloud Functions (`functions/src`)

### Callable Functions
* **`createJournal` & `updateJournal`** (`bg-journal-management.ts`): Creates new business journals and performs validated partial dot-notation updates to journal metadata/business details.
* **`addLogFn`** (`bg-add-log-entry.ts`): Creates and updates entries (`estimates` and `templates`) with role checks, strict per-type Zod validation, optimistic concurrency (`expectedUpdatedAtMillis`), and optional server-side template thumbnail uploads to Cloud Storage.
* **`deleteJournal` & `deleteEntry`** (`bg-delete-entry.ts`): Soft-deletes journals (Admin only) and entries (Admin/Editor) by setting `isActive: false`, `deletedAt`, and `deletedBy`.
* **`duplicateEntry`** (`bg-duplicate-entry.ts`): Duplicates an existing estimate or template within a journal (clearing payments and enforcing schema length limits on notes/names).
* **`mutatePayments`** (`bg-payments.ts`): Atomically adds, edits, or voids payments on an estimate inside a Firestore transaction to prevent concurrent overwrites.
* **`addContributor`** (`bg-add-contributors.ts`): Admin-only collaborator management (invite/update/remove contributors) with sole-admin and admin-role protections.
* **`acceptShare`** (`bg-accept-share.ts`): Accepts a pending email invitation and atomically moves the user from `pendingAccess` into `access` and `access_array`.

### Firestore Triggers
* **`onTemplateWritten`** (`bg-template-cache.ts`): Triggered on writes to `journals/{journalId}/templates/{templateId}`. Transactionally mirrors template `name`, `description` (truncated to 200 chars), and `thumbnailUrl` into `journals/{journalId}/fast-cache/templates` (or removes inactive/deleted templates) to power the frontend Template Gallery.

## Development & Testing

Ensure **Node.js 22** is active before running commands:

```bash
# Install function dependencies
cd backend/functions
npm install

# Run ESLint
npm run lint

# Compile TypeScript
npm run build

# Build and run the full test suite
npm test
```

### Running Local Emulators

From the `backend/` directory:

```bash
npm run dev            # Builds functions and starts Auth, Functions, Firestore & Storage emulators
npm run save-emulators # Exports current emulator state to ./emulators-data
```

## Deployment

Always keep Cloud Functions, Firestore rules/indexes, and Storage rules deployed in sync:

```bash
# From backend/ (recommended: deploys functions + firestore:rules + firestore:indexes + storage)
npm run deploy:backend

# Deploy only rules and indexes from backend/
npm run deploy:rules

# Or from the repository root
../deploy.sh --backend
```
