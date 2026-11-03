import { formatGBP, meetsMinimumRate, minimumBudgetPence } from './fees';
import type { NewProject, ProjectLevel, WorkMode } from './types';

/** Same rules as the database constraints on `projects`, so the app can explain them before posting. */
export function projectProblems(p: NewProject): string[] {
  const problems: string[] = [];
  if (p.title.trim().length < 5) problems.push('Give your project a clearer title');
  if (p.brief.trim().length < 30) problems.push('Add a bit more detail to the brief');
  const deliverables = p.deliverables.map((d) => d.trim()).filter(Boolean);
  if (deliverables.length === 0) problems.push('List at least one deliverable');
  if (deliverables.length > 8) problems.push('Keep it to 8 deliverables or fewer');
  if (!(p.estimatedHours > 0)) problems.push('Estimate how many hours this will take');
  else if (!meetsMinimumRate(p.budgetPence, p.estimatedHours)) {
    problems.push(`The minimum for ${p.estimatedHours} hours is ${formatGBP(minimumBudgetPence(p.estimatedHours), { exact: true })} (£12.71/hour)`);
  }
  if (p.workMode !== 'remote' && !p.city.trim()) problems.push('Say which city the work happens in');
  return problems;
}

export const LEVEL_LABEL: Record<ProjectLevel, string> = { beginner: 'Beginner friendly', intermediate: 'Some experience', advanced: 'Experienced' };
export const MODE_LABEL: Record<WorkMode, string> = { remote: 'Remote', hybrid: 'Hybrid', in_person: 'In person' };

export function whereLabel(p: { workMode: WorkMode; city: string }) {
  return p.workMode === 'remote' ? 'Remote · UK' : `${MODE_LABEL[p.workMode]} · ${p.city}`;
}
