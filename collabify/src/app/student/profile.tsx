import { resetTo } from '@/lib/nav';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Body, Button, Card, Chip, ErrorText, Field, Gap, Heading, Label, Loading, Muted, Pill, Row, Screen, Stars } from '@/components/ui';
import { getApi } from '@/lib/api';
import { SKILL_OPTIONS } from '@/lib/brief';
import { haptic } from '@/lib/haptics';
import { useMe, useSession } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Student, StudentPrivate } from '@/lib/types';
import { space } from '@/theme';

export default function StudentProfile() {
  const me = useMe();
  const { data: student } = useQuery((api) => api.getStudent(me.id), [me.id]);
  const { data: priv } = useQuery((api) => api.getMyStudentPrivate());
  if (!student || !priv) return <Screen title="Profile"><Loading /></Screen>;
  return <StudentProfileForm student={student} priv={priv} />;
}

function StudentProfileForm({ student, priv }: { student: Student; priv: StudentPrivate }) {
  const me = useMe();
  const { signOut } = useSession();
  const [form, setForm] = useState({ bio: student.bio, portfolioUrl: student.portfolioUrl, course: student.course, skills: student.skills });
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const payouts = useAction();
  const toggle = (s: string) => setForm({ ...form, skills: form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s] });

  return (
    <Screen title="Profile">
      <Row gap={space.lg} style={{ marginBottom: space.xl }}>
        <Avatar name={me.fullName} size={64} />
        <View style={{ flex: 1 }}>
          <Heading>{me.fullName}</Heading>
          <Muted>{[student.course, student.university].filter(Boolean).join(' · ')}</Muted>
          <Row style={{ marginTop: 6 }}>
            {student.verified ? <Pill label="Verified student" tone="money" /> : null}
            <Stars value={student.rating.average} />
          </Row>
        </View>
      </Row>

      <Card>
        <Heading>Payouts</Heading>
        {priv.payoutsEnabled ? (
          <Muted style={{ marginTop: 4 }}>Connected. You keep 100% of every project fee.</Muted>
        ) : (
          <>
            <Muted style={{ marginTop: 4, marginBottom: space.md }}>Connect a bank account through Stripe so businesses can pay you.</Muted>
            <ErrorText>{payouts.error}</ErrorText>
            <Button
              testID="setup-payouts"
              small
              title="Set up payouts"
              loading={payouts.busy}
              style={{ alignSelf: 'flex-start' }}
              onPress={() => payouts.run(async () => {
                const { url } = await getApi().startPayoutSetup();
                if (url) await WebBrowser.openBrowserAsync(url);
                haptic.success();
              })}
            />
          </>
        )}
      </Card>

      <Gap size={space.md} />
      <Field label="Course" value={form.course} onChangeText={(course) => setForm({ ...form, course })} />
      <Field label="About you" value={form.bio} onChangeText={(bio) => setForm({ ...form, bio })} multiline placeholder="What you study, what you love building, what you've done before." />
      <Field label="Portfolio link" value={form.portfolioUrl} onChangeText={(portfolioUrl) => setForm({ ...form, portfolioUrl })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
      <Label style={{ marginBottom: space.sm }}>Skills</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
        {[...new Set([...SKILL_OPTIONS, ...form.skills])].map((s) => <Chip key={s} label={s} selected={form.skills.includes(s)} onPress={() => toggle(s)} />)}
      </View>
      <ErrorText>{save.error}</ErrorText>
      <Button
        title={saved ? 'Saved' : 'Save profile'}
        icon={saved ? 'checkmark' : undefined}
        loading={save.busy}
        onPress={() => save.run(async () => {
          await getApi().updateMyStudent(form);
          haptic.success();
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        })}
      />
      <Gap />
      <Button title="View public profile" variant="secondary" onPress={() => router.push(`/people/${me.id}`)} />
      <Gap size={space.sm} />
      <Button title="Sign out" variant="ghost" onPress={async () => { await signOut(); resetTo('/welcome'); }} />
      <Body style={{ textAlign: 'center', marginTop: space.lg, opacity: 0.4, fontSize: 12 }}>{me.email}</Body>
    </Screen>
  );
}
