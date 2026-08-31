# AI Agent Instructions for Simple Business Journal

Hello AI Assistant! When working on this repository, you are acting as an expert Full-Stack TypeScript Developer specializing in Next.js, Firebase, React Three Fiber, and Tailwind CSS. 

Please strictly adhere to the following project-specific rules, architectural patterns, and coding standards.

## 1. Core Directives & Golden Rules
* **Don't Repeat Yourself (DRY):** Reuse code present in the project as much as possible. Before creating a new utility, hook, or UI component, aggressively search the existing codebase (`src/components/ui`, `src/lib`, `src/hooks`). 
* **Strict Data Validation:** All data that will eventually be written to or read from Firestore **MUST** be validated using the Zod schemas located in `backend/functions/src/common/schemas/`. 
  * *Do not* invent arbitrary TypeScript interfaces for database documents on the frontend. Import and infer types from the shared schemas (e.g., `z.infer<typeof EstimateSchema>`).
* **Think Before You Code:** Always outline your proposed changes or architectural decisions before dumping large blocks of code. Verify your understanding of the schema and existing logic first.

## 2. Project Architecture & Tech Stack
This project operates as a monorepo with distinct frontend and backend directories that share common types and schemas.

### Frontend (`/frontend`)
* **Framework:** Next.js (App Router). 
* **Styling:** Tailwind CSS + Shadcn UI components. Use `cn()` from `src/lib/utils.ts` for conditionally merging Tailwind classes.
* **State & Fetching:** Rely on custom hooks (e.g., `useEstimate`, `useFetch`) and the centralized DB handlers (`src/lib/db_handler.tsx`).
* **Internationalization (i18n):** The app uses `next-intl`. **Never hardcode user-facing text.** Always utilize the `useTranslations` hook and define strings in `messages/en.json` and `messages/pt.json`.
* **3D Canvas (Studio):** The `StoneForge` studio features use React Three Fiber (`@react-three/fiber`) and Drei. When modifying 3D components:
  * Be extremely mindful of performance.
  * Avoid triggering unnecessary React state updates inside `useFrame` loops.
  * Ensure camera logic handles various aspect ratios (especially for print views).

### Backend (`/backend/functions`)
* **Framework:** Firebase Cloud Functions (Node.js/TypeScript).
* **Database:** Firestore.
* **Security Rules:** Always consider Firestore security rules when designing data access patterns.
* **Background Processing:** The backend heavily utilizes event-driven background functions (`bg-*.ts`). Keep these isolated and idempotent.

## 3. Coding Standards
* **TypeScript:** Write strict, type-safe code. Avoid `any` unless absolutely necessary (and if used, leave a comment explaining why). 
* **Imports:** Use absolute imports (e.g., `@/components/...` or `@backend/common/...`) rather than deep relative paths (`../../../../`) whenever supported by the TS config.
* **Small, Single-Responsibility Components:** Break down large files into smaller subcomponents (e.g., how the estimate view is broken down into `subcomponents/header.tsx`, `subcomponents/InvoiceDetails.tsx`, etc.).
* **Error Handling:** Use `safeParse` with Zod when validating external or database data, and fail gracefully with user-friendly error toasts (using Shadcn UI's `use-toast`).

## 4. Workflows
* **Adding Database Fields:** 1. Update the schema in `backend/functions/src/common/schemas/`.
  2. Update the frontend UI to consume/edit the new field.
  3. Ensure backend triggers (if any) are aware of the payload change.
* **Creating Print Layouts:** Remember that print layouts (like `/technical-drawings`) strip out standard app UI. Rely on tailwind `print:` CSS rules and ensure components scale properly on standard paper sizes (A4/Letter).