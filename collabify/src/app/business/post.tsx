import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { FeeBreakdown } from '@/components/domain';
import { useFeedback } from '@/components/feedback';
import { FadeIn } from '@/components/motion';
import { Body, Button, Card, Chip, ErrorText, Field, Gap, Heading, Label, Muted, Row, Screen } from '@/components/ui';
import { getApi } from '@/lib/api';
import { CATEGORIES, SKILL_OPTIONS, TEMPLATES } from '@/lib/brief';
import { formatGBP, hourlyRatePence, meetsMinimumRate, minimumBudgetPence } from '@/lib/fees';
import { LEVEL_LABEL, MODE_LABEL, projectProblems } from '@/lib/projectRules';
import { useMe } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { NewProject, ProjectLevel, WorkMode } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

type Form = {
  idea: string; title: string; category: string; brief: string; hours: string; budget: string; days: string;
  skills: string[]; deliverables: string[]; level: ProjectLevel; workMode: WorkMode; city: string;
};
const EMPTY: Form = {
  idea: '', title: '', category: 'Design', brief: '', hours: '', budget: '', days: '14',
  skills: [], deliverables: [''], level: 'intermediate', workMode: 'remote', city: '',
};

function DeliverablesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Label style={{ marginBottom: space.sm }}>Deliverables</Label>
      <Muted style={{ fontSize: 13, marginBottom: space.md }}>What the student hands over. This is the checklist the work is judged against.</Muted>
      {value.map((d, i) => (
        <Row key={i} style={{ marginBottom: space.sm }}>
          <Ionicons name="checkmark-circle" size={20} color={d.trim() ? colors.money : colors.border} />
          <TextInput
            testID={`deliverable-${i}`}
            value={d}
            onChangeText={(t) => onChange(value.map((x, j) => (j === i ? t : x)))}
            placeholder={i === 0 ? 'e.g. Final logo files (SVG, PNG)' : 'Another deliverable'}
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 48 }}
          />
          {value.length > 1 ? (
            <Pressable accessibilityLabel="Remove deliverable" hitSlop={8} onPress={() => onChange(value.filter((_, j) => j !== i))}>
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Row>
      ))}
      {value.length < 8 ? (
        <Button testID="add-deliverable" small variant="ghost" icon="add" title="Add deliverable" onPress={() => onChange([...value, ''])} style={{ alignSelf: 'flex-start' }} />
      ) : null}
    </View>
  );
}

