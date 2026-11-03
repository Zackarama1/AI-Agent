import type { CompanySize, Student, StudentPrivate } from './types';

/** How ready a student's profile is to win work (0–1), and the most useful next step. */
export function studentStrength(s: Pick<Student, 'skills' | 'bio' | 'course' | 'portfolioUrl'>, priv: Pick<StudentPrivate, 'payoutsEnabled'>) {
  // Ordered by impact: you can't be paid without payouts, and matching runs on skills.
  const checks: [boolean, string][] = [
    [priv.payoutsEnabled, 'Set up payouts so you can get paid'],
    [s.skills.length >= 3, 'Add at least 3 skills for better matches'],
    [s.bio.trim().length >= 40, 'Write a short bio'],
    [Boolean(s.course.trim()), 'Add your course'],
    [Boolean(s.portfolioUrl.trim()), 'Link your portfolio'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { score: done / checks.length, next: checks.find(([ok]) => !ok)?.[1] ?? null };
}

export type CompanyForm = { companyName: string; website: string; industry: string; companySize: CompanySize; location: string; about: string };

/** How complete a company profile is (0–1) and what to add next. */
export function companyCompleteness(f: CompanyForm) {
  const checks: [boolean, string][] = [
    [Boolean(f.industry), 'Add your industry'],
    [Boolean(f.companySize), 'Add your team size'],
    [Boolean(f.location.trim()), 'Add where you’re based'],
    [f.about.trim().length >= 40, 'Tell students what you do'],
    [Boolean(f.website.trim()), 'Add your website'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { score: done / checks.length, next: checks.find(([ok]) => !ok)?.[1] ?? null };
}

