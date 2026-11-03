import { Ionicons } from '@expo/vector-icons';
import { CompanyLogo, TrackRecord, companyFacts } from '@/components/company';
import { FadeIn } from '@/components/motion';
import { LEVEL_LABEL, whereLabel } from '@/lib/projectRules';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { FeeBreakdown, ProjectPill } from '@/components/domain';
import { Avatar, Body, Button, Card, Chips, Empty, ErrorText, Field, Gap, Heading, Label, Loading, Money, Muted, Pill, Row, Screen, Stars, type IconName } from '@/components/ui';
import { openStripe } from '@/lib/stripeFlow';
import { getApi } from '@/lib/api';
import { FEATURED_DAYS, FEATURED_LISTING_PENCE, formatGBP, hourlyRatePence } from '@/lib/fees';
import { APPLICATION_LABEL, timeAgo } from '@/lib/format';
import { matchScore } from '@/lib/matching';
import { useMe } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Application, Project } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

function ApplyBox({ project }: { project: Project }) {
  const { data: mine } = useQuery((api) => api.getMyApplication(project.id), [project.id]);
  const { data: contract } = useQuery((api) => api.getContractForProject(project.id), [project.id]);
  const { data: invites } = useQuery((api) => api.listMyInvites());
  const invited = Boolean(invites?.includes(project.id));
  const { colors } = useTheme();
  const [pitch, setPitch] = useState('');
  const { busy, error, run } = useAction();
  if (mine === undefined) return <Loading />;
  if (contract) return <Button title="Open project" onPress={() => router.push(`/contract/${contract.id}`)} />;
  if (mine) {
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Your application</Heading>
          <Pill label={APPLICATION_LABEL[mine.status]} tone={mine.status === 'shortlisted' ? 'primary' : 'neutral'} />
        </Row>
        <Muted style={{ marginTop: space.sm }}>{mine.pitch}</Muted>
        <ErrorText>{error}</ErrorText>
        {['applied', 'shortlisted'].includes(mine.status) ? (
          <Button testID="withdraw" small variant="ghost" title="Withdraw application" loading={busy} onPress={() => run(() => getApi().withdrawApplication(mine.id))} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
        ) : null}
      </Card>
    );
  }
  if (project.status !== 'open') return <Muted>This project is no longer taking applications.</Muted>;
  return (
    <View>
      {invited ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderWidth: 0 }}>
          <Heading>You&apos;re invited</Heading>
          <Muted style={{ marginTop: 4 }}>{project.companyName} would like you to apply.</Muted>
        </Card>
      ) : null}
      <Heading style={{ marginBottom: space.md }}>Apply</Heading>
      <Field testID="pitch" value={pitch} onChangeText={setPitch} multiline placeholder="Why you? Mention relevant work, coursework or links." />
      <ErrorText>{error}</ErrorText>
      <Button
        testID="apply"
        title="Send application"
        hapticKind="success"
        loading={busy}
        disabled={pitch.trim().length < 20}
        onPress={() => run(() => getApi().apply(project.id, pitch))}
      />
      <Muted style={{ textAlign: 'center', marginTop: space.sm, fontSize: 13 }}>You keep 100% · {formatGBP(project.budgetPence)}</Muted>
    </View>
  );
}

function Applicant({ a, project }: { a: Application; project: Project }) {
  const { busy, error, run } = useAction();
  const open = project.status === 'open';
  return (
    <Card>
      <Row gap={space.md}>
        <Avatar name={a.student.fullName} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontFamily: fonts.semibold }} >{a.student.fullName}</Body>
          <Muted style={{ fontSize: 13 }}>{a.student.university} · {a.student.course}</Muted>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Pill label={`${matchScore(project, a.student)}% match`} tone="primary" />
          <Stars value={a.student.rating.average} />
        </View>
      </Row>
      <Body style={{ marginTop: space.md }}>{a.pitch}</Body>
      <View style={{ marginTop: space.md }}><Chips items={a.student.skills.slice(0, 5)} /></View>
      <ErrorText>{error}</ErrorText>
      <Row style={{ marginTop: space.lg, flexWrap: 'wrap' }}>
        <Pill label={APPLICATION_LABEL[a.status]} tone={a.status === 'hired' ? 'money' : a.status === 'shortlisted' ? 'primary' : 'neutral'} />
        <View style={{ flex: 1 }} />
        <Button small variant="ghost" title="Profile" onPress={() => router.push(`/people/${a.studentId}`)} />
        {open && a.status === 'applied' ? (
          <Button small variant="secondary" title="Shortlist" disabled={busy} onPress={() => run(() => getApi().setApplicationStatus(a.id, 'shortlisted'))} />
        ) : null}
        {open && a.status !== 'declined' ? (
          <>
            <Button small variant="ghost" title="Decline" disabled={busy} onPress={() => run(() => getApi().setApplicationStatus(a.id, 'declined'))} />
            <Button
              testID={`hire-${a.id}`}
              small
              title="Hire"
              hapticKind="success"
              loading={busy}
              onPress={() => run(async () => {
                const c = await getApi().hire(a.id);
                router.push(`/contract/${c.id}`);
              })}
            />
          </>
        ) : null}
      </Row>
    </Card>
  );
}

