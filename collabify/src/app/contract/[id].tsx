import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { ContractPill, FeeBreakdown } from '@/components/domain';
import { Body, Button, Card, Empty, ErrorText, Field, Gap, Heading, Label, Loading, Money, Muted, Row, Screen, StarInput } from '@/components/ui';
import { getApi, type DeliveryFile } from '@/lib/api';
import { AUTO_RELEASE_DAYS, formatGBP } from '@/lib/fees';
import { daysUntil, timeAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useMe } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Contract } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

const STEPS: { key: Contract['status']; label: string }[] = [
  { key: 'awaiting_funding', label: 'Hired' },
  { key: 'funded', label: 'Payment held' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'released', label: 'Paid' },
];

function Progress({ status }: { status: Contract['status'] }) {
  const { colors } = useTheme();
  const idx = status === 'disputed' ? 1 : STEPS.findIndex((s) => s.key === status);
  return (
    <Row gap={0} style={{ marginVertical: space.xl }}>
      {STEPS.map((s, i) => (
        <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= idx ? colors.primary : colors.border }} />
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= idx ? colors.primary : colors.surfaceAlt }}>
              {i <= idx ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Muted style={{ fontSize: 11 }}>{i + 1}</Muted>}
            </View>
            <View style={{ flex: 1, height: 2, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < idx ? colors.primary : colors.border }} />
          </View>
          <Muted style={{ fontSize: 11, marginTop: 6, color: i <= idx ? colors.text : colors.textMuted }}>{s.label}</Muted>
        </View>
      ))}
    </Row>
  );
}

function Deliver({ contract }: { contract: Contract }) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<DeliveryFile[]>([]);
  const { busy, error, run } = useAction();
  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!res.canceled) setFiles((f) => [...f, ...res.assets.map((a) => ({ name: a.name, uri: a.uri }))]);
  };
  return (
    <Card>
      <Heading>Deliver your work</Heading>
      <Muted style={{ marginTop: 4, marginBottom: space.lg }}>Payment is held. Once you deliver, it&apos;s released when they approve, or automatically after {AUTO_RELEASE_DAYS} days.</Muted>
      <Field testID="delivery-message" value={message} onChangeText={setMessage} multiline placeholder="What you did, plus any links" />
      {files.map((f, i) => (
        <Row key={`${f.name}-${i}`} style={{ marginBottom: space.sm }}>
          <Ionicons name="document-outline" size={18} />
          <Body style={{ flex: 1 }} numberOfLines={1}>{f.name}</Body>
          <Button small variant="ghost" title="Remove" onPress={() => setFiles(files.filter((_, j) => j !== i))} />
        </Row>
      ))}
      <Button small variant="secondary" icon="attach" title="Attach files" onPress={pick} style={{ alignSelf: 'flex-start', marginBottom: space.lg }} />
      <ErrorText>{error}</ErrorText>
      <Button
        testID="deliver"
        title="Deliver"
        hapticKind="success"
        loading={busy}
        disabled={message.trim().length < 5 && files.length === 0}
        onPress={() => run(() => getApi().deliver(contract.id, message, files))}
      />
    </Card>
  );
}

