import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ContractPill, FeeBreakdown } from '@/components/domain';
import { Body, Button, Card, Empty, ErrorText, Field, Gap, Heading, Label, Loading, Money, Muted, Row, Screen, StarInput } from '@/components/ui';
import { openStripe } from '@/lib/stripeFlow';
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
  const changesRequested = contract.revisionCount > 0;
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<DeliveryFile[]>([]);
  const { busy, error, run } = useAction();
  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!res.canceled) setFiles((f) => [...f, ...res.assets.map((a) => ({ name: a.name, uri: a.uri }))]);
  };
  return (
    <Card>
      <Heading>{changesRequested ? 'Deliver the changes' : 'Deliver your work'}</Heading>
      <Muted style={{ marginTop: 4, marginBottom: space.lg }}>
        {changesRequested
          ? 'They asked for some changes (see Messages). Payment is still held for you.'
          : `Payment is held. Once you deliver, it\u2019s released when they approve, or automatically after ${AUTO_RELEASE_DAYS} days.`}
      </Muted>
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

function DeliveryFileLink({ path }: { path: string }) {
  const { colors } = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const open = async () => {
    const url = await getApi().getDeliveryFileUrl(path);
    if (url) await WebBrowser.openBrowserAsync(url);
    else setNote('Files aren\u2019t stored in demo mode.');
  };
  return (
    <Pressable onPress={open} accessibilityRole="link" style={{ marginTop: 6 }}>
      <Row>
        <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
        <Body style={{ color: colors.primary }}>{path.split('/').pop()?.replace(/^\d+-/, '')}</Body>
      </Row>
      {note ? <Muted style={{ fontSize: 12 }}>{note}</Muted> : null}
    </Pressable>
  );
}

function ReviewDelivery({ contract }: { contract: Contract }) {
  const approve = useAction();
  const changes = useAction();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  return (
    <Card>
      <Heading>Happy with it?</Heading>
      <Muted style={{ marginTop: 4, marginBottom: space.lg }}>
        Approving pays {contract.studentName}.{contract.autoReleaseAt ? ` Otherwise it\u2019s paid automatically in ${daysUntil(contract.autoReleaseAt)} days.` : ''}
      </Muted>
      <ErrorText>{approve.error ?? changes.error}</ErrorText>
      {!asking ? (
        <>
          <Button testID="approve" variant="money" hapticKind="success" title="Approve and pay" loading={approve.busy} onPress={() => approve.run(() => getApi().approve(contract.id))} />
          <Button testID="ask-changes" variant="ghost" title="Ask for changes" onPress={() => setAsking(true)} style={{ marginTop: space.sm }} />
        </>
      ) : (
        <>
          <Field testID="changes-note" value={note} onChangeText={setNote} multiline placeholder="What should they change?" style={{ minHeight: 90 }} />
          <Muted style={{ fontSize: 13, marginBottom: space.md }}>Payment stays held. The 7-day auto-payment restarts when they deliver again.</Muted>
          <Row>
            <Button testID="send-changes" small title="Send" loading={changes.busy} disabled={note.trim().length < 10} onPress={() => changes.run(async () => { await getApi().requestChanges(contract.id, note); setAsking(false); setNote(''); })} />
            <Button small variant="ghost" title="Cancel" onPress={() => setAsking(false)} />
          </Row>
        </>
      )}
    </Card>
  );
}

function AdminResolve({ contract }: { contract: Contract }) {
  const { busy, error, run } = useAction();
  return (
    <Card>
      <Heading>Resolve</Heading>
      <Muted style={{ marginTop: 4, marginBottom: space.lg }}>Pay {contract.studentName} the full price, or refund {contract.companyName} the full amount they paid.</Muted>
      <ErrorText>{error}</ErrorText>
      <Row>
        <Button testID="resolve-release" small variant="money" title="Pay student" loading={busy} onPress={() => run(() => getApi().adminResolve(contract.id, 'release'))} />
        <Button testID="resolve-refund" small variant="danger" title="Refund business" disabled={busy} onPress={() => run(() => getApi().adminResolve(contract.id, 'refund'))} />
      </Row>
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
      {['cancelled', 'refunded'].includes(contract.status) ? <Gap /> : <Progress status={contract.status} />}

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
              if (checkoutUrl) await openStripe(checkoutUrl);
            })}
          />
          {getApi().mode === 'demo' ? <Muted style={{ textAlign: 'center', marginTop: space.sm, fontSize: 12 }}>Demo mode: no card is charged.</Muted> : null}
          <Button
            testID="cancel-hire"
            variant="ghost"
            title="Cancel this hire"
            disabled={fund.busy}
            onPress={() => fund.run(async () => {
              await getApi().cancelContract(contract.id);
              router.back();
            })}
            style={{ marginTop: space.sm }}
          />
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
          <Label>{deliveries.length > 1 ? `Deliveries (${deliveries.length})` : 'Delivery'} · {timeAgo(deliveries[deliveries.length - 1].createdAt)}</Label>
          {[...deliveries].reverse().map((d, i) => (
            <View key={d.id} style={{ marginTop: space.sm, opacity: i === 0 ? 1 : 0.55 }}>
              {d.message ? <Body>{d.message}</Body> : null}
              {d.files.map((f) => <DeliveryFileLink key={f} path={f} />)}
            </View>
          ))}
        </Card>
      ) : null}

      {contract.status === 'delivered' && isBusiness ? <ReviewDelivery contract={contract} /> : null}
      {contract.status === 'delivered' && isStudent && contract.autoReleaseAt ? (
        <Card><Heading>Delivered</Heading><Muted style={{ marginTop: 4 }}>You&apos;ll be paid when they approve, or automatically in {daysUntil(contract.autoReleaseAt)} days.</Muted></Card>
      ) : null}
      {contract.status === 'disputed' ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderWidth: 0 }}>
          <Heading>We&apos;re looking into it</Heading>
          <Muted style={{ marginTop: 4 }}>The payment stays protected while the Collabify team helps you both sort it out.</Muted>
          {contract.issueReason ? <Body style={{ marginTop: space.md }}>&ldquo;{contract.issueReason}&rdquo;</Body> : null}
        </Card>
      ) : null}
      {contract.status === 'disputed' && me.role === 'admin' ? <AdminResolve contract={contract} /> : null}
      {contract.status === 'refunded' ? (
        <Card><Heading>Refunded</Heading><Muted style={{ marginTop: 4 }}>{isStudent ? 'This project was closed and the business refunded.' : 'You\u2019ve been refunded in full.'}</Muted></Card>
      ) : null}
      {contract.status === 'cancelled' ? (
        <Card><Heading>Cancelled</Heading><Muted style={{ marginTop: 4 }}>This hire was cancelled before payment.</Muted></Card>
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
