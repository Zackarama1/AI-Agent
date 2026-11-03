import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { CompanyFields, type CompanyForm } from '@/components/CompanyFields';
import { useFeedback } from '@/components/feedback';
import { FadeIn } from '@/components/motion';
import { Button, Chip, ErrorText, Field, Label, Muted, Screen, Title } from '@/components/ui';
import { getApi } from '@/lib/api';
import { SKILL_OPTIONS } from '@/lib/brief';
import { resetTo } from '@/lib/nav';
import { useAction } from '@/lib/useQuery';
import { radius, space, useTheme } from '@/theme';

const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgrad'];

type Step = { key: string; title: string; subtitle: string; valid: boolean; body: ReactNode };

function ProgressBar({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  const [width] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // Width can't use the native driver; it's a short, cheap animation.
    Animated.timing(width, { toValue: (step + 1) / total, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [step, total, width]);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: step + 1 }} style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', flex: 1 }}>
      <Animated.View style={{ height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export default function Onboarding() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const isStudent = role !== 'business';
  const { colors } = useTheme();
  const { celebrate } = useFeedback();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [study, setStudy] = useState({ university: '', course: '', year: 'Year 2' });
  const [skills, setSkills] = useState<string[]>([]);
  const [company, setCompany] = useState<CompanyForm>({ companyName: '', website: '', industry: '', companySize: '', location: '', about: '' });
  const { busy, error, run } = useAction();
  const first = fullName.trim().split(/\s+/)[0] ?? '';

  const nameStep: Step = {
    key: 'name', title: 'What should we call you?', subtitle: isStudent ? 'Your name appears on applications.' : 'Students will see who they’re working with.',
    valid: fullName.trim().length >= 2,
    body: <Field testID="name" value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="Full name" autoFocus />,
  };

  const steps: Step[] = isStudent
    ? [
        nameStep,
        {
          key: 'study', title: `Where do you study${first ? `, ${first}` : ''}?`, subtitle: 'Businesses like to know.',
          valid: study.university.trim().length >= 2,
          body: (
            <>
              <Field testID="university" label="University" value={study.university} onChangeText={(university) => setStudy({ ...study, university })} placeholder="e.g. University of Leeds" />
              <Field label="Course" value={study.course} onChangeText={(course) => setStudy({ ...study, course })} placeholder="e.g. Marketing" />
              <Label style={{ marginBottom: space.sm }}>Year</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {YEARS.map((y) => <Chip key={y} label={y} selected={study.year === y} onPress={() => setStudy({ ...study, year: y })} />)}
              </View>
            </>
          ),
        },
        {
          key: 'skills', title: 'What are you good at?', subtitle: 'Pick a few. We use these to match you with projects.',
          valid: skills.length >= 1,
          body: (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {SKILL_OPTIONS.map((s) => (
                  <Chip key={s} label={s} selected={skills.includes(s)} onPress={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])} />
                ))}
              </View>
              <Muted style={{ marginTop: space.lg, fontSize: 13 }}>{skills.length === 0 ? 'Choose at least one.' : `${skills.length} selected${skills.length < 3 ? '. Three or more gets better matches.' : '. Nice.'}`}</Muted>
            </>
          ),
        },
      ]
    : [
        nameStep,
        {
          key: 'company', title: 'What’s your company called?', subtitle: 'And what do you do?',
          valid: company.companyName.trim().length >= 1,
          body: <CompanyFields value={company} onChange={setCompany} only={['companyName', 'industry']} />,
        },
        {
          key: 'details', title: 'A little more detail', subtitle: 'Students apply more to companies they can picture. You can change this later.',
          valid: true,
          body: <CompanyFields value={company} onChange={setCompany} only={['companySize', 'location', 'about', 'website']} />,
        },
      ];

  const current = steps[step];
  const last = step === steps.length - 1;

  const finish = () =>
    run(async () => {
      if (isStudent) {
        await getApi().completeOnboarding({ role: 'student', fullName, university: study.university.trim(), course: study.course.trim(), year: study.year, skills });
      } else {
        await getApi().completeOnboarding({ role: 'business', fullName, ...company, companyName: company.companyName.trim(), website: company.website.trim(), location: company.location.trim(), about: company.about.trim() });
      }
      resetTo('/');
      celebrate(isStudent
        ? { title: `Welcome, ${first}`, subtitle: 'You’re a verified student. Let’s find your first project.', icon: 'school' }
        : { title: `Welcome, ${first}`, subtitle: `${company.companyName.trim()} is set up. Post your first project in a minute.`, icon: 'rocket' });
    });

  return (
    <Screen edges={[]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xxl }}>
        {step > 0 ? (
          <Pressable testID="back" accessibilityLabel="Back" hitSlop={10} onPress={() => setStep(step - 1)}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
        <ProgressBar step={step} total={steps.length} />
        <Muted style={{ fontSize: 13 }}>{step + 1}/{steps.length}</Muted>
      </View>
      <FadeIn key={current.key}>
        <Title>{current.title}</Title>
        <Muted style={{ marginTop: space.sm, marginBottom: space.xxl }}>{current.subtitle}</Muted>
        {current.body}
      </FadeIn>
      <View style={{ marginTop: space.xxl }}>
        <ErrorText>{error}</ErrorText>
        {last ? (
          <Button testID="finish" title="Get started" icon="arrow-forward" onPress={finish} loading={busy} disabled={!current.valid} hapticKind="none" />
        ) : (
          <Button testID="continue" title="Continue" onPress={() => setStep(step + 1)} disabled={!current.valid} />
        )}
      </View>
    </Screen>
  );
}
