import { resetTo } from '@/lib/nav';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CompanyFields, companyCompleteness, type CompanyForm } from '@/components/CompanyFields';
import { CompanyLogo } from '@/components/company';
import { useFeedback } from '@/components/feedback';
import { FadeIn } from '@/components/motion';
import { Body, Button, Card, ErrorText, Gap, Heading, Label, Loading, Muted, Row, Screen, Stars } from '@/components/ui';
import { DeleteAccount } from '@/components/DeleteAccount';
import { getApi } from '@/lib/api';
import { PLANS } from '@/lib/fees';
import { useMe, useSession } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Business } from '@/lib/types';
import { fonts, space, useTheme } from '@/theme';

export default function BusinessProfile() {
  const me = useMe();
  const { data: business } = useQuery((api) => api.getBusiness(me.id), [me.id]);
  if (!business) return <Screen title="Profile"><Loading /></Screen>;
  return <BusinessProfileForm business={business} />;
}

function BusinessProfileForm({ business }: { business: Business }) {
  const me = useMe();
  const { colors } = useTheme();
  const { toast } = useFeedback();
  const { signOut } = useSession();
  const [form, setForm] = useState<CompanyForm>({
    companyName: business.companyName, website: business.website, industry: business.industry,
    companySize: business.companySize, location: business.location, about: business.about,
  });
  const save = useAction();
  const plan = PLANS[business.plan];
  const { score, next } = companyCompleteness(form);

  return (
    <Screen title="Profile">
      <FadeIn>
        <Row gap={space.lg} style={{ marginBottom: space.xl }}>
          <CompanyLogo name={form.companyName || business.companyName} size={64} />
          <View style={{ flex: 1 }}>
            <Heading>{form.companyName || business.companyName}</Heading>
            <Muted>{me.fullName}</Muted>
            <Stars value={business.rating.average} />
          </View>
        </Row>
      </FadeIn>

      {score < 1 ? (
        <Card testID="profile-strength">
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading style={{ fontSize: 16 }}>Profile strength</Heading>
            <Body style={{ fontFamily: fonts.bold, color: colors.primary }}>{Math.round(score * 100)}%</Body>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, marginVertical: space.md, overflow: 'hidden' }}>
            <View style={{ width: `${score * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 4 }} />
          </View>
          <Muted style={{ fontSize: 13 }}>{next}. Complete profiles get more and better applicants.</Muted>
        </Card>
      ) : null}

      <Card onPress={() => router.push('/plans')} testID="plan-card">
        <Label>Your plan</Label>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Heading>{plan.name}</Heading>
          <Muted>{Math.round(plan.feeRate * 100)}% service fee</Muted>
        </Row>
        <Muted style={{ marginTop: space.sm, fontSize: 13 }}>{business.plan === 'scale' ? 'Lowest fees on every project.' : 'Hiring often? Lower your fee →'}</Muted>
      </Card>
      <Gap size={space.md} />
      <CompanyFields value={form} onChange={setForm} />
      <ErrorText>{save.error}</ErrorText>
      <Button title="Save" loading={save.busy} onPress={() => save.run(async () => { await getApi().updateMyBusiness(form); toast('Profile saved'); })} />
      <Gap size={space.sm} />
      <Button title="See your public listing" variant="secondary" icon="eye" onPress={() => router.push(`/people/${business.id}`)} />
      <Gap />
      <Button title="Sign out" variant="ghost" onPress={async () => { await signOut(); resetTo('/welcome'); }} />
      <DeleteAccount role="business" />
    </Screen>
  );
}
