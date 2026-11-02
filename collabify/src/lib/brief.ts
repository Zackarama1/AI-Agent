export const CATEGORIES = [
  'Design', 'Development', 'Marketing', 'Social media', 'Writing', 'Research', 'Data', 'Video',
] as const;

export const TEMPLATES: { category: (typeof CATEGORIES)[number]; idea: string }[] = [
  { category: 'Design', idea: 'A logo and simple brand kit for my new business' },
  { category: 'Development', idea: 'A landing page with an email sign-up form' },
  { category: 'Social media', idea: 'Two weeks of Instagram and TikTok posts' },
  { category: 'Research', idea: 'Research 10 competitors and summarise their pricing' },
  { category: 'Data', idea: 'Clean up our sales spreadsheet and build a simple dashboard' },
  { category: 'Writing', idea: 'Four blog posts for our website' },
];

export { templateBrief } from '../../supabase/functions/_shared/brief-template';

export const SKILL_OPTIONS = [
  'Figma', 'Branding', 'React', 'JavaScript', 'Python', 'Excel', 'Data analysis', 'Research',
  'Copywriting', 'SEO', 'Social media', 'TikTok', 'Canva', 'Video editing', 'Illustrator', 'CSS',
];
