import { addLogFn } from "./bg-add-log-entry";
import { initializeApp, getApps } from "firebase-admin/app";
import { addContributor } from "./bg-add-contributors";
import { acceptShare } from "./bg-accept-share";
import { deleteJournal, deleteEntry } from "./bg-delete-entry"; // Import new functions
import { onInventoryEntryWrite } from "./cache-updates/bg-cache";
import { createJournal, updateJournal } from "./bg-journal-management"; // Updated import path
import { convertEstimateToInvoiceFn } from "./bg-convert-estimate-to-invoice";

if (getApps().length === 0) {
  initializeApp();
}

exports.addLogFn = addLogFn;
exports.updateJournal = updateJournal;
exports.createJournal = createJournal;
exports.addContributor = addContributor;
exports.acceptShare = acceptShare;
exports.deleteJournal = deleteJournal; // Export new function
exports.deleteEntry = deleteEntry; // Export new function
exports.convertEstimateToInvoice = convertEstimateToInvoiceFn;

exports.onInventoryEntryWrite = onInventoryEntryWrite;
