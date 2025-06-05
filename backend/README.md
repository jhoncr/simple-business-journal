# Backend

This directory contains the backend services for the application, primarily implemented using Firebase Cloud Functions.

## Structure

-   **functions/**: Contains the source code for the Cloud Functions.
    -   **src/**: TypeScript source files for the functions.
        -   **common/**: Shared types, constants, and schemas.
        -   **cache-updates/**: Functions related to cache management.
        -   **lib/**: Utility or helper functions.
    -   **tests/**: Test files for the functions.
    -   **package.json**: Node.js dependencies for the functions.
    -   **tsconfig.json**: TypeScript configuration.
-   **firebase.json**: Firebase project configuration, including Hosting and Functions settings.
-   **firestore.indexes.json**: Firestore index definitions.
-   **firestore.rules**: Firestore security rules.
-   **storage.rules**: Cloud Storage security rules.
-   **package.json**: (Potentially for backend-level scripts or configuration, though functions have their own).

## Key Components

-   **Cloud Functions**: Handle core business logic, data manipulation, and background tasks. (See `functions/src/` for details).
-   **Firestore**: NoSQL database used for data storage. Rules and indexes are defined here.
-   **Cloud Storage**: Used for file storage (e.g., logos). Rules are defined here.

## Implemented Cloud Functions (`functions/src`)

Based on the filenames, the following core functionalities are implemented as Cloud Functions:

-   `bg-accept-share.ts`: Handles the logic for accepting a shared journal or resource.
-   `bg-add-contributors.ts`: Manages adding new contributors or collaborators to journals.
-   `bg-add-group.ts`: Logic for adding a new group (context might be user groups or journal categorization).
-   `bg-add-log-entry.ts`: Responsible for adding new entries (like cash flow, inventory, estimates) to a specific journal.
-   `bg-create-new-journal.ts`: Handles the creation process for new journals of different types.
-   `bg-delete-entry.ts`: Manages the deletion of entries from a journal.
-   `index.ts`: Entry point that likely exports and organizes the callable functions.
-   `cache-updates/bg-cache.ts`: Contains logic related to updating cached data, possibly for performance optimization.

## Development

Refer to the main project README for overall development setup. To work specifically on the backend functions:

1.  Navigate to the `backend/functions` directory.
2.  Install dependencies: `npm install`
3.  Run the emulator suite (from the root or backend directory, depending on setup): `firebase emulators:start`
4.  Deploy functions: `firebase deploy --only functions`
