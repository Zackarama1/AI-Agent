import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPayment } from '../src/lib/money.js';
import { matchScore } from '../src/lib/matching.js';
import { isAcademicEmail } from '../src/routes/verification.js';

test('15% commission split is exact in pence', () => {
  assert.deepEqual(splitPayment(50000, 0.15), { amountPence: 50000, commissionPence: 7500, payoutPence: 42500 });
  const odd = splitPayment(3333, 0.15);
  assert.equal(odd.commissionPence + odd.payoutPence, 3333);
  assert.throws(() => splitPayment(0, 0.15));
  assert.throws(() => splitPayment(100, 1));
});

test('match score rewards skill overlap and trust signals', () => {
  const base = { jobSkills: ['React', 'Figma'], verified: false, avgRating: null, completedCount: 0 };
  assert.equal(matchScore({ ...base, studentSkills: [] }), 0);
  assert.equal(matchScore({ ...base, studentSkills: ['react'] }), 35);
  assert.equal(matchScore({ ...base, studentSkills: ['React', 'Figma'] }), 70);
  assert.ok(matchScore({ ...base, studentSkills: ['React', 'Figma'], verified: true, avgRating: 5, completedCount: 20 }) <= 100);
});

test('academic email detection', () => {
  assert.ok(isAcademicEmail('jo@ucl.ac.uk'));
  assert.ok(isAcademicEmail('sam@mit.edu'));
  assert.ok(!isAcademicEmail('sam@gmail.com'));
  assert.ok(!isAcademicEmail('sam@fakeedu.com'));
});
