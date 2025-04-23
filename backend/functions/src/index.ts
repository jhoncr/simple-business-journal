import { addLogFn } from "./bg-add-log-entry";
import { createNewJournal } from "./bg-create-new-journal";
import { initializeApp, getApps } from "firebase-admin/app";
import { addContributor } from "./bg-add-contributors";
import { acceptShare } from "./bg-accept-share";
import { deleteJournal, deleteEntry } from "./bg-delete-entry"; // Import new functions
import { onInventoryEntryWrite } from "./cache-updates/bg-cache";
import { createJournal, updateJournal } from "./bg-add-group";

if (getApps().length === 0) {
  initializeApp();
}

exports.addLogFn = addLogFn;
exports.createNewJournal = createNewJournal; // remore ?
exports.updateJournal = updateJournal;
exports.createJournal = createJournal;
exports.addContributor = addContributor;
exports.acceptShare = acceptShare;
exports.deleteJournal = deleteJournal; // Export new function
exports.deleteEntry = deleteEntry; // Export new function

exports.onInventoryEntryWrite = onInventoryEntryWrite; // This trigger path will need changing later
