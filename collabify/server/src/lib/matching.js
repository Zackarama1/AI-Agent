/**
 * Score how well a student fits a job (0-100).
 * Skill overlap is the dominant signal; verification, rating and track record add trust.
 */
export function matchScore({ jobSkills, studentSkills, verified, avgRating, completedCount }) {
  const job = new Set(jobSkills.map((s) => s.toLowerCase()));
  const student = new Set(studentSkills.map((s) => s.toLowerCase()));
  const overlap = job.size === 0 ? 0 : [...job].filter((s) => student.has(s)).length / job.size;

  let score = overlap * 70;
  if (verified) score += 10;
  if (avgRating) score += (avgRating / 5) * 12;
  score += Math.min(completedCount || 0, 8);
  return Math.round(Math.min(score, 100));
}
