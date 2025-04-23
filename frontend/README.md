# Journal App Frontend

This is the frontend for the Journal App, a web application that allows users to create and manage various types of journals.

## Technologies Used

- **Next.js:** React framework for server-side rendering and routing.
- **React:** JavaScript library for building user interfaces.
- **TypeScript:** Typed superset of JavaScript that compiles to plain JavaScript.
- **Tailwind CSS:** A utility-first CSS framework for rapid styling.
- **shadcn/ui:** Reusable UI components built with Tailwind CSS and Radix UI.

## Features

- **User Authentication:** Secure user login and registration.
- **Multiple Journal Types:** Create and manage different types of journals, including:
    -   **Cash Flow:** Track income and expenses.
    -   **Inventory:** Manage inventory items.
    -   **Quote:** Generate and manage quotes.
- **Journal Entry Management:** Add, view, edit, and delete entries for each journal type.
- **Journal Sharing and Collaboration:** Share journals with other users and manage their permissions.
- **Responsive Design:** The application is designed to work well on various devices.
- **Reusable UI Components:** Built with a library of reusable and customizable UI components.

## Project Structure

-   `src/app/`: Contains the application's routes, pages, and layout. Includes authenticated routes under `(auth)`.
-   `src/components/`: Houses various React components, including UI components (`ui` folder) and specific feature components.
-   `src/context/`: Contains React context providers for managing global state, such as `JournalContext`.
-   `src/hooks/`: Custom React hooks used across the application.
-   `src/lib/`: Contains utility functions, authentication handling, client-side database interactions, and shared schema definitions.

## Data Management

The frontend interacts with the backend to manage data. Shared schemas are used to ensure data consistency between the frontend and backend.
