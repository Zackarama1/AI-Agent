import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ContractPill, FeeBreakdown } from '@/components/domain';
import { useFeedback } from '@/components/feedback';
import { FadeIn } from '@/components/motion';
import { Avatar, Body, Button, Card, Empty, ErrorText, Field, Gap, Heading, Label, Loading, Money, Muted, Row, Screen, StarInput } from '@/components/ui';
import { getApi, type DeliveryFile } from '@/lib/api';
import { contractFlow, type FlowState, type FlowTone, type Viewer } from '@/lib/contractFlow';
import { AUTO_RELEASE_DAYS, formatGBP } from '@/lib/fees';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/lib/session';
import { openStripe } from '@/lib/stripeFlow';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Contract } from '@/lib/types';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/theme';

/** Milestones already celebrated this session, per person, so each celebration plays once for each of them. */
const celebrated = new Set<string>();

function toneColors(tone: FlowTone, c: ThemeColors) {
  return {
    action: { bg: c.primarySoft, accent: c.primary },
    waiting: { bg: c.surfaceAlt, accent: c.textMuted },
    done: { bg: c.moneySoft, accent: c.moneyText },
    problem: { bg: c.warningSoft, accent: c.warning },
    closed: { bg: c.surfaceAlt, accent: c.textMuted },
  }[tone];
}

function Progress({ flow }: { flow: FlowState }) {
  const { colors } = useTheme();
  const idx = flow.stepIndex;
  return (
    <Row gap={0} style={{ marginVertical: space.xl }}>
      {flow.steps.map((label, i) => (
        <View key={label} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= idx ? colors.primary : colors.border }} />
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= idx ? colors.primary : i === idx + 1 ? colors.primarySoft : colors.surfaceAlt }}>
              {i <= idx ? <Ionicons name="checkmark" size={15} color="#fff" /> : <Muted style={{ fontSize: 11, color: i === idx + 1 ? colors.primary : colors.textMuted }}>{i + 1}</Muted>}
            </View>
            <View style={{ flex: 1, height: 2, backgroundColor: i === flow.steps.length - 1 ? 'transparent' : i < idx ? colors.primary : colors.border }} />
          </View>
          <Muted style={{ fontSize: 11, marginTop: 6, color: i <= idx ? colors.text : colors.textMuted }}>{label}</Muted>
        </View>
      ))}
    </Row>
  );
}

