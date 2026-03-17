import { addLogFn } from './bg-add-log-entry';
import { initializeApp, getApps } from 'firebase-admin/app';
import { addContributor } from './bg-add-contributors';
import { acceptShare } from './bg-accept-share';
import { deleteJournal, deleteEntry } from './bg-delete-entry'; // Import new functions
import { createJournal, updateJournal } from './bg-journal-management'; // Updated import path
import { duplicateEntry } from './bg-duplicate-entry'; // Import generic duplicate function
// import { saveTemplate, saveDesign } from './bg-studio'; // Deleted redundant studio functions

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
exports.duplicateEntry = duplicateEntry; // Export generic duplicate function
// exports.saveTemplate = saveTemplate; // Replaced by addLogFn
// exports.saveDesign = saveDesign; // Deleted legacy design tool
