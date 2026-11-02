import { resetTo } from '@/lib/nav';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Card, ErrorText, Field, Gap, Heading, Label, Loading, Muted, Row, Screen, Stars } from '@/components/ui';
import { getApi } from '@/lib/api';
import { PLANS } from '@/lib/fees';
import { haptic } from '@/lib/haptics';
import { useMe, useSession } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Business } from '@/lib/types';
import { space } from '@/theme';

export default function BusinessProfile() {
  const me = useMe();
  const { data: business } = useQuery((api) => api.getBusiness(me.id), [me.id]);
  if (!business) return <Screen title="Profile"><Loading /></Screen>;
  return <BusinessProfileForm business={business} />;
}

function BusinessProfileForm({ business }: { business: Business }) {
  const me = useMe();
  const { signOut } = useSession();
  const [form, setForm] = useState({ companyName: business.companyName, website: business.website });
  const save = useAction();
  const plan = PLANS[business.plan];

  return (
    <Screen title="Profile">
      <Row gap={space.lg} style={{ marginBottom: space.xl }}>
        <Avatar name={business.companyName} size={64} />
        <View style={{ flex: 1 }}>
          <Heading>{business.companyName}</Heading>
          <Muted>{me.fullName}</Muted>
          <Stars value={business.rating.average} />
        </View>
      </Row>
      <Card onPress={() => router.push('/plans')} testID="plan-card">
        <Label>Your plan</Label>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Heading>{plan.name}</Heading>
          <Muted>{Math.round(plan.feeRate * 100)}% service fee</Muted>
        </Row>
        <Muted style={{ marginTop: space.sm, fontSize: 13 }}>{business.plan === 'scale' ? 'Lowest fees on every project.' : 'Hiring often? Lower your fee →'}</Muted>
      </Card>
      <Gap size={space.md} />
      <Field label="Company" value={form.companyName} onChangeText={(companyName) => setForm({ ...form, companyName })} />
      <Field label="Website" value={form.website} onChangeText={(website) => setForm({ ...form, website })} autoCapitalize="none" keyboardType="url" />
      <ErrorText>{save.error}</ErrorText>
      <Button title="Save" loading={save.busy} onPress={() => save.run(async () => { await getApi().updateMyBusiness(form); haptic.success(); })} />
      <Gap />
      <Button title="Sign out" variant="ghost" onPress={async () => { await signOut(); resetTo('/welcome'); }} />
    </Screen>
  );
}
