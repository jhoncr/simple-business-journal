
# AI Assistant Development Workflow

This document outlines the workflow for developing this project. Your primary role is to assist in coding by following these procedures for context gathering, knowledge management, and code modification.

## Gather Context Workflow 🕵️‍♀️

Before taking any action, you **must** understand the relevant parts of the codebase. To do this, you will use a recursive, context-gathering sub-agent. This process is designed to be thorough, even at the cost of high token usage in the sub-agent, which will then return a concise summary to the main agent.

Your context-gathering workflow is as follows:

1.  **Initial Scan**: List all files in the entire project directory.
2.  **Relevance Filtering**: From the full file list, identify files that appear relevant to the current task based on their names and directory paths.
3.  **Symbol Extraction**: For each relevant file, extract a list of all class and function names.
4.  **Deep Dive**: For each class or function that seems relevant to the immediate query, read the surrounding code to understand its purpose, inputs, outputs, and dependencies.
5.  **Recursive Exploration**: Follow the "threads" you uncover. If a function you're examining calls another function or uses a class that you haven't yet analyzed, repeat the "Deep Dive" step for that new symbol. Continue this process recursively until you have a complete picture of the code relevant to the task.
6.  **Synthesize and Return**: Once your recursive exploration is complete, synthesize all the gathered information into a concise summary and return only this summary to the main agent.

---

## Caching Queries in an FAQ Folder 🧠

To build a persistent knowledge base and avoid redundant work, you will continuously update an "FAQ" folder. This folder will store answers to questions that have been resolved through the "Gather Context" workflow.

Your FAQ workflow is as follows:

1.  **Before Gathering Context**: First, check the `faq/` directory to see if the question you're trying to answer has already been documented. If it has, use the existing answer.
2.  **After Gathering Context**: Once you have gathered new context to answer a query, you **must** cache this knowledge.
3.  **Create FAQ Entry**: Generate a clear and concise question that the gathered context answers.
4.  **Save as File**: Create a new `.md` file in the `faq/` directory. The filename will be the question (e.g., `How_does_the_authentication_service_work.md`). The content of the file will be the detailed answer you synthesized.
5.  **Update Existing Entries**: If your new context gathering adds to or changes the answer to an existing question, update the corresponding file in the `faq/` directory.

---

## How to Make Code Changes ✏️

When you are asked to write or modify code, you will follow a strict procedure that integrates the context gathering and FAQ workflows.

Your code modification workflow is as follows:

1.  **Consult the FAQ**: Before doing anything else, check the `faq/` folder for existing documentation related to your task. This is your first source of truth.
2.  **Gather Context**: If the FAQ doesn't provide enough information, initiate the "Gather Context" workflow to fully understand the parts of the codebase you will be modifying.
3.  **Update the FAQ**: Before you write any new code, update the `faq/` folder with the knowledge you've just gathered. This ensures our documentation is always up-to-date.
4.  **Propose and Explain Changes**: Based on the context, propose the necessary code changes. Accompany your code with a clear explanation of *why* you are making these changes.
5.  **Implement and Verify**: Once the proposed changes are approved, implement them. After implementation, briefly verify that the changes work as expected.
6.  **Final FAQ Update**: After the code is implemented and verified, do a final check of the `faq/` folder. Update any relevant entries with inform
ation about the new changes.


## Project Overview

The frontend uses shadcn UI components. These components are designed to be reusable and customizable, allowing for a consistent look and feel across the application. Re-use components wherever possible to maintain consistency and reduce redundancy. Keep componets as small and focused as possible.

The backend is built with Firebase functions. The frontend interacts with the backend through firebase callable functions for write operaions. Read operations are done through firestore queries. The backend is responsible for handling business logic, data validation, and interactions with external services.
