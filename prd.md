# Product Requirements Document: Simple Business Journal

## 1. Overview

This document outlines the product requirements for a web application designed to help small businesses (e.g., a flooring company) manage their operations. The application will facilitate the creation and management of orders, which will evolve through various statuses from "Draft" to "Invoiced," and ultimately to "Paid" or "Voided."

## 2. Tech Stack

*   **Frontend:** Next.js with shadcn/ui components and tailwindcss for styling.
*   **Backend:** Firebase (Callable Functions, Firestore, Storage, Hosting).

## 3. Core Features

### 3.1. Business Management
*   **Create Business:** Users can create a new business profile with a logo, name, and contact information (phone, email, address).
*   **Data Export:** Admins can export business data to CSV format (e.g., estimate details, cash flow entries).

### 3.2. Collaboration and Access Control
*   **Share Businesses:** Users can share businesses with others and define their access levels.
*   **Role-Based Access Control (RBAC):** Assign roles (Admin, Staff, Viewer) to collaborators to manage permissions.
*   **Use Firebase Authentication** to manage user identities, users are required to sign in with Google.
*   **Invite is via a shared link**: Users share the same link for the resource they want to share (e.g: domain.com/business/abc123 where abc123 is the businessId)

### 3.3. Order and Entry Management
*  **Status Evolution:** Orders (Estimates/Invoices) will transition through statuses: `DRAFT`, `SENT`, `ACCEPTED`, `INVOICED`, `PAID`, `VOIDED`.
*  **Search and Filtering:** Search for businesses and entries using filters like date ranges and keywords.
*  **Inventory Management:** Maintain an inventory of items with details like name, description, unit price, and labor costs.
*  **Print**: Orders can be printed to PDF using the browser's print functionality (window.print() api). (use the tailwind print utilities to hide non-essential UI elements when printing)

### 3.4. Reporting
*   Generate reports from business data, such as cash flow summaries and estimate totals.

## 4. Roles and Permissions

*   **Admin:** Full control over the business, including managing entries, collaborators, and data exports.
*   **Staff:** Can create and manage business entries (Estimates, Invoices, etc.).
*   **Viewer:** Read-only access to business entries and reports.

## 5. Firestore 

This project will use Firestore as the primary database. For development, there is a local emulator setup, and for production, it will use Firestore in Native mode. The local emulator is running on devmachine:8080 or 192.168.1.202:8080

### 5.1 Data Model

The following path structure outlines the collections and documents in Firestore.

```yaml
/businesses/{businessId}
/businesses/{businessId}/orders/{orderId}
/businesses/{businessId}/inventory/{itemId}
/businesses/{businessId}/cashflows/{entryId}
/businesses/{businessId}/customers/{customerId}
/businesses/{businessId}/events/{eventId}
```

The data schema for each collection is defined using Zod schemas in the `shared/schemas` directory.
```ts
// shared/schemas/common.ts
...
export const contactInfoSchema = z.object({
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
  address: z.string().max(200).optional(),
});

// Example: shared/schemas/business.ts
...
export const businessSchema = z.object({
  id: z.string().optional(), // Firestore will auto-generate this
  name: z.string().min(1).max(100),
  logoUrl: z.string().url().optional(),
  contactInfo: contactInfoSchema,
  access: z.record(
    z.object({
      role: z.enum(["Admin", "Staff", "Viewer"]),
      addedAt: z.date(),
    }),
  ),
  pendingAccess: z.record(
    z.object({
      email: z.string().email(),
      role: z.enum(["Admin", "Staff", "Viewer"]),
      invitedAt: z.date(),
    }),
  ).default({}),
  isActive: z.boolean().default(true),
  trace: traceSchema,
});
```


### Data Structures:

* both frontend and backend will be written in Typescript, they will share many data structures (Types, Interfaces and Zod schemas ) that can be used for data validation. For those structures, keep them in a file where both the backend and the frontend can access.

