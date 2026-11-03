import { router } from 'expo-router';
import { Button, Card, ErrorText, Heading, Loading, Muted, Pill, Row, Screen, Title } from '@/components/ui';
import { openStripe } from '@/lib/stripeFlow';
import { getApi } from '@/lib/api';
import { feeFor, formatGBP, PLANS, type Plan } from '@/lib/fees';
import { haptic } from '@/lib/haptics';
import { useMe } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import { fonts, space, useTheme } from '@/theme';

const EXAMPLE = 45000; // £450 project

export default function Plans() {
  const me = useMe();
  const { colors } = useTheme();
  const { data: business } = useQuery((api) => api.getBusiness(me.id), [me.id]);
  const { busy, error, run } = useAction();
  if (!business) return <Loading />;

  const choose = (plan: Plan) =>
    run(async () => {
      const { url } = await getApi().changePlan(plan);
      if (url) await openStripe(url);
      haptic.success();
      router.back();
    });

  return (
    <Screen edges={[]}>
      <Title>Lower fees when you hire more.</Title>
      <Muted style={{ marginTop: space.sm, marginBottom: space.xl }}>Students always keep 100%. The service fee is added to what you pay.</Muted>
      <ErrorText>{error}</ErrorText>
      {(Object.keys(PLANS) as Plan[]).map((id) => {
        const p = PLANS[id];
        const ex = feeFor(EXAMPLE, id);
        const current = business.plan === id;
        return (
          <Card key={id} style={current ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Heading>{p.name}</Heading>
              {current ? <Pill label="Current" tone="primary" /> : null}
            </Row>
            <Row style={{ alignItems: 'baseline', marginTop: space.sm }}>
              <Heading style={{ fontSize: 34, fontFamily: fonts.heavy, letterSpacing: -1 }}>{Math.round(p.feeRate * 100)}%</Heading>
              <Muted>service fee</Muted>
            </Row>
            <Muted style={{ marginTop: 4 }}>{p.monthlyPence ? `${formatGBP(p.monthlyPence)}/month` : 'No monthly cost'}</Muted>
            <Muted style={{ marginTop: space.sm, fontSize: 13 }}>A £450 project costs you {formatGBP(ex.totalPence)}.</Muted>
            {!current ? (
              <Button
                testID={`plan-${id}`}
                small
                title={p.monthlyPence ? `Switch to ${p.name}` : 'Switch to Free'}
                variant={id === 'pro' ? 'primary' : 'secondary'}
                loading={busy}
                onPress={() => choose(id)}
                style={{ marginTop: space.lg, alignSelf: 'flex-start' }}
              />
            ) : null}
          </Card>
        );
      })}
      {getApi().mode === 'supabase' ? <Muted style={{ fontSize: 13, textAlign: 'center' }}>Paid plans open in your browser and are managed on the Collabify website.</Muted> : null}
    </Screen>
  );
}
