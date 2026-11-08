// backend/functions/tests/test_postal_code_schema.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  POSTAL_CODE_REGEX,
  contactInfoSchema,
} = require('../lib/common/schemas/common_schemas');

test('POSTAL_CODE_REGEX matches valid US ZIP formats', () => {
  assert.equal(POSTAL_CODE_REGEX.test('12345'), true, '5-digit US ZIP');
  assert.equal(POSTAL_CODE_REGEX.test('12345-6789'), true, '9-digit US ZIP with hyphen');
  assert.equal(POSTAL_CODE_REGEX.test('123456789'), true, '9-digit US ZIP without hyphen');
  assert.equal(POSTAL_CODE_REGEX.test('90210'), true, 'Beverly Hills 90210');
  assert.equal(POSTAL_CODE_REGEX.test('10001-0001'), true, 'NYC ZIP+4');
});

test('POSTAL_CODE_REGEX matches valid Brazilian CEP formats', () => {
  assert.equal(POSTAL_CODE_REGEX.test('01310-100'), true, '8-digit Brazilian CEP with hyphen');
  assert.equal(POSTAL_CODE_REGEX.test('01310100'), true, '8-digit Brazilian CEP without hyphen');
  assert.equal(POSTAL_CODE_REGEX.test('20040-002'), true, 'Rio de Janeiro CEP');
  assert.equal(POSTAL_CODE_REGEX.test('70040900'), true, 'Brasilia CEP unhyphenated');
});

test('POSTAL_CODE_REGEX rejects invalid postal codes and CEPs', () => {
  // Trailing hyphens
  assert.equal(POSTAL_CODE_REGEX.test('12345-'), false, 'Trailing hyphen on 5-digit');
  assert.equal(POSTAL_CODE_REGEX.test('01310-'), false, 'Trailing hyphen on CEP prefix');

  // Incomplete / partial suffixes
  assert.equal(POSTAL_CODE_REGEX.test('12345-1'), false, '1-digit suffix');
  assert.equal(POSTAL_CODE_REGEX.test('12345-12'), false, '2-digit suffix');
  assert.equal(POSTAL_CODE_REGEX.test('01310-1'), false, '1-digit CEP suffix');
  assert.equal(POSTAL_CODE_REGEX.test('01310-12'), false, '2-digit CEP suffix');

  // Length anomalies
  assert.equal(POSTAL_CODE_REGEX.test('1234'), false, '4-digit code');
  assert.equal(POSTAL_CODE_REGEX.test('1234567'), false, '7-digit code');
  assert.equal(POSTAL_CODE_REGEX.test('1234567890'), false, '10-digit code');
  assert.equal(POSTAL_CODE_REGEX.test('12345-12345'), false, '5-digit suffix');
  assert.equal(POSTAL_CODE_REGEX.test('01310-10000'), false, '5-digit suffix');

  // Alphabetic and special characters
  assert.equal(POSTAL_CODE_REGEX.test('abcde'), false, 'Letters');
  assert.equal(POSTAL_CODE_REGEX.test('12345-abcd'), false, 'Letter suffix');
  assert.equal(POSTAL_CODE_REGEX.test('01310-10A'), false, 'Alphanumeric CEP');
  assert.equal(POSTAL_CODE_REGEX.test('!@#$%'), false, 'Symbols');
});

test('contactInfoSchema validates both US ZIP and Brazilian CEP in contact address', () => {
  const baseContact = {
    name: 'Acme Corporation',
    email: 'info@acme.com',
    phone: '555-123-4567',
  };

  // Valid with US ZIP
  const resUS = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
    },
  });
  assert.equal(resUS.success, true);

  // Valid with US ZIP+4
  const resUSPlus4 = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701-1234',
    },
  });
  assert.equal(resUSPlus4.success, true);

  // Valid with Brazilian CEP
  const resBR = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: 'Avenida Paulista 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
    },
  });
  assert.equal(resBR.success, true);

  // Valid with Brazilian CEP unhyphenated
  const resBRUnhyphenated = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: 'Avenida Paulista 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310100',
    },
  });
  assert.equal(resBRUnhyphenated.success, true);

  // Valid with empty string / null / undefined zipCode
  const resEmpty = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '',
    },
  });
  assert.equal(resEmpty.success, true);

  const resNull = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: null,
    },
  });
  assert.equal(resNull.success, true);

  // Rejects invalid zipCode
  const resInvalid = contactInfoSchema.safeParse({
    ...baseContact,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '12345-',
    },
  });
  assert.equal(resInvalid.success, false);
});
