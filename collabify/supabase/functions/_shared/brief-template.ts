/**
 * Template brief writer, shared by the app (offline/demo) and the write-brief Edge Function
 * (fallback when the AI is unavailable). Self-contained: no imports, so both Metro and Deno can load it.
 */
export type TemplateBrief = { title: string; brief: string; skills: string[]; estimatedHours: number; durationDays: number };

const DEFAULTS: Record<string, { skills: string[]; hours: number; days: number; deliverables: string[] }> = {
  Design: { skills: ['Figma', 'Branding', 'Illustrator'], hours: 15, days: 10, deliverables: ['2–3 initial concepts', 'One refined final design', 'Source files and exports (SVG, PNG)'] },
  Development: { skills: ['React', 'JavaScript', 'CSS'], hours: 25, days: 14, deliverables: ['Working code in a shared repository', 'Deployed preview link', 'Short handover notes'] },
  Marketing: { skills: ['Marketing', 'Copywriting', 'SEO'], hours: 15, days: 14, deliverables: ['A short plan', 'Ready-to-use copy and assets', 'Results summary'] },
  'Social media': { skills: ['Social media', 'Canva', 'Copywriting'], hours: 20, days: 14, deliverables: ['Content calendar', 'Posts ready to publish', 'Captions and hashtags'] },
  Writing: { skills: ['Copywriting', 'SEO', 'Research'], hours: 12, days: 10, deliverables: ['Drafts for review', 'One round of edits', 'Final copy'] },
  Research: { skills: ['Research', 'Excel', 'Analysis'], hours: 12, days: 7, deliverables: ['Spreadsheet of findings', 'One-page summary', 'Recommendations'] },
  Data: { skills: ['Excel', 'Python', 'Data analysis'], hours: 15, days: 10, deliverables: ['Cleaned dataset', 'Dashboard or charts', 'Summary of insights'] },
  Video: { skills: ['Video editing', 'Premiere Pro', 'Storyboarding'], hours: 20, days: 14, deliverables: ['Storyboard', 'First cut for feedback', 'Final export'] },
};

/** Template brief writer. Used offline and as the fallback when the AI brief writer is unavailable. */
export function templateBrief(idea: string, category: string): TemplateBrief {
  const d = DEFAULTS[category] ?? DEFAULTS.Research;
  const clean = idea.trim().replace(/\.$/, '');
  const title = clean.length > 70 ? `${clean.slice(0, 67)}…` : clean.charAt(0).toUpperCase() + clean.slice(1);
  const brief = [
    `What we need\n${clean.charAt(0).toUpperCase() + clean.slice(1)}.`,
    `Deliverables\n${d.deliverables.map((x) => `• ${x}`).join('\n')}`,
    'How we’ll work\nA short kick-off call, a check-in halfway, and feedback within 48 hours of delivery.',
  ].join('\n\n');
  return { title, brief, skills: d.skills, estimatedHours: d.hours, durationDays: d.days };
}