function OwnerActions({ project }: { project: Project }) {
  const feature = useAction();
  const cancel = useAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (project.status !== 'open') return null;
  return (
    <Card>
      {project.featured && project.featuredUntil ? (
        <Body>Featured until {new Date(project.featuredUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Body>
      ) : (
        <>
          <Heading>Get seen first</Heading>
          <Muted style={{ marginTop: 4, marginBottom: space.md }}>Pin this project to the top of the feed for {FEATURED_DAYS} days.</Muted>
          <ErrorText>{feature.error}</ErrorText>
          <Button
            testID="feature"
            small
            icon="star"
            title={`Feature for ${formatGBP(FEATURED_LISTING_PENCE)}`}
            loading={feature.busy}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => feature.run(async () => {
              const { checkoutUrl } = await getApi().featureProject(project.id);
              if (checkoutUrl) await openStripe(checkoutUrl);
            })}
          />
        </>
      )}
      <ErrorText>{cancel.error}</ErrorText>
      {!confirmCancel ? (
        <Button small variant="ghost" title="Cancel project" onPress={() => setConfirmCancel(true)} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
      ) : (
        <Row style={{ marginTop: space.md }}>
          <Muted style={{ flex: 1 }}>Close it and let applicants know?</Muted>
          <Button testID="confirm-cancel-project" small variant="danger" title="Cancel project" loading={cancel.busy} onPress={() => cancel.run(() => getApi().cancelProject(project.id))} />
          <Button small variant="ghost" title="Keep" onPress={() => setConfirmCancel(false)} />
        </Row>
      )}
    </Card>
  );
}

function Suggestions({ project }: { project: Project }) {
  const { data } = useQuery((api) => api.suggestStudents(project.id), [project.id]);
  const { busy, error, run } = useAction();
  if (project.status !== 'open' || !data || data.length === 0) return null;
  return (
    <View style={{ marginBottom: space.lg }}>
      <Heading>Invite students</Heading>
      <Muted style={{ marginTop: 2, marginBottom: space.md }}>Best matches who haven&apos;t applied yet.</Muted>
      <ErrorText>{error}</ErrorText>
      {data.map(({ student, score, invited }) => (
        <Card key={student.id} style={{ paddingVertical: space.lg }}>
          <Row gap={space.md}>
            <Avatar name={student.fullName} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: fonts.semibold }} numberOfLines={1}>{student.fullName}</Body>
              <Muted style={{ fontSize: 13 }} numberOfLines={1}>{student.university}</Muted>
            </View>
            <Pill label={`${score}%`} tone="primary" />
            {invited ? (
              <Pill label="Invited" tone="money" />
            ) : (
              <Button
                testID={`invite-${student.id}`}
                small
                title="Invite"
                disabled={busy}
                onPress={() => run(() => getApi().inviteStudent(project.id, student.id))}
              />
            )}
          </Row>
        </Card>
      ))}
    </View>
  );
}

function OwnerView({ project }: { project: Project }) {
  const { data: applicants } = useQuery((api) => api.listApplicants(project.id), [project.id]);
  const { data: contract } = useQuery((api) => api.getContractForProject(project.id), [project.id]);
  const { data: business } = useQuery((api) => api.getBusiness(project.businessId), [project.businessId]);
  return (
    <View>
      {contract ? <Button title="Open project with your student" onPress={() => router.push(`/contract/${contract.id}`)} style={{ marginBottom: space.xl }} /> : null}
      <OwnerActions project={project} />
      {project.status === 'open' && business ? (
        <Card>
          <Label style={{ marginBottom: space.sm }}>When you hire</Label>
          <FeeBreakdown amountPence={project.budgetPence} plan={business.plan} />
        </Card>
      ) : null}
      <Gap size={space.md} />
      {applicants ? <Suggestions project={project} /> : null}
      <Heading style={{ marginBottom: space.md }}>Applicants</Heading>
      {!applicants ? <Loading /> : applicants.length === 0 ? (
        <Empty icon="people-outline" title="No applicants yet" text="Most projects get their first application within a day." />
      ) : (
        applicants.map((a) => <Applicant key={a.id} a={a} project={project} />)
      )}
    </View>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Muted style={{ fontSize: 11 }}>{label}</Muted>
        <Body style={{ fontFamily: fonts.semibold, fontSize: 14 }} numberOfLines={1}>{value}</Body>
      </View>
    </View>
  );
}

