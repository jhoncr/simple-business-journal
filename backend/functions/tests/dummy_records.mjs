import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  JOURNAL_COLLECTION,
  ENTRIES_SUBCOLLECTION,
} from "../lib/common/const.js";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "demo-dummy";

const randomNames = [
  "John",
  "Mary",
  "Peter",
  "Paul",
  "George",
  "Ringo",
  "Luke",
  "Leia",
  "Han",
  "Chewbacca",
  "Obi-Wan",
  "Darth Vader",
  "Yoda",
  "Anakin",
  "Padme",
  "Qui-Gon",
  "Mace Windu",
  "Jabba",
  "Boba Fett",
  "Jar Jar Binks",
  "Lando",
  "Kylo Ren",
  "Rey",
  "Finn",
  "Poe",
  "BB-8",
  "R2-D2",
  "C-3PO",
  "Darth Maul",
  "Palpatine",
  "Jango Fett",
  "Count Dooku",
  "General Grievous",
  "Ahsoka Tano",
  "Captain Rex",
  "Cad Bane",
  "Asajj Ventress",
  "Mandalorian",
  "Baby Yoda",
  "Grogu",
  "Din Djarin",
  "Cara Dune",
  "Greef Karga",
  "Bo-Katan Kryze",
  "Ahsoka Tano",
  "Boba Fett",
  "Luke Skywalker",
  "Han Solo",
  "Chewbacca",
  "Leia Organa",
  "R2-D2",
  "C-3PO",
  "Obi-Wan Kenobi",
  "Yoda",
  "Darth Vader",
  "Darth Maul",
  "Palpatine",
  "Jabba the Hutt",
  "Boba Fett",
  "Kylo Ren",
  "Rey",
  "Finn",
  "Poe Dameron",
  "BB-8",
  "Mace Windu",
  "Qui-Gon Jinn",
  "Lando Calrissian",
  "Jango Fett",
  "Count Dooku",
  "General Grievous",
  "Ahsoka Tano",
  "Captain Rex",
  "Cad Bane",
  "Asajj Ventress",
  "Mandalorian",
  "Baby Yoda",
  "Grogu",
  "Din Djarin",
  "Cara Dune",
  "Greef Karga",
  "Bo-Katan Kryze",
  "Ahsoka Tano",
  "Boba Fett",
  "Luke Skywalker",
  "Han Solo",
  "Chewbacca",
  "Leia Organa",
  "R2-D2",
  "C-3PO",
  "Obi-Wan Kenobi",
  "Yoda",
  "Darth Vader",
  "Darth Maul",
];
const L = randomNames.length;

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

// get all users from Auth service
const getUsers = async () => {
  const users = [];
  const listUsersResult = await auth.listUsers();
  listUsersResult.users.forEach((userRecord) => {
    users.push(userRecord.toJSON());
  });
  console.log("users", users);
  return users;
};

const createDummyJournal = async (user) => {
  const logDocRef = db.collection(JOURNAL_COLLECTION).doc();

  await logDocRef.set({
    title: `${user.displayName}'s Journal ${Math.random()}`,
    // add random seed to the description between 0 and 100
    description: `This is a dummy journal created for testing purposes: ${Math.floor(
      Math.random() * 100,
    )}`,
    journalType: "simple-cashflow",
    access: {
      [user.uid]: {
        role: "admin",
        displayName: user.displayName,
        email: user.email,
        photoURL: user?.photoURL ?? "null",
      },
    },
    createdAt: FieldValue.serverTimestamp(),
  });
  return logDocRef.id;
};

const addDummyEntries = async (journalId, uid, N = 50) => {
  for (let i = 0; i < N; i++) {
    let colEntry = db
      .collection(`${JOURNAL_COLLECTION}/${journalId}/${ENTRIES_SUBCOLLECTION}`)
      .doc();
    await colEntry.set({
      createdAt: FieldValue.serverTimestamp(),
      isActive: true,
      createdBy: uid,
      details: {
        type: i % 2 === 0 ? "paid" : "received",
        description: `Dummy entry ${i}. Random name: ${
          randomNames[Math.floor(Math.random() * L)]
        }`,
        // date: today date but at 12:00:00 AM
        // set date to a random date between 2020 and 2022
        date: new Date(
          2020 + Math.floor(Math.random() * 4),
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28),
        ),
        value: Math.floor(Math.random() * 1000),
      },
    });
  }
};

const main = async () => {
  const users = await getUsers();

  const journalId1 = await createDummyJournal(users[0]);
  await addDummyEntries(journalId1, users[0].uid);
  const journalId2 = await createDummyJournal(users[0]);

  await addDummyEntries(journalId2, users[0].uid);
};

// if no arguments are passed, run the main function
if (process.argv.length <= 2) {
  main();
}

// if the id argument is passed, add dummy entries to that log
if (process.argv.length > 2) {
  const users = await getUsers();
  addDummyEntries(process.argv[2], users[0].uid, 2);
}