function Reviews({ contract, isStudent }: { contract: Contract; isStudent: boolean }) {
  const { data } = useQuery((api) => api.getContractReviews(contract.id), [contract.id]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { busy, error, run } = useAction();
  const other = isStudent ? contract.companyName : contract.studentName;
  if (!data) return null;
  if (!data.mine) {
    return (
      <Card>
        <Heading>Rate {other}</Heading>
        <Muted style={{ marginTop: 4, marginBottom: space.lg }}>Reviews are blind: neither of you sees the other&apos;s until both are in.</Muted>
        <StarInput value={rating} onChange={setRating} />
        <Gap size={space.lg} />
        <Field value={comment} onChangeText={setComment} multiline placeholder="How was it working together?" style={{ minHeight: 90 }} />
        <ErrorText>{error}</ErrorText>
        <Button testID="submit-review" title="Submit review" loading={busy} onPress={() => run(async () => { await getApi().submitReview(contract.id, rating, comment); haptic.success(); })} />
      </Card>
    );
  }
  return (
    <Card>
      <Heading>Reviews</Heading>
      <Muted style={{ marginTop: 4 }}>You gave {'★'.repeat(data.mine.rating)}</Muted>
      {data.theirs ? (
        <View style={{ marginTop: space.md }}>
          <Label>{other} gave you {'★'.repeat(data.theirs.rating)}</Label>
          {data.theirs.comment ? <Body style={{ marginTop: 4 }}>&ldquo;{data.theirs.comment}&rdquo;</Body> : null}
        </View>
      ) : (
        <Muted style={{ marginTop: space.md }}>{other}&apos;s review will appear once they&apos;ve submitted theirs.</Muted>
      )}
    </Card>
  );
}

export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const { data: contract, error } = useQuery((api) => api.getContract(id), [id]);
  const { data: deliveries } = useQuery((api) => api.listDeliveries(id), [id]);
  const fund = useAction();
  const approve = useAction();
  const issue = useAction();
  const [issueOpen, setIssueOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (error) return <Screen edges={[]}><ErrorText>{error.message}</ErrorText></Screen>;
  if (contract === undefined) return <Loading />;
  if (!contract) return <Screen edges={[]}><Empty title="Not found" /></Screen>;
  const isStudent = me.id === contract.studentId;
  const isBusiness = me.id === contract.businessId;

  return (
    <Screen edges={[]}>
      <ContractPill status={contract.status} />
      <Gap size={space.md} />
      <Heading style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.9, fontFamily: fonts.heavy }}>{contract.projectTitle}</Heading>
      <Muted style={{ marginTop: 4 }}>{isStudent ? contract.companyName : contract.studentName}</Muted>
      <Progress status={contract.status} />

      {isStudent ? (
        <Card style={{ backgroundColor: colors.moneySoft, borderWidth: 0 }}>
          <Label>{contract.status === 'released' ? 'You were paid' : 'You receive'}</Label>
          <Money pence={contract.amountPence} size={40} exact />
          <Muted style={{ fontSize: 13 }}>100% of the project price. No fees for students.</Muted>
        </Card>
      ) : (
        <Card>
          <FeeBreakdown contract={contract} />
        </Card>
      )}

      {/* Business: pay to start */}
      {isBusiness && contract.status === 'awaiting_funding' ? (
        <Card>
          <Heading>Pay to get started</Heading>
          <Muted style={{ marginTop: 4, marginBottom: space.lg }}>Your payment is held safely and only released when you approve the work.</Muted>
          <ErrorText>{fund.error}</ErrorText>
          <Button
            testID="fund"
            variant="money"
            hapticKind="success"
            icon="lock-closed"
            title={`Pay ${formatGBP(contract.totalPence, { exact: true })}`}
            loading={fund.busy}
            onPress={() => fund.run(async () => {
              const { checkoutUrl } = await getApi().fundContract(contract.id);
              if (checkoutUrl) await WebBrowser.openBrowserAsync(checkoutUrl);
            })}
          />
          {getApi().mode === 'demo' ? <Muted style={{ textAlign: 'center', marginTop: space.sm, fontSize: 12 }}>Demo mode: no card is charged.</Muted> : null}
        </Card>
      ) : null}
      {isStudent && contract.status === 'awaiting_funding' ? (
        <Card><Heading>You&apos;re hired!</Heading><Muted style={{ marginTop: 4 }}>Wait for the payment to be held before you start.</Muted></Card>
      ) : null}

      {isStudent && contract.status === 'funded' ? <Deliver contract={contract} /> : null}
      {isBusiness && contract.status === 'funded' ? (
        <Card><Heading>Payment held</Heading><Muted style={{ marginTop: 4 }}>{contract.studentName} is working on it.</Muted></Card>
      ) : null}

      {deliveries && deliveries.length > 0 ? (
        <Card>
          <Label>Delivery · {timeAgo(deliveries[deliveries.length - 1].createdAt)}</Label>
          {deliveries.map((d) => (
            <View key={d.id} style={{ marginTop: space.sm }}>
              {d.message ? <Body>{d.message}</Body> : null}
              {d.files.map((f) => (
                <Row key={f} style={{ marginTop: 6 }}>
                  <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
                  <Body style={{ color: colors.primary }}>{f.split('/').pop()}</Body>
                </Row>
              ))}
            </View>
          ))}
        </Card>
      ) : null}

      {contract.status === 'delivered' && isBusiness ? (
        <Card>
          <Heading>Happy with it?</Heading>
          <Muted style={{ marginTop: 4, marginBottom: space.lg }}>
            Approving pays {contract.studentName}.{contract.autoReleaseAt ? ` Otherwise it’s paid automatically in ${daysUntil(contract.autoReleaseAt)} days.` : ''}
          </Muted>
          <ErrorText>{approve.error}</ErrorText>
          <Button testID="approve" variant="money" hapticKind="success" title="Approve and pay" loading={approve.busy} onPress={() => approve.run(() => getApi().approve(contract.id))} />
        </Card>
      ) : null}
      {contract.status === 'delivered' && isStudent && contract.autoReleaseAt ? (
        <Card><Heading>Delivered</Heading><Muted style={{ marginTop: 4 }}>You&apos;ll be paid when they approve, or automatically in {daysUntil(contract.autoReleaseAt)} days.</Muted></Card>
      ) : null}
      {contract.status === 'disputed' ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderWidth: 0 }}><Heading>We&apos;re looking into it</Heading><Muted style={{ marginTop: 4 }}>The payment stays protected while the Collabify team helps you both sort it out.</Muted></Card>
      ) : null}

      {contract.status === 'released' ? <Reviews contract={contract} isStudent={isStudent} /> : null}

      <Gap size={space.sm} />
      <Button testID="open-chat" variant="secondary" icon="chatbubble-ellipses" title="Messages" onPress={() => router.push(`/chat/${contract.id}`)} />

      {['funded', 'delivered'].includes(contract.status) ? (
        <View style={{ marginTop: space.lg }}>
          {!issueOpen ? (
            <Button variant="ghost" title="Report a problem" onPress={() => setIssueOpen(true)} />
          ) : (
            <View style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.surfaceAlt }}>
              <Field value={reason} onChangeText={setReason} multiline placeholder="What went wrong? Messaging first usually fixes things." style={{ minHeight: 90, backgroundColor: colors.surface }} />
              <ErrorText>{issue.error}</ErrorText>
              <Row>
                <Button small variant="danger" title="Report" loading={issue.busy} onPress={() => issue.run(async () => { await getApi().raiseIssue(contract.id, reason); setIssueOpen(false); })} />
                <Button small variant="ghost" title="Cancel" onPress={() => setIssueOpen(false)} />
              </Row>
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
