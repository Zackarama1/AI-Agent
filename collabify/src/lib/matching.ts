import type { Project, Student } from './types';

/** 0–100: how well a student fits a project. Skills dominate; trust signals add a little. */
export function matchScore(project: Pick<Project, 'skills'>, student: Pick<Student, 'skills' | 'rating' | 'completedCount'>) {
  const wanted = new Set(project.skills.map((s) => s.toLowerCase()));
  const has = new Set(student.skills.map((s) => s.toLowerCase()));
  const overlap = wanted.size ? [...wanted].filter((s) => has.has(s)).length / wanted.size : 0;
  let score = overlap * 80;
  if (student.rating.average) score += (student.rating.average / 5) * 12;
  score += Math.min(student.completedCount, 8);
  return Math.round(Math.min(score, 100));
}