export default function PostProject() {
  const me = useMe();
  const { colors } = useTheme();
  const { toast, celebrate } = useFeedback();
  const { data: business } = useQuery((api) => api.getBusiness(me.id), [me.id]);
  const [f, setF] = useState<Form>(EMPTY);
  const [tried, setTried] = useState(false);
  const writer = useAction();
  const submit = useAction();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const hours = Number(f.hours) || 0;
  const budgetPence = Math.round((Number(f.budget) || 0) * 100);
  const minPence = minimumBudgetPence(hours);
  const tooLow = hours > 0 && budgetPence > 0 && !meetsMinimumRate(budgetPence, hours);
  const plan = business?.plan ?? 'free';
  const draft: NewProject = {
    title: f.title, category: f.category, brief: f.brief, budgetPence, estimatedHours: hours, durationDays: Number(f.days) || 14,
    skills: f.skills, deliverables: f.deliverables, level: f.level, workMode: f.workMode, city: f.city,
  };
  const problems = projectProblems(draft);

  const writeBrief = () =>
    writer.run(async () => {
      if (f.idea.trim().length < 8) throw new Error('Describe your idea in a sentence first');
      const b = await getApi().writeBrief(f.idea, f.category);
      setF((x) => ({
        ...x, title: b.title, brief: b.brief, skills: b.skills, deliverables: b.deliverables.length ? b.deliverables : [''], level: b.level,
        hours: String(b.estimatedHours), days: String(b.durationDays),
        budget: x.budget || String(Math.ceil((b.estimatedHours * 1271) / 100 / 5) * 5),
      }));
      toast('Brief drafted. Check it reads right.', 'sparkles');
    });

  const post = () =>
    submit.run(async () => {
      setTried(true);
      if (problems.length) throw new Error(problems[0]);
      const firstProject = (await getApi().listMyProjects()).length === 0;
      const p = await getApi().createProject(draft);
      setF(EMPTY);
      setTried(false);
      router.push(`/project/${p.id}`);
      if (firstProject) celebrate({ title: 'Your first project is live', subtitle: 'Verified students can apply now. We’ll notify you as they do.', icon: 'rocket' });
      else toast('Project posted', 'rocket');
    });

  return (
    <Screen title="Post a project" subtitle="Describe it in a sentence. We'll write the brief.">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginBottom: space.lg }} contentContainerStyle={{ paddingHorizontal: space.xl }}>
        <Row>
          {TEMPLATES.map((t) => (
            <Chip key={t.idea} label={t.idea} onPress={() => setF((x) => ({ ...x, idea: t.idea, category: t.category }))} />
          ))}
        </Row>
      </ScrollView>
      <Field testID="idea" label="Your idea" value={f.idea} onChangeText={(v) => set('idea', v)} placeholder="e.g. A logo for my coffee brand" />
      <Label style={{ marginBottom: space.sm }}>Category</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
        {CATEGORIES.map((c) => <Chip key={c} label={c} selected={f.category === c} onPress={() => set('category', c)} />)}
      </View>
      <ErrorText>{writer.error}</ErrorText>
      <Button testID="write-brief" title={f.brief ? 'Rewrite my brief' : 'Write my brief'} icon="sparkles" variant="secondary" onPress={writeBrief} loading={writer.busy} />

      {f.brief || f.title ? (
        <FadeIn>
          <Gap size={space.xxl} />
          <Field testID="title" label="Title" value={f.title} onChangeText={(v) => set('title', v)} />
          <Field testID="brief" label="About the project" value={f.brief} onChangeText={(v) => set('brief', v)} multiline style={{ minHeight: 140 }} />
          <DeliverablesEditor value={f.deliverables} onChange={(v) => set('deliverables', v)} />

          <Label style={{ marginBottom: space.sm }}>Experience needed</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
            {(Object.keys(LEVEL_LABEL) as ProjectLevel[]).map((l) => <Chip key={l} label={LEVEL_LABEL[l]} selected={f.level === l} onPress={() => set('level', l)} />)}
          </View>

          <Label style={{ marginBottom: space.sm }}>Where</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: f.workMode === 'remote' ? space.xl : space.md }}>
            {(Object.keys(MODE_LABEL) as WorkMode[]).map((m) => <Chip key={m} label={MODE_LABEL[m]} selected={f.workMode === m} onPress={() => set('workMode', m)} />)}
          </View>
          {f.workMode !== 'remote' ? <Field testID="city" label="City" value={f.city} onChangeText={(v) => set('city', v)} placeholder="e.g. Manchester" /> : null}

          <Label style={{ marginBottom: space.sm }}>Skills</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
            {[...new Set([...f.skills, ...SKILL_OPTIONS])].map((s) => (
              <Chip key={s} label={s} selected={f.skills.includes(s)} onPress={() => set('skills', f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s])} />
            ))}
          </View>

          <Row gap={space.md}>
            <View style={{ flex: 1 }}><Field testID="hours" label="Hours" value={f.hours} onChangeText={(v) => set('hours', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field testID="budget" label="Budget (£)" value={f.budget} onChangeText={(v) => set('budget', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Days" value={f.days} onChangeText={(v) => set('days', v.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
          </Row>
          {hours > 0 ? (
            <Muted style={{ marginTop: -space.sm, marginBottom: space.lg, color: tooLow ? colors.danger : colors.textMuted }}>
              {tooLow
                ? `Minimum for ${hours}h is ${formatGBP(minPence, { exact: true })} (£12.71/hour).`
                : budgetPence > 0
                  ? `That's ${formatGBP(hourlyRatePence(budgetPence, hours), { exact: true })} an hour for the student.`
                  : `Minimum budget: ${formatGBP(minPence, { exact: true })} (£12.71/hour).`}
            </Muted>
          ) : null}

          {budgetPence > 0 && !tooLow ? (
            <Card>
              <Heading style={{ marginBottom: space.sm }}>What you&apos;ll pay</Heading>
              <FeeBreakdown amountPence={budgetPence} plan={plan} />
              <Muted style={{ marginTop: space.sm, fontSize: 13 }}>You pay when you hire. The money is held and only released when you approve the work.</Muted>
            </Card>
          ) : null}

          {tried && problems.length > 1 ? (
            <View style={{ marginBottom: space.md }}>
              {problems.slice(1).map((p) => <Body key={p} style={{ color: colors.danger, fontSize: 14 }}>• {p}</Body>)}
            </View>
          ) : null}
          <ErrorText>{submit.error}</ErrorText>
          <Button testID="post" title="Post project" icon="rocket" onPress={post} loading={submit.busy} disabled={tooLow || !budgetPence || !hours || !f.title} />
        </FadeIn>
      ) : null}
    </Screen>
  );
}
