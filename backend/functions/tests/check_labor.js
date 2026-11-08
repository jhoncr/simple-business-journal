const admin = require("firebase-admin");

// Set FIRESTORE_EMULATOR_HOST to connect to local emulator by default (port 8080).
// If you want to run against production, set process.env.USE_PRODUCTION = "true" before running.
if (!process.env.USE_PRODUCTION && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT || "simple-log-19f86",
  });
}

const db = admin.firestore();

async function checkLabor() {
  const journalId = "NnPN6hlgf4runAvOuFk0";
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  console.log(`Target: ${isEmulator ? `Local Firestore Emulator (${process.env.FIRESTORE_EMULATOR_HOST})` : 'Production Cloud Firestore'}`);
  console.log(`Checking estimates in /journals/${journalId}/estimates ...\n`);

  try {
    const estimatesRef = db.collection(`journals/${journalId}/estimates`);

    // 1. Top-level 'labor' query
    const topLevelSnap = await estimatesRef.where("labor", "!=", null).get();
    console.log(`Top-level 'labor' field count: ${topLevelSnap.size}`);
    topLevelSnap.forEach((doc) => console.log(" - Found Doc ID:", doc.id));

    // 2. Nested 'details.labor' query
    const detailsSnap = await estimatesRef.where("details.labor", "!=", null).get();
    console.log(`'details.labor' field count: ${detailsSnap.size}`);
    detailsSnap.forEach((doc) => console.log(" - Found Doc ID:", doc.id));

    // 3. Scan all documents in memory for array item labor properties (details.confirmedItems[].material.labor)
    const allDocsSnap = await estimatesRef.get();
    console.log(`\nScanning ${allDocsSnap.size} total estimate document(s) for line-item labor usage...`);

    let itemLaborCount = 0;
    allDocsSnap.forEach((doc) => {
      const data = doc.data();
      const items = data.details?.confirmedItems || data.confirmedItems || [];

      if (Array.isArray(items)) {
        items.forEach((item, idx) => {
          if (item.material && item.material.labor != null) {
            console.log(` - Doc [${doc.id}], Item #${idx} ("${item.description || 'no desc'}") uses material.labor:`, item.material.labor);
            itemLaborCount++;
          }
        });
      }
    });

    if (topLevelSnap.size === 0 && detailsSnap.size === 0 && itemLaborCount === 0) {
      console.log(`\nRESULT: No documents in /journals/${journalId}/estimates use the 'labor' property!`);
    } else {
      console.log(`\nRESULT: Found labor usage across the collection!`);
    }
  } catch (err) {
    if (err.message && err.message.includes("Could not load the default credentials")) {
      console.error("\nAUTHENTICATION ERROR: To query Production Firestore, Google Application Default Credentials are required.");
      console.error("Please run one of the following commands in your shell first:");
      console.error("  gcloud auth application-default login");
      console.error("  OR export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json\n");
    } else {
      console.error("Error executing query:", err);
    }
  }
}

checkLabor();