/** Shrinking bar for the 7-day auto-payment window. */
function Countdown({ days }: { days: number }) {
  const { colors } = useTheme();
  const share = Math.max(0.04, Math.min(1, days / AUTO_RELEASE_DAYS));
  return (
    <View style={{ marginTop: space.md }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${share * 100}%`, height: '100%', backgroundColor: colors.primary }} />
      </View>
      <Muted style={{ fontSize: 12, marginTop: 6 }}>{days === 0 ? 'Auto-pays today' : `Auto-pays in ${days} day${days === 1 ? '' : 's'}`}</Muted>
    </View>
  );
}

// ---------- actions ----------

function FundAction({ contract }: { contract: Contract }) {
  const { toast } = useFeedback();
  const fund = useAction();
  return (
    <View style={{ marginTop: space.lg }}>
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
          else toast('Payment held', 'lock-closed');
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
          toast('Hire cancelled. Your project is open again.', 'arrow-undo');
          router.back();
        })}
        style={{ marginTop: space.xs }}
      />
    </View>
  );
}

function DeliverAction({ contract }: { contract: Contract }) {
  const { toast } = useFeedback();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<DeliveryFile[]>([]);
  const { busy, error, run } = useAction();
  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!res.canceled) setFiles((f) => [...f, ...res.assets.map((a) => ({ name: a.name, uri: a.uri }))]);
  };
  const ready = message.trim().length >= 5 || files.length > 0;
  return (
    <View style={{ marginTop: space.lg }}>
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
        icon="paper-plane"
        hapticKind="success"
        loading={busy}
        disabled={!ready}
        onPress={() => run(async () => {
          await getApi().deliver(contract.id, message, files);
          toast(`Delivered. ${contract.companyName} has ${AUTO_RELEASE_DAYS} days to review.`, 'paper-plane');
        })}
      />
    </View>
  );
}

function ApproveAction({ contract }: { contract: Contract }) {
  const { toast, celebrate } = useFeedback();
  const approve = useAction();
  const changes = useAction();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  return (
    <View style={{ marginTop: space.lg }}>
      <ErrorText>{approve.error ?? changes.error}</ErrorText>
      {!asking ? (
        <>
          <Button
            testID="approve"
            variant="money"
            hapticKind="none"
            icon="checkmark-circle"
            title={`Approve and pay ${formatGBP(contract.amountPence)}`}
            loading={approve.busy}
            onPress={() => approve.run(async () => {
              await getApi().approve(contract.id);
              celebrated.add(`${contract.businessId}:${contract.id}:paid`);
              celebrate({ title: 'Project complete', subtitle: `${contract.studentName} has been paid ${formatGBP(contract.amountPence)}.`, icon: 'checkmark-done' });
            })}
          />
          <Button testID="ask-changes" variant="ghost" title="Ask for changes" onPress={() => setAsking(true)} style={{ marginTop: space.xs }} />
        </>
      ) : (
        <>
          <Field testID="changes-note" value={note} onChangeText={setNote} multiline placeholder="What should they change?" style={{ minHeight: 90 }} />
          <Muted style={{ fontSize: 13, marginBottom: space.md }}>Payment stays held. The 7-day auto-payment restarts when they deliver again.</Muted>
          <Row>
            <Button
              testID="send-changes"
              small
              title="Send"
              loading={changes.busy}
              disabled={note.trim().length < 10}
              onPress={() => changes.run(async () => {
                await getApi().requestChanges(contract.id, note);
                setAsking(false);
                setNote('');
                toast('Changes requested', 'create');
              })}
            />
            <Button small variant="ghost" title="Cancel" onPress={() => setAsking(false)} />
          </Row>
        </>
      )}
    </View>
  );
}

function ResolveAction({ contract }: { contract: Contract }) {
  const { toast } = useFeedback();
  const { busy, error, run } = useAction();
  return (
    <View style={{ marginTop: space.lg }}>
      {contract.issueReason ? <Body style={{ marginBottom: space.md }}>&ldquo;{contract.issueReason}&rdquo;</Body> : null}
      <ErrorText>{error}</ErrorText>
      <Row>
        <Button testID="resolve-release" small variant="money" title="Pay student" loading={busy} onPress={() => run(async () => { await getApi().adminResolve(contract.id, 'release'); toast('Paid to the student'); })} />
        <Button testID="resolve-refund" small variant="danger" title="Refund business" disabled={busy} onPress={() => run(async () => { await getApi().adminResolve(contract.id, 'refund'); toast('Refunded in full', 'arrow-undo'); })} />
      </Row>
    </View>
  );
}

function ReviewAction({ contract, other }: { contract: Contract; other: string }) {
  const { toast } = useFeedback();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { busy, error, run } = useAction();
  return (
    <View style={{ marginTop: space.lg }}>
      <StarInput value={rating} onChange={setRating} />
      <Gap size={space.lg} />
      <Field value={comment} onChangeText={setComment} multiline placeholder={`What was it like working with ${other}?`} style={{ minHeight: 90 }} />
      <ErrorText>{error}</ErrorText>
      <Button
        testID="submit-review"
        title="Submit review"
        loading={busy}
        hapticKind="success"
        onPress={() => run(async () => {
          await getApi().submitReview(contract.id, rating, comment);
          toast('Review sent', 'star');
        })}
      />
    </View>
  );
}

function RevealedReviews({ contract, other }: { contract: Contract; other: string }) {
  const { data } = useQuery((api) => api.getContractReviews(contract.id), [contract.id]);
  if (!data?.mine) return null;
  return (
    <FadeIn>
      <Card>
        <Label>Reviews</Label>
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
    </FadeIn>
  );
}

function ReportProblem({ contract }: { contract: Contract }) {
  const { colors } = useTheme();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  if (!open) return <Button variant="ghost" title="Report a problem" onPress={() => setOpen(true)} style={{ marginTop: space.lg }} />;
  return (
    <FadeIn>
      <View style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.surfaceAlt, marginTop: space.lg }}>
        <Heading style={{ fontSize: 16, marginBottom: space.sm }}>What went wrong?</Heading>
        <Field value={reason} onChangeText={setReason} multiline placeholder="Messaging first usually fixes things. If not, tell us here." style={{ minHeight: 90, backgroundColor: colors.surface }} />
        <ErrorText>{error}</ErrorText>
        <Row>
          <Button small variant="danger" title="Report" loading={busy} onPress={() => run(async () => { await getApi().raiseIssue(contract.id, reason); setOpen(false); toast('Reported. We’ll be in touch.', 'alert-circle'); })} />
          <Button small variant="ghost" title="Cancel" onPress={() => setOpen(false)} />
        </Row>
      </View>
    </FadeIn>
  );
}

function DeliveryFileLink({ path }: { path: string }) {
  const { colors } = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const open = async () => {
    const url = await getApi().getDeliveryFileUrl(path);
    if (url) await WebBrowser.openBrowserAsync(url);
    else setNote('Files aren’t stored in demo mode.');
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

// ---------- screen ----------

export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const { celebrate } = useFeedback();
  const { data: contract, error } = useQuery((api) => api.getContract(id), [id]);
  const { data: deliveries } = useQuery((api) => api.listDeliveries(id), [id]);
  const { data: reviews } = useQuery((api) => api.getContractReviews(id), [id]);

  const viewer: Viewer | null = !contract ? null : me.role === 'admin' ? 'admin' : me.id === contract.studentId ? 'student' : 'business';
  const status = contract?.status;

  // Celebrate the student's big moments the first time they see them: a new hire, and getting paid.
  useEffect(() => {
    if (!contract || viewer !== 'student') return;
    const moment = contract.status === 'released' ? 'paid' : ['awaiting_funding', 'funded'].includes(contract.status) && !contract.deliveredAt && contract.revisionCount === 0 ? 'hired' : null;
    if (!moment) return;
    const key = `${me.id}:${contract.id}:${moment}`;
    if (celebrated.has(key)) return;
    celebrated.add(key);
    celebrate(moment === 'paid'
      ? { title: `You’ve been paid ${formatGBP(contract.amountPence)}`, subtitle: `${contract.projectTitle} is complete. Nice work.`, icon: 'cash' }
      : { title: 'You’re hired!', subtitle: `${contract.companyName} chose you for ${contract.projectTitle}.`, icon: 'rocket' });
  }, [contract, status, viewer, celebrate, me.id]);

  if (error) return <Screen edges={[]}><ErrorText>{error.message}</ErrorText></Screen>;
  if (contract === undefined) return <Loading />;
  if (!contract || !viewer) return <Screen edges={[]}><Empty title="Not found" /></Screen>;

  const flow = contractFlow(contract, viewer, { hasReviewed: Boolean(reviews?.mine) });
  const tone = toneColors(flow.tone, colors);
  const isStudent = viewer === 'student';
  const otherName = isStudent ? contract.companyName : contract.studentName;
  const otherId = isStudent ? contract.businessId : contract.studentId;

  return (
    <Screen edges={[]}>
      <FadeIn>
        <ContractPill status={contract.status} />
        <Gap size={space.md} />
        <Heading style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.9, fontFamily: fonts.heavy }}>{contract.projectTitle}</Heading>
        <Pressable onPress={() => router.push(`/people/${otherId}`)} accessibilityRole="link" style={{ marginTop: space.md }}>
          <Row>
            <Avatar name={otherName} size={32} />
            <Body style={{ fontFamily: fonts.semibold, flex: 1 }} numberOfLines={1}>{otherName}</Body>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Row>
        </Pressable>
      </FadeIn>

      {flow.showProgress ? <FadeIn index={1}><Progress flow={flow} /></FadeIn> : <Gap />}

      {/* The one thing to know, and the one thing to do, right now. */}
      <FadeIn index={2}>
        <View testID="next-step" style={{ backgroundColor: tone.bg, borderRadius: radius.xl, padding: space.xl, marginBottom: space.md }}>
          {flow.waitingOn && flow.tone !== 'action' ? (
            <Label style={{ color: tone.accent, marginBottom: space.sm }}>
              {flow.waitingOn === 'collabify' ? 'With the Collabify team' : `Waiting on ${flow.waitingOn === viewer ? 'you' : otherName}`}
            </Label>
          ) : flow.tone === 'action' ? (
            <Label style={{ color: tone.accent, marginBottom: space.sm }}>Your move</Label>
          ) : null}
          <Heading style={{ fontSize: 24, lineHeight: 28, letterSpacing: -0.6, fontFamily: fonts.heavy }}>{flow.headline}</Heading>
          <Body style={{ marginTop: space.sm, color: colors.textMuted }}>{flow.detail}</Body>
          {flow.autoReleaseInDays !== null ? <Countdown days={flow.autoReleaseInDays} /> : null}
          {contract.status === 'disputed' && viewer !== 'admin' && contract.issueReason ? <Body style={{ marginTop: space.md }}>&ldquo;{contract.issueReason}&rdquo;</Body> : null}

          {flow.primary === 'fund' ? <FundAction contract={contract} /> : null}
          {flow.primary === 'deliver' ? <DeliverAction contract={contract} /> : null}
          {flow.primary === 'approve' ? <ApproveAction contract={contract} /> : null}
          {flow.primary === 'resolve' ? <ResolveAction contract={contract} /> : null}
          {flow.primary === 'review' ? <ReviewAction contract={contract} other={otherName} /> : null}
        </View>
      </FadeIn>

      <FadeIn index={3}>
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
      </FadeIn>

      {deliveries && deliveries.length > 0 ? (
        <FadeIn index={4}>
          <Card>
            <Label>{deliveries.length > 1 ? `Deliveries (${deliveries.length})` : 'Delivery'} · {timeAgo(deliveries[deliveries.length - 1].createdAt)}</Label>
            {[...deliveries].reverse().map((d, i) => (
              <View key={d.id} style={{ marginTop: space.sm, opacity: i === 0 ? 1 : 0.55 }}>
                {d.message ? <Body>{d.message}</Body> : null}
                {d.files.map((f) => <DeliveryFileLink key={f} path={f} />)}
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {contract.status === 'released' ? <RevealedReviews contract={contract} other={otherName} /> : null}

      <FadeIn index={5}>
        <Gap size={space.sm} />
        <Button testID="open-chat" variant="secondary" icon="chatbubble-ellipses" title={`Message ${otherName.split(' ')[0]}`} onPress={() => router.push(`/chat/${contract.id}`)} />
        {flow.secondary.includes('reportProblem') ? <ReportProblem contract={contract} /> : null}
      </FadeIn>
    </Screen>
  );
}
