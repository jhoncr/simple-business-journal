# Product Requirements Document: Simple Business Journal

## 1. Overview

This document outlines the product requirements for a web application designed to help small businesses (e.g., a flooring company) manage their operations. The application will facilitate the creation and management of orders, which will evolve through various statuses from "Draft" to "Invoiced," and ultimately to "Paid" or "Voided."

## 2. Tech Stack

*   **Frontend:** Next.js with shadcn/ui and Tremor components and tailwindcss for styling.
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

## 5. Firestore Data Model

The following YAML structure outlines the collections and documents in Firestore.

```yaml
# /businesses/{businessId}
# Represents a single business entity.
Business:
    id: string # Document ID
    name: string # Name of the business
    tags: array # e.g., ["FLOORING", "GENERAL_CONTRACTOR"]
    access: map # Defines user roles for access control.
        user123:
            displayName: Alice
            email: alice@example.com
            photoURL: string
            role: Admin
        user456:
            displayName: Bob
            email: bob@example.com
            photoURL: string
            role: Staff
        anotherKey:
            displayName: Charlie
            email: charlie@example.com
            photoURL: string
            role: Viewer

    # {userId}: "admin" | "staff" | "viewer"
    access_array: array # An array of user UIDs for efficient querying.
    pendingAccess: map # Stores invitations for users who have not yet accepted.
        example@example.com: admin
        example2@example.com: viewer
    # {email}: "admin" | "staff" | "viewer"
    currency: string # Default currency for the business (e.g., "USD").
    contactInfo:
        name: string
        email: string
        phone: string
        address: string
    logo: string # URL to the business logo in Firebase Storage.
    trace: map # Audit trail information
        createdBy: string
        createdAt: timestamp
        updatedBy: string
        updatedAt: timestamp
        deletedBy: string
        deletedAt: timestamp

# /businesses/{businessId}/orders/{orderId}
# Represents an order within a business, such as an estimate or invoice.
Order:
  id: string # Document ID
  name: string # Title of the order (e.g., "Estimate #1001").
  status: string # DRAFT, SENT, ACCEPTED, INVOICED, PAID, VOIDED, etc.
  details:
    # Details vary by order type. For an estimate/invoice:
    customer: string # customerId
    notes: string
    dueDate: timestamp
    payments: array
      - amount: number
        date: timestamp
        method: string
        transactionId: string
        notes: string
    adjustments: array
      - type: string # "addPercent", "addFixed", "discountPercent", "discountFixed", "taxPercent"
        value: number
        description: string
    items: array # Line items for the estimate/invoice.
      - description: string
        dimensions: 
          length: number
          width: number
        quantity: number # Quantity of the item, e.g., number of units or area in m².
        item:
          id: string # could be a UUID of an inventory Item, or a temporary ID for custom items
          name: string
          description: string
          tags: array # e.g., ["wood", "tile", "service"]
          unitPrice: number
          currency: string # "USD", "BRL"
          unitLabel: string # "m²", "ft²", "unit"
          labor: # Optional labor details
            laborRate: number
            laborType: string # "per-unit", "fixed", "percentage"
            description: string # Description of the labor, if applicable.
    isActive: boolean
    trace: map # Audit trail information
        createdBy: string
        createdAt: timestamp
        updatedBy: string
        updatedAt: timestamp
        deletedBy: string
        deletedAt: timestamp

# /businesses/{businessId}/inventory/{itemId}
# Represents an item in the business's inventory.
InventoryItem:
    id: string # could be a UUID of an inventory Item, or a temporary ID for custom items
    name: string
    description: string
    tags: array # e.g., ["wood", "tile", "service"]
    unitPrice: number
    currency: string # "USD", "BRL"
    unitLabel: string # "m²", "ft²", "unit"
    labor: # Optional labor details
        laborRate: number
        laborType: string # "per-unit", "fixed", "percentage"
        description: string # Description of the labor, if applicable.
    isActive: boolean
    trace: map # Audit trail information
        createdBy: string
        createdAt: timestamp
        updatedBy: string
        updatedAt: timestamp
        deletedBy: string
        deletedAt: timestamp

# /businesses/{businessId}/cashflows/{entryId}
# Represents a cash flow transaction.
CashflowEntry:
    id: string # Document ID
    description: string
    eventDate: timestamp
    type: string # "received" or "paid"
    amount: number
    currency: string # "USD", "BRL"
    isActive: boolean
    trace: map # Audit trail information
        createdBy: string
        createdAt: timestamp
        updatedBy: string
        updatedAt: timestamp
        deletedBy: string
        deletedAt: timestamp

# /businesses/{businessId}/customers/{customerId}
# Represents a customer associated with the business.
Customer:
    id: string # Document ID
    name: string
    email: array [string] # Support multiple emails
    phone: array [string] # Support multiple phone numbers
    address: map
        street: string
        city: string
        state: string
        zip: string
        country: string
    notes: string
    isActive: boolean
    trace: map # Audit trail information
        createdBy: string
        createdAt: timestamp
        updatedBy: string
        updatedAt: timestamp
        deletedBy: string
        deletedAt: timestamp

# /businesses/{businessId}/events/{eventId}
# Represents an event log for auditing purposes.
Event:
    id: string # Document ID
    type: string # e.g., "ORDER_CREATED", "ORDER_UPDATED", "USER_INVITED"
    userId: string # ID of the user who performed the action
    timestamp: timestamp
    details: map # Additional details about the event, for example the uri and body of the request
```

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


