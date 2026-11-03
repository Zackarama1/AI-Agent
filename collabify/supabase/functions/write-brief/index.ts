// Turn a rough idea into a structured project brief with Claude.
// Falls back to a template when ANTHROPIC_API_KEY is not set or the model declines.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { templateBrief } from '../_shared/brief-template.ts';

const BriefSchema = z.object({
  title: z.string().describe('Short project title, max 70 characters'),
  brief: z.string().describe('Two short paragraphs: what the business needs and why, then how the work will run. No headings, no bullet lists.'),
  deliverables: z.array(z.string()).describe('2 to 5 concrete things the student hands over, each under 60 characters'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).describe('Experience a student needs'),
  skills: z.array(z.string()).describe('2 to 5 skills a student needs'),
  estimatedHours: z.number().describe('Realistic hours for a capable university student'),
  durationDays: z.number().describe('Calendar days to complete'),
});

const SYSTEM = `You write project briefs for Collabify, a UK marketplace where startups hire university students for short, paid, remote projects.
Turn the business's rough idea into a clear brief a student can act on. Plain British English, friendly and concrete, under 150 words in the brief.
Scope it so a student can finish it in 5 to 60 hours. Don't invent facts about the business; where details are missing, describe what the student should ask about.`;

serve(async (req) => {
  const user = await requireUser(req);
  const { data: business } = await adminClient().from('businesses').select('id').eq('id', user.id).maybeSingle();
  if (!business) throw new HttpError(403, 'Only businesses can write briefs');

  const { idea, category } = await req.json();
  if (typeof idea !== 'string' || idea.trim().length < 8 || idea.length > 1000) throw new HttpError(400, 'Describe your idea in a sentence');
  const cat = typeof category === 'string' ? category.slice(0, 40) : 'Other';

  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json(templateBrief(idea, cat));

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the Edge Function secrets
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(BriefSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Category: ${cat}\nIdea: ${idea.trim()}` }],
    });
    const brief = response.stop_reason !== 'refusal' ? response.parsed_output : null;
    if (!brief) return json(templateBrief(idea, cat));
    return json({
      title: brief.title.slice(0, 120),
      brief: brief.brief,
      skills: brief.skills.slice(0, 5),
      deliverables: brief.deliverables.slice(0, 8),
      level: brief.level,
      estimatedHours: Math.max(1, Math.round(brief.estimatedHours)),
      durationDays: Math.min(180, Math.max(1, Math.round(brief.durationDays))),
    });
  } catch (e) {
    console.error('write-brief: falling back to template', e);
    return json(templateBrief(idea, cat));
  }
});
