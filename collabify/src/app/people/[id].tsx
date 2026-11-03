import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { CompanyLogo, TrackRecord, companyFacts } from '@/components/company';
import { ProjectCard } from '@/components/domain';
import { FadeIn } from '@/components/motion';
import { Avatar, Body, Card, Chips, Empty, Gap, Heading, Label, Loading, Muted, Pill, Row, Screen, Stars } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import type { Business, Review, Student } from '@/lib/types';
import { fonts, space, useTheme } from '@/theme';

function Reviews({ reviews }: { reviews: Review[] | undefined }) {
  return (
    <View>
      <Label style={{ marginBottom: space.md }}>Reviews</Label>
      {!reviews ? <Loading /> : reviews.length === 0 ? (
        <Muted>No reviews yet. Reviews appear once both sides of a finished project have left one.</Muted>
      ) : (
        reviews.map((r, i) => (
          <FadeIn key={r.id} index={i}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ color: '#FF9F0A' }}>{'★'.repeat(r.rating)}<Body style={{ opacity: 0.25 }}>{'★'.repeat(5 - r.rating)}</Body></Body>
                <Muted style={{ fontSize: 13 }}>{timeAgo(r.createdAt)}</Muted>
              </Row>
              {r.comment ? <Body style={{ marginTop: space.sm }}>&ldquo;{r.comment}&rdquo;</Body> : null}
            </Card>
          </FadeIn>
        ))
      )}
    </View>
  );
}

function CompanyProfile({ business, reviews }: { business: Business; reviews: Review[] | undefined }) {
  const { colors } = useTheme();
  const { data: projects } = useQuery((api) => api.listOpenProjects({ businessId: business.id }), [business.id]);
  const site = business.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <>
      <FadeIn>
        <CompanyLogo name={business.companyName} size={76} />
        <Gap size={space.lg} />
        <Heading style={{ fontSize: 30, lineHeight: 34, letterSpacing: -1, fontFamily: fonts.heavy }}>{business.companyName}</Heading>
        {companyFacts(business) ? <Muted style={{ marginTop: space.xs }}>{companyFacts(business)}</Muted> : null}
        {site ? (
          <Pressable onPress={() => Linking.openURL(business.website)} accessibilityRole="link" style={{ marginTop: space.sm }}>
            <Row gap={4}>
              <Ionicons name="globe-outline" size={15} color={colors.primary} />
              <Body style={{ color: colors.primary, fontSize: 15 }}>{site}</Body>
            </Row>
          </Pressable>
        ) : null}
        {business.about ? <Body style={{ marginTop: space.lg }}>{business.about}</Body> : null}
      </FadeIn>

      <FadeIn index={1}>
        <Gap size={space.xl} />
        <Label style={{ marginBottom: space.md }}>Track record on Collabify</Label>
        <TrackRecord stats={business.stats} rating={business.rating} />
        <Row gap={6} style={{ marginTop: space.md }}>
          <Ionicons name="shield-checkmark" size={14} color={colors.moneyText} />
          <Muted style={{ fontSize: 13 }}>Every project is paid upfront and held until the work is approved.</Muted>
        </Row>
      </FadeIn>

      <Gap size={space.xxl} />
      <Label style={{ marginBottom: space.md }}>Open projects</Label>
      {!projects ? <Loading /> : projects.length === 0 ? (
        <Muted>No open projects right now.</Muted>
      ) : (
        projects.map((p, i) => <FadeIn key={p.id} index={i}><ProjectCard project={p} onPress={() => router.push(`/project/${p.id}`)} /></FadeIn>)
      )}
      <Gap size={space.xl} />
      <Reviews reviews={reviews} />
    </>
  );
}

function StudentProfile({ student, reviews }: { student: Student; reviews: Review[] | undefined }) {
  const { colors } = useTheme();
  return (
    <>
      <FadeIn>
        <Row gap={space.lg}>
          <Avatar name={student.fullName} size={72} />
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 24 }}>{student.fullName}</Heading>
            <Muted>{[student.course, student.university, student.year].filter(Boolean).join(' · ')}</Muted>
            <Row style={{ marginTop: 6 }}>
              {student.verified ? <Pill label="Verified student" tone="money" /> : null}
              <Stars value={student.rating.average} />
              <Muted style={{ fontSize: 13 }}>{student.completedCount} done</Muted>
            </Row>
          </View>
        </Row>
        {student.bio ? <Body style={{ marginTop: space.xl }}>{student.bio}</Body> : null}
        <Gap />
        <Chips items={student.skills} />
        {student.portfolioUrl ? (
          <Pressable onPress={() => Linking.openURL(student.portfolioUrl)} style={{ marginTop: space.lg }}>
            <Body style={{ color: colors.primary }}>View portfolio →</Body>
          </Pressable>
        ) : null}
      </FadeIn>
      <Gap size={space.xxl} />
      <Reviews reviews={reviews} />
    </>
  );
}

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: student } = useQuery((api) => api.getStudent(id), [id]);
  const { data: business } = useQuery((api) => api.getBusiness(id), [id]);
  const { data: reviews } = useQuery((api) => api.listReviewsFor(id), [id]);
  if (student === undefined || business === undefined) return <Loading />;
  if (!student && !business) return <Screen edges={[]}><Empty title="Not found" /></Screen>;
  return (
    <Screen edges={[]}>
      {business ? <CompanyProfile business={business} reviews={reviews} /> : <StudentProfile student={student!} reviews={reviews} />}
    </Screen>
  );
}
