import { describe, expect, it } from '@jest/globals';
import { contractFlow, type FlowAction, type Viewer } from '../contractFlow';
import type { ContractStatus } from '../types';

const STATUSES: ContractStatus[] = ['awaiting_funding', 'funded', 'delivered', 'released', 'disputed', 'refunded', 'cancelled'];
const VIEWERS: Viewer[] = ['student', 'business', 'admin'];
const base = {
  amountPence: 45000, totalPence: 50400, autoReleaseAt: null as string | null, revisionCount: 0,
  companyName: 'Brewbox', studentName: 'Maya Patel',
};
const actions = (status: ContractStatus, viewer: Viewer, extra = {}) => {
  const f = contractFlow({ ...base, status, ...extra }, viewer);
  return [f.primary, ...f.secondary].filter(Boolean) as FlowAction[];
};

describe('contract flow', () => {
  it('gives every status a headline for every viewer', () => {
    for (const s of STATUSES) for (const v of VIEWERS) {
      const f = contractFlow({ ...base, status: s }, v);
      expect(f.headline.length).toBeGreaterThan(3);
      expect(f.detail.length).toBeGreaterThan(3);
    }
  });

  it('only lets each side do its own part', () => {
    for (const s of STATUSES) {
      const student = actions(s, 'student');
      const business = actions(s, 'business');
      const admin = actions(s, 'admin');
      for (const a of ['fund', 'approve', 'requestChanges', 'cancelHire', 'resolve'] as FlowAction[]) expect(student).not.toContain(a);
      for (const a of ['deliver', 'resolve'] as FlowAction[]) expect(business).not.toContain(a);
      expect(admin.filter((a) => a !== 'resolve')).toEqual([]);
      if (admin.includes('resolve')) expect(s).toBe('disputed');
    }
  });

  it('only allows reporting a problem while money is held', () => {
    for (const s of STATUSES) for (const v of VIEWERS) {
      if (actions(s, v).includes('reportProblem')) expect(['funded', 'delivered']).toContain(s);
    }
  });

  it('puts the next move on the right person', () => {
    expect(contractFlow({ ...base, status: 'awaiting_funding' }, 'business')).toMatchObject({ primary: 'fund', waitingOn: 'business', tone: 'action' });
    expect(contractFlow({ ...base, status: 'funded' }, 'student')).toMatchObject({ primary: 'deliver', waitingOn: 'student' });
    expect(contractFlow({ ...base, status: 'delivered' }, 'business')).toMatchObject({ primary: 'approve', waitingOn: 'business' });
    expect(contractFlow({ ...base, status: 'disputed' }, 'student')).toMatchObject({ primary: null, waitingOn: 'collabify', tone: 'problem' });
  });

  it('tells the business the full amount they will pay, and the student the full price', () => {
    expect(contractFlow({ ...base, status: 'awaiting_funding' }, 'business').detail).toContain('£504.00');
    expect(contractFlow({ ...base, status: 'funded' }, 'student').detail).toContain('£450');
    expect(contractFlow({ ...base, status: 'released' }, 'student').headline).toBe('You’ve been paid £450');
  });

  it('counts down auto-release', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    const f = contractFlow({ ...base, status: 'delivered', autoReleaseAt: '2026-11-06T09:00:00Z' }, 'business', { now });
    expect(f.autoReleaseInDays).toBe(3);
    expect(f.detail).toContain('in 3 days');
    expect(contractFlow({ ...base, status: 'delivered', autoReleaseAt: '2026-11-03T18:00:00Z' }, 'student', { now }).detail).toContain('in 1 day');
  });

  it('asks for a review once, never from admins', () => {
    expect(contractFlow({ ...base, status: 'released' }, 'student').primary).toBe('review');
    expect(contractFlow({ ...base, status: 'released' }, 'student', { hasReviewed: true }).primary).toBeNull();
    expect(contractFlow({ ...base, status: 'released' }, 'admin').primary).toBeNull();
  });

  it('mentions requested changes', () => {
    expect(contractFlow({ ...base, status: 'funded', revisionCount: 1 }, 'student').headline).toBe('Deliver the changes');
    expect(contractFlow({ ...base, status: 'funded', revisionCount: 1 }, 'business').headline).toBe('Changes requested');
  });

  it('hides progress for closed projects', () => {
    expect(contractFlow({ ...base, status: 'cancelled' }, 'student').showProgress).toBe(false);
    expect(contractFlow({ ...base, status: 'refunded' }, 'business').showProgress).toBe(false);
  });
});