function AboutCompany({ businessId }: { businessId: string }) {
  const { data: b } = useQuery((api) => api.getBusiness(businessId), [businessId]);
  if (!b) return null;
  return (
    <Card onPress={() => router.push(`/people/${b.id}`)} testID="company-card">
      <Row gap={space.md} style={{ marginBottom: space.lg }}>
        <CompanyLogo name={b.companyName} size={48} />
        <View style={{ flex: 1 }}>
          <Heading numberOfLines={1}>{b.companyName}</Heading>
          {companyFacts(b) ? <Muted style={{ fontSize: 13 }} numberOfLines={1}>{companyFacts(b)}</Muted> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} />
      </Row>
      {b.about ? <Body style={{ marginBottom: space.lg }} numberOfLines={3}>{b.about}</Body> : null}
      <TrackRecord stats={b.stats} rating={b.rating} />
    </Card>
  );
}

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const { data: project, error } = useQuery((api) => api.getProject(id), [id]);
  if (error) return <Screen edges={[]}><ErrorText>{error.message}</ErrorText></Screen>;
  if (project === undefined) return <Loading />;
  if (!project) return <Screen edges={[]}><Empty title="Project not found" /></Screen>;
  const isOwner = project.businessId === me.id;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: '' }} />
      <FadeIn>
        <Row gap={6}>
          {project.featured ? <Pill label="Featured" tone="primary" /> : null}
          <Pill label={project.category} />
          <ProjectPill status={project.status} />
        </Row>
        <Gap size={space.md} />
        <Heading style={{ fontSize: 30, lineHeight: 34, letterSpacing: -1, fontFamily: fonts.heavy }}>{project.title}</Heading>
        <Row style={{ marginTop: space.sm }}>
          <CompanyLogo name={project.companyName} size={24} />
          <Muted>{project.companyName} · posted {timeAgo(project.createdAt)}</Muted>
        </Row>

        <Row gap={space.xl} style={{ marginVertical: space.xl }}>
          <View>
            <Label>Pay</Label>
            <Money pence={project.budgetPence} size={30} />
          </View>
          <View>
            <Label>Time</Label>
            <Body style={{ fontFamily: fonts.bold, fontSize: 22, marginTop: 4 }}>{project.estimatedHours}h</Body>
          </View>
          <View>
            <Label>Rate</Label>
            <Body style={{ fontFamily: fonts.bold, fontSize: 22, marginTop: 4 }}>{formatGBP(hourlyRatePence(project.budgetPence, project.estimatedHours))}/h</Body>
          </View>
        </Row>
      </FadeIn>

      <FadeIn index={1}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
          <Fact icon="location" label="Where" value={whereLabel(project)} />
          <Fact icon="school" label="Level" value={LEVEL_LABEL[project.level]} />
          <Fact icon="calendar" label="Due" value={`${project.durationDays} days after start`} />
          <Fact icon="people" label="Applicants" value={project.applicantCount === 0 ? 'Be the first' : String(project.applicantCount)} />
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <Card style={{ backgroundColor: colors.surfaceAlt, borderWidth: 0 }}>
          <Body>{project.brief}</Body>
          {project.deliverables.length ? (
            <View style={{ marginTop: space.lg }}>
              <Label style={{ marginBottom: space.sm }}>You&apos;ll deliver</Label>
              {project.deliverables.map((d) => (
                <Row key={d} style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.money} style={{ marginTop: 2 }} />
                  <Body style={{ flex: 1 }}>{d}</Body>
                </Row>
              ))}
            </View>
          ) : null}
          <Gap size={space.lg} />
          <Chips items={project.skills} onGrey />
        </Card>
        <Row gap={6} style={{ marginBottom: space.xl, marginTop: space.sm }}>
          <Ionicons name="shield-checkmark" size={14} color={colors.moneyText} />
          <Body style={{ color: colors.moneyText, fontSize: 13, fontFamily: fonts.semibold }}>Protected payment</Body>
          <Muted style={{ fontSize: 13 }}>· held before work starts</Muted>
        </Row>
      </FadeIn>

      {!isOwner ? <FadeIn index={3}><AboutCompany businessId={project.businessId} /></FadeIn> : null}
      <Gap size={space.md} />
      {isOwner || me.role === 'admin' ? <OwnerView project={project} /> : me.role === 'student' ? <ApplyBox project={project} /> : null}
    </Screen>
  );
}
