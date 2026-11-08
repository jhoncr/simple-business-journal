const { UserSchema, pendingAccessSchema, ROLES } = require('../lib/common/schemas/common_schemas');
const { JournalSchema, businessDetailsSchema } = require('../lib/common/schemas/JournalSchema');

function runTests() {
  console.log('--- Running Tests for Zod Schema Firestore Storage Compatibility ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- 1. Tests for pendingAccessSchema with Firestore comma-escaped email keys ---
  console.log('\n[pendingAccessSchema Tests]');

  const validPendingAccess = {
    'user@example,com': 'viewer',
    'first,last@company,co,uk': 'editor',
    'admin@test,io': 'admin',
    'staff_member@domain,org': 'staff',
  };
  const pendingResult = pendingAccessSchema.safeParse(validPendingAccess);
  assert(pendingResult.success, 'pendingAccessSchema accepts comma-escaped email keys from Firestore');

  const invalidPendingRole = {
    'user@example,com': 'superadmin',
  };
  assert(!pendingAccessSchema.safeParse(invalidPendingRole).success, 'pendingAccessSchema rejects invalid roles');

  // --- 2. Tests for UserSchema with photoURL and displayName variations ---
  console.log('\n[UserSchema Tests]');

  // Valid full URL
  const userWithUrl = {
    displayName: 'John Doe',
    email: 'john@example.com',
    photoURL: 'https://lh3.googleusercontent.com/a/default-user',
    role: 'admin',
  };
  assert(UserSchema.safeParse(userWithUrl).success, 'UserSchema accepts valid photoURL string');

  // Empty string photoURL (set by bg-accept-share.ts)
  const userWithEmptyPhoto = {
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    photoURL: '',
    role: 'editor',
  };
  assert(UserSchema.safeParse(userWithEmptyPhoto).success, 'UserSchema accepts empty string photoURL ("")');

  // Null photoURL (set by bg-journal-management.ts)
  const userWithNullPhoto = {
    displayName: 'Bob Smith',
    email: 'bob@example.com',
    photoURL: null,
    role: 'staff',
  };
  assert(UserSchema.safeParse(userWithNullPhoto).success, 'UserSchema accepts null photoURL');

  // Omitted (undefined) photoURL
  const userWithoutPhoto = {
    displayName: 'Alice',
    email: 'alice@example.com',
    role: 'viewer',
  };
  assert(UserSchema.safeParse(userWithoutPhoto).success, 'UserSchema accepts omitted photoURL');

  // Invalid photoURL format (not a URL and not empty string)
  const userWithInvalidPhoto = {
    displayName: 'Invalid User',
    email: 'invalid@example.com',
    photoURL: 'not-a-valid-url',
    role: 'viewer',
  };
  assert(!UserSchema.safeParse(userWithInvalidPhoto).success, 'UserSchema rejects non-URL non-empty photoURL string');

  // Null & empty displayName
  const userWithNullDisplayName = {
    displayName: null,
    email: 'noname@example.com',
    photoURL: null,
    role: 'viewer',
  };
  assert(UserSchema.safeParse(userWithNullDisplayName).success, 'UserSchema accepts null displayName');

  const userWithEmptyDisplayName = {
    displayName: '',
    email: 'emptyname@example.com',
    photoURL: '',
    role: 'viewer',
  };
  assert(UserSchema.safeParse(userWithEmptyDisplayName).success, 'UserSchema accepts empty string displayName');

  // Invalid email
  const userWithInvalidEmail = {
    displayName: 'Bad Email',
    email: 'not-an-email',
    role: 'viewer',
  };
  assert(!UserSchema.safeParse(userWithInvalidEmail).success, 'UserSchema rejects invalid email');

  // --- 3. Tests for JournalSchema on Firestore documents ---
  console.log('\n[JournalSchema Tests]');

  const fullFirestoreJournalDoc = {
    id: 'journal_12345678901234567890',
    title: 'Acme Enterprises Journal',
    journalType: 'business',
    access: {
      'uid_owner': {
        displayName: 'Owner User',
        email: 'owner@acme.com',
        photoURL: 'https://example.com/owner.png',
        role: 'admin',
      },
      'uid_editor': {
        displayName: '',
        email: 'editor@acme.com',
        photoURL: '',
        role: 'editor',
      },
      'uid_staff': {
        displayName: null,
        email: 'staff@acme.com',
        photoURL: null,
        role: 'staff',
      },
    },
    access_array: ['uid_owner', 'uid_editor', 'uid_staff'],
    pendingAccess: {
      'invitee@external,com': 'viewer',
      'consultant,name@agency,co,uk': 'editor',
    },
    details: {
      currency: 'USD',
      contactInfo: {
        name: 'Acme Corp',
        email: 'contact@acme.com',
        phone: '1234567890',
        address: {
          street: '123 Market St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
        },
      },
      logo: 'https://example.com/logo.png',
    },
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T12:00:00Z'),
  };

  const journalParseResult = JournalSchema.safeParse(fullFirestoreJournalDoc);
  assert(journalParseResult.success, 'JournalSchema successfully parses complete Firestore journal document');
  if (!journalParseResult.success) {
    console.error('Validation errors:', JSON.stringify(journalParseResult.error.issues, null, 2));
  }

  // Journal doc without pendingAccess and updatedAt
  const minimalJournalDoc = {
    title: 'Minimal Journal',
    journalType: 'business',
    access: {
      'uid_123': {
        email: 'user@test.com',
        role: 'admin',
      },
    },
    access_array: ['uid_123'],
    isActive: true,
    createdAt: new Date(),
  };
  assert(JournalSchema.safeParse(minimalJournalDoc).success, 'JournalSchema parses minimal valid journal document');

  // Strict check: reject unrecognized properties
  const journalDocWithExtraField = {
    ...minimalJournalDoc,
    unknownField: 'should-fail-due-to-strict',
  };
  assert(!JournalSchema.safeParse(journalDocWithExtraField).success, 'JournalSchema strict mode rejects unknown fields');

  // Soft-deleted journal document containing deletedAt and deletedBy
  const softDeletedJournalDoc = {
    ...minimalJournalDoc,
    isActive: false,
    deletedAt: new Date('2026-02-01T15:00:00Z'),
    deletedBy: 'uid_123',
    updatedAt: new Date('2026-02-01T15:00:00Z'),
  };
  assert(JournalSchema.safeParse(softDeletedJournalDoc).success, 'JournalSchema parses soft-deleted documents with deletedAt and deletedBy');

  // --- 4. Tests for traceSchema with string date coercion and Firestore Timestamps ---
  console.log('\n[traceSchema Tests]');
  const { traceSchema, firestoreDateSchema } = require('../lib/common/schemas/common_schemas');
  const traceDoc = {
    createdBy: 'uid_admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'uid_editor',
    updatedAt: '2026-01-02T10:00:00.000Z',
    deletedBy: 'uid_admin',
    deletedAt: '2026-01-03T12:00:00.000Z',
  };
  assert(traceSchema.safeParse(traceDoc).success, 'traceSchema coerces ISO timestamp strings to Dates');

  const traceWithTimestamps = {
    createdBy: 'uid_admin',
    createdAt: { seconds: 1767225600, nanoseconds: 0, toDate: () => new Date('2026-01-01T00:00:00.000Z') },
    updatedBy: 'uid_editor',
    updatedAt: { _seconds: 1767348000, _nanoseconds: 0 },
  };
  assert(traceSchema.safeParse(traceWithTimestamps).success, 'traceSchema parses Firestore Timestamp objects and serialized _seconds');

  // --- 5. Tests for firestoreDateSchema standalone ---
  console.log('\n[firestoreDateSchema Tests]');
  assert(firestoreDateSchema.safeParse(new Date()).success, 'firestoreDateSchema accepts Date instances');
  assert(firestoreDateSchema.safeParse('2026-08-30T14:00:00Z').success, 'firestoreDateSchema accepts ISO strings');
  assert(firestoreDateSchema.safeParse(1788100200000).success, 'firestoreDateSchema accepts numeric timestamps');
  assert(firestoreDateSchema.safeParse({ seconds: 1788100200, nanoseconds: 0 }).success, 'firestoreDateSchema accepts { seconds, nanoseconds }');
  assert(firestoreDateSchema.safeParse({ _seconds: 1788100200, _nanoseconds: 0 }).success, 'firestoreDateSchema accepts { _seconds, _nanoseconds }');
  assert(firestoreDateSchema.safeParse({ toDate: () => new Date() }).success, 'firestoreDateSchema accepts object with .toDate()');
  assert(!firestoreDateSchema.safeParse('invalid-date').success, 'firestoreDateSchema rejects invalid date strings');
  assert(!firestoreDateSchema.safeParse({ invalid: 'object' }).success, 'firestoreDateSchema rejects random invalid objects');

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
