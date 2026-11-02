import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { Avatar, Body, Card, Chips, Empty, Gap, Heading, Label, Loading, Muted, Pill, Row, Screen, Stars } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { space, useTheme } from '@/theme';

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data: student } = useQuery((api) => api.getStudent(id), [id]);
  const { data: business } = useQuery((api) => api.getBusiness(id), [id]);
  const { data: reviews } = useQuery((api) => api.listReviewsFor(id), [id]);
  if (student === undefined || business === undefined) return <Loading />;
  const name = student?.fullName ?? business?.companyName;
  if (!name) return <Screen edges={[]}><Empty title="Not found" /></Screen>;

  return (
    <Screen edges={[]}>
      <Row gap={space.lg}>
        <Avatar name={name} size={72} />
        <View style={{ flex: 1 }}>
          <Heading style={{ fontSize: 24 }}>{name}</Heading>
          <Muted>{student ? [student.course, student.university, student.year].filter(Boolean).join(' · ') : business?.website}</Muted>
          <Row style={{ marginTop: 6 }}>
            {student?.verified ? <Pill label="Verified student" tone="money" /> : null}
            <Stars value={(student ?? business)!.rating.average} />
            {student ? <Muted style={{ fontSize: 13 }}>{student.completedCount} done</Muted> : null}
          </Row>
        </View>
      </Row>
      {student ? (
        <>
          {student.bio ? <Body style={{ marginTop: space.xl }}>{student.bio}</Body> : null}
          <Gap />
          <Chips items={student.skills} />
          {student.portfolioUrl ? (
            <Pressable onPress={() => Linking.openURL(student.portfolioUrl)} style={{ marginTop: space.lg }}>
              <Body style={{ color: colors.primary }}>View portfolio →</Body>
            </Pressable>
          ) : null}
        </>
      ) : null}
      <Gap size={space.xxl} />
      <Label style={{ marginBottom: space.md }}>Reviews</Label>
      {!reviews ? <Loading /> : reviews.length === 0 ? (
        <Muted>No reviews yet.</Muted>
      ) : (
        reviews.map((r) => (
          <Card key={r.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body>{'★'.repeat(r.rating)}</Body>
              <Muted style={{ fontSize: 13 }}>{timeAgo(r.createdAt)}</Muted>
            </Row>
            {r.comment ? <Body style={{ marginTop: space.sm }}>&ldquo;{r.comment}&rdquo;</Body> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
