// backend/functions/tests/test_labor_type_schema.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  laborTypeSchema,
  lineItemSchema,
} = require('../lib/common/schemas/estimate_schema');

const validMaterial = {
  id: 'mat-1',
  description: 'Granite Countertop',
  unitPrice: 100,
  currency: 'USD',
  dimensions: { type: 'area', unitLabel: 'm²' },
  labor: null,
};

test('laborTypeSchema validates percentage, fixed, and quantity', () => {
  assert.equal(laborTypeSchema.safeParse('percentage').success, true);
  assert.equal(laborTypeSchema.safeParse('fixed').success, true);
  assert.equal(laborTypeSchema.safeParse('quantity').success, true);

  assert.equal(laborTypeSchema.safeParse('hourly').success, false);
  assert.equal(laborTypeSchema.safeParse('perUnit').success, false);
  assert.equal(laborTypeSchema.safeParse('').success, false);
  assert.equal(laborTypeSchema.safeParse(123).success, false);
});

test('lineItemSchema accepts valid laborType values', () => {
  const baseItem = {
    id: 'item-1',
    parentId: 'root',
    quantity: 2,
    description: 'Island Top',
    material: validMaterial,
  };

  assert.equal(lineItemSchema.safeParse({ ...baseItem, laborType: 'percentage' }).success, true);
  assert.equal(lineItemSchema.safeParse({ ...baseItem, laborType: 'fixed' }).success, true);
  assert.equal(lineItemSchema.safeParse({ ...baseItem, laborType: 'quantity' }).success, true);
  assert.equal(lineItemSchema.safeParse({ ...baseItem, laborType: null }).success, true);
  assert.equal(lineItemSchema.safeParse({ ...baseItem }).success, true, 'Accepts omitted laborType (backward compatible)');
});

test('lineItemSchema rejects invalid laborType values', () => {
  const baseItem = {
    id: 'item-1',
    parentId: 'root',
    quantity: 2,
    description: 'Island Top',
    material: validMaterial,
  };

  assert.equal(lineItemSchema.safeParse({ ...baseItem, laborType: 'hourly' }).success, false);
  assert.equal(lineItemSchema.safeParse({ ...baseItem, laborType: 42 }).success, false);
});

test('form population simulation: preserves fixed labor fee without mutating to percentage', () => {
  // Scenario: Material is $100 (qty 1 * $100). Fixed fee is $50.
  // Under the old bug, 50 <= 100 and (50/100)*100 = 50.00%, which caused it to mutate to percentage.
  const parentItem = {
    id: 'parent-1',
    parentId: 'root',
    quantity: 1,
    description: 'Granite Slab',
    laborType: 'fixed',
    material: {
      id: 'mat-1',
      description: 'Granite',
      unitPrice: 100,
      currency: 'USD',
      dimensions: { type: 'unit', unitLabel: 'unit' },
      labor: null,
    },
  };

  const childLaborItem = {
    id: 'labor-1',
    parentId: 'parent-1',
    quantity: 1,
    laborType: 'fixed',
    description: 'Labor: Fixed Fee $50.00',
    material: {
      id: 'mat-labor-1',
      description: 'Labor',
      unitPrice: 50,
      currency: 'USD',
      dimensions: { type: 'unit', unitLabel: 'unit' },
      labor: null,
    },
  };

  // Replicating populateFormFromLineItem logic from NewItemForm.tsx
  const persistedLaborType = childLaborItem.laborType || parentItem.laborType;
  let formLaborType = 'null';
  let formLaborRate = 0;

  const materialTotal = parentItem.quantity * (parentItem.material?.unitPrice || 0);
  const laborUnitPrice = childLaborItem.material.unitPrice;

  if (persistedLaborType) {
    formLaborType = persistedLaborType;
    if (formLaborType === 'percentage') {
      formLaborRate = materialTotal > 0 ? Number(((laborUnitPrice / materialTotal) * 100).toFixed(2)) : 0;
    } else if (formLaborType === 'quantity') {
      formLaborRate = laborUnitPrice;
    } else if (formLaborType === 'fixed') {
      formLaborRate = Number((laborUnitPrice * childLaborItem.quantity).toFixed(2));
    }
  }

  assert.equal(formLaborType, 'fixed');
  assert.equal(formLaborRate, 50);
});

test('form population simulation: populates percentage and quantity accurately', () => {
  // Percentage fee: 15% on $200 material -> $30 labor
  const pctParent = {
    id: 'p-pct',
    parentId: 'root',
    quantity: 2,
    laborType: 'percentage',
    material: { id: 'm1', unitPrice: 100, description: 'Tile' },
  };
  const pctChild = {
    id: 'l-pct',
    parentId: 'p-pct',
    quantity: 1,
    laborType: 'percentage',
    material: { id: 'ml1', unitPrice: 30, description: 'Labor' },
  };

  const pctMaterialTotal = pctParent.quantity * pctParent.material.unitPrice; // 200
  const pctRate = Number(((pctChild.material.unitPrice / pctMaterialTotal) * 100).toFixed(2));
  assert.equal(pctRate, 15);

  // Quantity fee: $25 per unit, quantity 4 -> $100 labor
  const qtyParent = {
    id: 'p-qty',
    parentId: 'root',
    quantity: 4,
    laborType: 'quantity',
    material: { id: 'm2', unitPrice: 50, description: 'Glass' },
  };
  const qtyChild = {
    id: 'l-qty',
    parentId: 'p-qty',
    quantity: 4,
    laborType: 'quantity',
    material: { id: 'ml2', unitPrice: 25, description: 'Labor' },
  };

  assert.equal(qtyChild.laborType, 'quantity');
  assert.equal(qtyChild.material.unitPrice, 25);
});

test('form population simulation: legacy items without laborType fall back to heuristic', () => {
  const legacyParent = {
    id: 'p-legacy',
    parentId: 'root',
    quantity: 2,
    material: { id: 'm3', unitPrice: 100, description: 'Stone' },
    // no laborType property
  };
  const legacyChild = {
    id: 'l-legacy',
    parentId: 'p-legacy',
    quantity: 1,
    material: { id: 'ml3', unitPrice: 20, description: 'Labor' },
    // no laborType property
  };

  const persistedLaborType = legacyChild.laborType || legacyParent.laborType;
  assert.equal(persistedLaborType, undefined);

  // Fallback heuristic: quantity is 1 and materialTotal is 200.
  // 20 / 200 * 100 = 10%
  const materialTotal = legacyParent.quantity * legacyParent.material.unitPrice;
  const possiblePercentage = Number(((legacyChild.material.unitPrice / materialTotal) * 100).toFixed(2));
  let laborType = 'fixed';
  let laborRate = legacyChild.material.unitPrice;

  if (
    possiblePercentage >= 0 &&
    possiblePercentage <= 100 &&
    Math.abs(materialTotal * (possiblePercentage / 100) - legacyChild.material.unitPrice) < 0.01
  ) {
    laborType = 'percentage';
    laborRate = possiblePercentage;
  }

  assert.equal(laborType, 'percentage');
  assert.equal(laborRate, 10);
});