when defining the data structures, consider the following:
* Use enums for fields with a limited set of values (e.g., order status, user roles).
* reuse common structures (e.g., trace, contactInfo, inventoryItem, payment, adjustment, lineItem)
* Some types can be infered from zod schemas, use zod's `z.infer` to extract types from zod schemas when possible.

## 6. Firestore Rules

```sh
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Combined function: Checks both access and activity
    function hasAccessAndIsActive(businessId) {
      let logData = get(/databases/$(database)/documents/business/$(businessId)).data;
      return request.auth.uid in logData.access_array && (logData.isActive == true || logData.isActive == null);
    }

    match /business/{businessId} {
      allow read: if request.auth.uid in resource.data.access_array && 
                    (resource.data.isActive == true || resource.data.isActive == null);

      match /{subcol}/{entryID} {
        // Check if the user has access to the parent log, the parent log is active, AND entry is active.
        allow read: if hasAccessAndIsActive(businesId) && (resource.data.isActive == true || resource.data.isActive == null);
      }
    }
  }
}
```

## 7. Other Considerations
* All writes will be done using a Firestore callable function instead of the client writing directly to the database.
* Every edit (write) call to the backend that is committed will be recorded in a /business/{businessId}/events subcollection
```ts
// /apps/backend/src/helpers/audited-function.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

// Wrapper for creating secure, audited callable functions
export const createAuditedCallable = (
  allowedRoles: ("Admin" | "Staff")[],
  inputSchema: z.ZodType,
  handler: (
    data: any,
    context: functions.https.CallableContext,
  ) => Promise<any>,
) => {
  return functions.https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in.",
      );
    }

    // 2. Input Validation
    const validationResult = inputSchema.safeParse(data);
    if (!validationResult.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid data provided.",
      );
    }

    const { businessId } = data;
    const db = getFirestore();
    const businessRef = db.collection("businesses").doc(businessId);
    const businessDoc = await businessRef.get();

    if (!businessDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Business not found.");
    }

    // 3. Authorization (RBAC) Check
    const userRole = businessDoc.data()?.access[context.auth.uid]?.role;
    const isAuthorized = userRole && allowedRoles.includes(userRole);
    if (!isAuthorized) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission.",
      );
    }

    // 4. Execute Core Logic
    const result = await handler(data, context);

    // 5. Log Audit Event
    const eventRef = businessRef.collection("events").doc();
    await eventRef.set({
      type: `FUNCTION_CALL_${handler.name.toUpperCase()}`,
      userId: context.auth.uid,
      timestamp: new Date(),
      details: { input: data },
    });

    return result;
  });
};
```
* Use Firebase Storage to store business logos and any other media assets.


### Project Initialization
The project has already been initialized using:
```sh
# Initialize a new Firebase project
firebase init

# Initialize a new Next.js app with TypeScript
npx create-next-app@latest -e with-tailwindcss simple-business
cd simple-business
npm run dev

# initialized shadcn/ui
npx shadcn-ui@latest init
npx shadcn@latest add --all
```

### Directory Structure
```
simple-business
├── backend
│   └── functions
│       └── src
├── frontend
│   ├── public
│   └── src
│       └── app
└── shared
    ├── schemas
    ├── types
    └── utils
```

## 8. Local Development
* Use the Firebase Emulator Suite for local development and testing. A local emulaor is available at devmachine (192.168.1.202)
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run lint",
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ]
    }
  ],
  "emulators": {
    "auth": {
      "port": 9099,
      "host": "0.0.0.0"
    },
    "functions": {
      "port": 5001,
      "host": "0.0.0.0"
    },
    "firestore": {
      "port": 8080,
      "host": "0.0.0.0"
    },
    "ui": {
      "enabled": true,
      "port": 4000,
      "host": "0.0.0.0"
    },
    "singleProjectMode": true,
    "storage": {
      "port": 9199,
      "host": "0.0.0.0"
    }
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```


## 9. Security
* Use app-check to protect the backend from abuse.