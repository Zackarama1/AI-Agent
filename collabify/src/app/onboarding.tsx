import { resetTo } from '@/lib/nav';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, ErrorText, Field, Label, Muted, Screen, Title } from '@/components/ui';
import { getApi } from '@/lib/api';
import { SKILL_OPTIONS } from '@/lib/brief';
import { haptic } from '@/lib/haptics';
import { useAction } from '@/lib/useQuery';
import { space } from '@/theme';

const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgrad'];

export default function Onboarding() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const isStudent = role !== 'business';
  const [form, setForm] = useState({ fullName: '', university: '', course: '', year: 'Year 2', companyName: '', website: '' });
  const [skills, setSkills] = useState<string[]>([]);
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  const submit = () =>
    run(async () => {
      if (form.fullName.trim().length < 2) throw new Error('Add your name');
      if (isStudent) {
        if (!form.university.trim()) throw new Error('Add your university');
        await getApi().completeOnboarding({ role: 'student', fullName: form.fullName, university: form.university.trim(), course: form.course.trim(), year: form.year, skills });
      } else {
        if (!form.companyName.trim()) throw new Error('Add your company name');
        await getApi().completeOnboarding({ role: 'business', fullName: form.fullName, companyName: form.companyName.trim(), website: form.website.trim() });
      }
      haptic.success();
      resetTo('/');
    });

  return (
    <Screen edges={[]}>
      <Title>{isStudent ? 'You’re verified.' : 'Welcome aboard.'}</Title>
      <Muted style={{ marginTop: space.sm, marginBottom: space.xxl }}>
        {isStudent ? 'Tell businesses a little about you.' : 'A few details so students know who they’re working with.'}
      </Muted>
      <Field testID="name" label="Your name" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" />
      {isStudent ? (
        <>
          <Field testID="university" label="University" value={form.university} onChangeText={set('university')} placeholder="e.g. University of Leeds" />
          <Field label="Course" value={form.course} onChangeText={set('course')} placeholder="e.g. Marketing" />
          <Label style={{ marginBottom: space.sm }}>Year</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
            {YEARS.map((y) => <Chip key={y} label={y} selected={form.year === y} onPress={() => set('year')(y)} />)}
          </View>
          <Label style={{ marginBottom: space.sm }}>What are you good at?</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
            {SKILL_OPTIONS.map((s) => (
              <Chip key={s} label={s} selected={skills.includes(s)} onPress={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Field testID="company" label="Company" value={form.companyName} onChangeText={set('companyName')} />
          <Field label="Website (optional)" value={form.website} onChangeText={set('website')} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <Button testID="finish" title="Get started" onPress={submit} loading={busy} />
    </Screen>
  );
}
