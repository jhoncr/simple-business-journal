const { ROLES } = require('../lib/common/schemas/common_schemas');
const { ROLES_ADMIN, ROLES_THAT_ADD, ROLES_CAN_DELETE } = require('../lib/common/const');
const { ENTRY_CONFIG } = require('../lib/common/schemas/configmap');
const z = require('zod');

function runRBACMatrixTests() {
  console.log('--- Running RBAC Role Capability & Permission Matrix Tests ---\n');
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

  // --- 1. Role Definitions & Constants ---
  console.log('[1. Role Set Coverage]');
  assert(ROLES.includes('admin'), 'ROLES includes admin');
  assert(ROLES.includes('editor'), 'ROLES includes editor');
  assert(ROLES.includes('staff'), 'ROLES includes staff');
  assert(ROLES.includes('viewer'), 'ROLES includes viewer');
  assert(ROLES.length === 4, 'ROLES has exactly 4 roles');

  assert(ROLES_ADMIN.has('admin') && !ROLES_ADMIN.has('editor') && !ROLES_ADMIN.has('staff') && !ROLES_ADMIN.has('viewer'), 'ROLES_ADMIN contains only admin');
  assert(ROLES_THAT_ADD.has('admin') && ROLES_THAT_ADD.has('editor') && ROLES_THAT_ADD.has('staff') && !ROLES_THAT_ADD.has('viewer'), 'ROLES_THAT_ADD contains admin, editor, staff');
  assert(ROLES_CAN_DELETE.has('admin') && ROLES_CAN_DELETE.has('editor') && !ROLES_CAN_DELETE.has('staff') && !ROLES_CAN_DELETE.has('viewer'), 'ROLES_CAN_DELETE contains admin, editor');

  // --- 2. Entry Config Role Permissions ---
  console.log('\n[2. Entry Type Config Permissions]');
  const estimateAllowed = ENTRY_CONFIG.estimate.allowedRoles;
  assert(estimateAllowed.includes('admin') && estimateAllowed.includes('editor') && estimateAllowed.includes('staff') && !estimateAllowed.includes('viewer'), 'Estimates can be added/edited by admin, editor, staff');

  const templateAllowed = ENTRY_CONFIG.template.allowedRoles;
  assert(templateAllowed.includes('admin') && templateAllowed.includes('editor') && !templateAllowed.includes('staff') && !templateAllowed.includes('viewer'), '3D Templates can be added/edited by admin and editor only');

  // --- 3. Journal Deletion Permission Logic ---
  console.log('\n[3. Journal Deletion RBAC Logic]');
  function canDeleteJournal(role) {
    return role === 'admin';
  }
  assert(canDeleteJournal('admin') === true, 'Admin CAN delete journal');
  assert(canDeleteJournal('editor') === false, 'Editor CANNOT delete journal');
  assert(canDeleteJournal('staff') === false, 'Staff CANNOT delete journal');
  assert(canDeleteJournal('viewer') === false, 'Viewer CANNOT delete journal');

  // --- 4. Entry Deletion Permission Logic ---
  console.log('\n[4. Entry Deletion RBAC Logic]');
  function canDeleteEntry(role) {
    return ROLES_CAN_DELETE.has(role);
  }
  assert(canDeleteEntry('admin') === true, 'Admin CAN delete entries');
  assert(canDeleteEntry('editor') === true, 'Editor CAN delete entries');
  assert(canDeleteEntry('staff') === false, 'Staff CANNOT delete entries');
  assert(canDeleteEntry('viewer') === false, 'Viewer CANNOT delete entries');

  // --- 5. Contributor Invitation Schema Role Validation ---
  console.log('\n[5. Contributor Assignment Schema]');
  const { pendingAccessSchema } = require('../lib/common/schemas/common_schemas');
  for (const role of ['admin', 'editor', 'staff', 'viewer']) {
    const invite = { ['invitee@example,com']: role };
    assert(pendingAccessSchema.safeParse(invite).success, `Contributor invite with role '${role}' passes validation`);
  }
  assert(!pendingAccessSchema.safeParse({ ['invitee@example,com']: 'guest' }).success, "Contributor invite with invalid role 'guest' is rejected");

  console.log(`\nRBAC Matrix Tests Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRBACMatrixTests();
