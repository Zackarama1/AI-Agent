import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { FeeBreakdown } from '@/components/domain';
import { Body, Button, Card, Chip, ErrorText, Field, Gap, Heading, Label, Muted, Row, Screen } from '@/components/ui';
import { getApi } from '@/lib/api';
import { CATEGORIES, SKILL_OPTIONS, TEMPLATES } from '@/lib/brief';
import { FEATURED_LISTING_PENCE, formatGBP, hourlyRatePence, meetsMinimumRate, minimumBudgetPence } from '@/lib/fees';
import { haptic } from '@/lib/haptics';
import { useMe } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import { space, useTheme } from '@/theme';

const EMPTY = { idea: '', title: '', category: 'Design', brief: '', hours: '', budget: '', days: '14', skills: [] as string[], featured: false };

export default function PostProject() {
  const me = useMe();
  const { colors } = useTheme();
  const { data: business } = useQuery((api) => api.getBusiness(me.id), [me.id]);
  const [f, setF] = useState(EMPTY);
  const writer = useAction();
  const submit = useAction();
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  const hours = Number(f.hours) || 0;
  const budgetPence = Math.round((Number(f.budget) || 0) * 100);
  const minPence = minimumBudgetPence(hours);
  const tooLow = hours > 0 && budgetPence > 0 && !meetsMinimumRate(budgetPence, hours);
  const plan = business?.plan ?? 'free';
  const demo = getApi().mode === 'demo';

  const writeBrief = () =>
    writer.run(async () => {
      if (f.idea.trim().length < 8) throw new Error('Describe your idea in a sentence first');
      const b = await getApi().writeBrief(f.idea, f.category);
      setF((x) => ({ ...x, title: b.title, brief: b.brief, skills: b.skills, hours: String(b.estimatedHours), days: String(b.durationDays), budget: x.budget || String(Math.ceil((b.estimatedHours * 1271) / 100 / 5) * 5) }));
      haptic.success();
    });

  const post = () =>
    submit.run(async () => {
      if (tooLow) throw new Error(`The minimum for ${hours} hours is ${formatGBP(minPence, { exact: true })}`);
      const p = await getApi().createProject({
        title: f.title, category: f.category, brief: f.brief, budgetPence, estimatedHours: hours,
        durationDays: Number(f.days) || 14, skills: f.skills, featured: f.featured,
      });
      haptic.success();
      setF(EMPTY);
      router.push(`/project/${p.id}`);
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
        <>
          <Gap size={space.xxl} />
          <Field testID="title" label="Title" value={f.title} onChangeText={(v) => set('title', v)} />
          <Field testID="brief" label="Brief" value={f.brief} onChangeText={(v) => set('brief', v)} multiline style={{ minHeight: 200 }} />
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

          {demo ? (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body>Feature this project</Body>
                  <Muted style={{ fontSize: 13 }}>Pinned to the top for 7 days · {formatGBP(FEATURED_LISTING_PENCE)}</Muted>
                </View>
                <Switch value={f.featured} onValueChange={(v) => set('featured', v)} trackColor={{ true: colors.primary }} />
              </Row>
            </Card>
          ) : null}

          <ErrorText>{submit.error}</ErrorText>
          <Button testID="post" title="Post project" onPress={post} loading={submit.busy} disabled={tooLow || !budgetPence || !hours || !f.title} />
        </>
      ) : null}
    </Screen>
  );
}
