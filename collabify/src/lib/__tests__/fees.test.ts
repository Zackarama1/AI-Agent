import { describe, expect, it } from '@jest/globals';
import { feeFor, formatGBP, isUkUniversityEmail, meetsMinimumRate, minimumBudgetPence } from '../fees';

describe('fees', () => {
  it('charges the business on top and leaves the student whole (brief example)', () => {
    expect(feeFor(45000, 'free')).toEqual({ amountPence: 45000, feeRate: 0.12, feePence: 5400, totalPence: 50400 });
    expect(feeFor(45000, 'pro').totalPence).toBe(48600);
    expect(feeFor(45000, 'scale').totalPence).toBe(47250);
  });

  it('enforces the £12.71/hour minimum', () => {
    expect(minimumBudgetPence(10)).toBe(12710);
    expect(meetsMinimumRate(12710, 10)).toBe(true);
    expect(meetsMinimumRate(12709, 10)).toBe(false);
    expect(meetsMinimumRate(50000, 0)).toBe(false);
  });

  it('only accepts .ac.uk emails for students', () => {
    expect(isUkUniversityEmail('sam@leeds.ac.uk')).toBe(true);
    expect(isUkUniversityEmail('Sam@Student.Manchester.AC.UK')).toBe(true);
    expect(isUkUniversityEmail('sam@gmail.com')).toBe(false);
    expect(isUkUniversityEmail('sam@fakeac.uk')).toBe(false);
    expect(isUkUniversityEmail('sam@mit.edu')).toBe(false);
  });

  it('formats pounds', () => {
    expect(formatGBP(45000)).toBe('£450');
    expect(formatGBP(100800, { exact: true })).toBe('£1,008.00');
  });
});
