const { flattenToDotNotation } = require('../lib/helpers/object-utils');
const { contactInfoSchema } = require('../lib/common/schemas/common_schemas');
const { businessDetailsSchema } = require('../lib/common/schemas/JournalSchema');
const { FieldValue } = require('firebase-admin/firestore');
const z = require('zod');

function runTests() {
  console.log('--- Running Tests for updateJournal & flattenToDotNotation ---\n');
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

  // Test 1: flattenToDotNotation basic nested
  const sample1 = {
    currency: 'USD',
    contactInfo: {
      name: 'Acme Corp',
      phone: '1234567890',
    },
  };
  const flattened1 = flattenToDotNotation(sample1, 'details');
  assert(
    flattened1['details.currency'] === 'USD' &&
    flattened1['details.contactInfo.name'] === 'Acme Corp' &&
    flattened1['details.contactInfo.phone'] === '1234567890',
    'Flattens nested objects into dot paths with prefix',
  );

  // Test 2: Field deletion with null
  const sample2 = {
    contactInfo: {
      phone: null,
      email: null,
    },
    logo: null,
  };
  const flattened2 = flattenToDotNotation(sample2, 'details');
  assert(
    flattened2['details.contactInfo.phone'] instanceof FieldValue &&
    flattened2['details.contactInfo.email'] instanceof FieldValue &&
    flattened2['details.logo'] instanceof FieldValue,
    'Converts null values into FieldValue.delete()',
  );

  // Test 3: Field deletion with empty string
  const sample3 = {
    contactInfo: {
      phone: '',
      email: '',
    },
  };
  const flattened3 = flattenToDotNotation(sample3, 'details');
  assert(
    flattened3['details.contactInfo.phone'] instanceof FieldValue &&
    flattened3['details.contactInfo.email'] instanceof FieldValue,
    'Converts empty string "" values into FieldValue.delete()',
  );

  // Test 4: Preserving undefined (omitted) fields
  const sample4 = {
    currency: 'BRL',
    contactInfo: {
      name: 'New Name',
      phone: undefined,
    },
    logo: undefined,
  };
  const flattened4 = flattenToDotNotation(sample4, 'details');
  assert(
    flattened4['details.currency'] === 'BRL' &&
    flattened4['details.contactInfo.name'] === 'New Name' &&
    !('details.contactInfo.phone' in flattened4) &&
    !('details.logo' in flattened4),
    'Ignores undefined fields to preserve existing values in Firestore',
  );

  // Test 5: Zod Schema validation for UpdateJournalPayloadSchema
  const UpdateJournalPayloadSchema = z.object({
    jid: z.string().min(1),
    title: z.string().min(1).optional(),
    details: businessDetailsSchema.deepPartial().optional(),
  });

  // Valid update with full payload
  const validFull = {
    jid: 'journal_abc123',
    title: 'Updated Business',
    details: {
      currency: 'USD',
      contactInfo: {
        name: 'John Doe',
        phone: '123-456-7890',
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
        },
      },
      logo: 'https://example.com/logo.png',
    },
  };
  assert(
    UpdateJournalPayloadSchema.safeParse(validFull).success,
    'Validates full update payload with jid',
  );

  // Valid update with partial payload and null fields
  const validPartialWithNulls = {
    jid: 'journal_abc123',
    details: {
      contactInfo: {
        phone: null,
        email: '',
      },
      logo: null,
    },
  };
  assert(
    UpdateJournalPayloadSchema.safeParse(validPartialWithNulls).success,
    'Validates partial payload with null and empty string fields',
  );

  // Invalid payload: missing jid
  const invalidNoJid = {
    title: 'Test',
    details: { currency: 'USD' },
  };
  assert(
    !UpdateJournalPayloadSchema.safeParse(invalidNoJid).success,
    'Rejects update payload missing required jid',
  );

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
