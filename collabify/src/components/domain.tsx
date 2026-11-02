import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { feeFor, formatGBP, hourlyRatePence, type Plan, PLANS } from '@/lib/fees';
import { CONTRACT_LABEL, PROJECT_LABEL, timeAgo } from '@/lib/format';
import type { Contract, ContractStatus, Project, ProjectStatus } from '@/lib/types';
import { fonts, space, useTheme } from '@/theme';
import { Body, Card, Divider, Heading, LineItem, Money, Muted, Pill, Row } from './ui';

const CONTRACT_TONE: Record<ContractStatus, 'neutral' | 'primary' | 'money' | 'warning' | 'danger'> = {
  awaiting_funding: 'warning', funded: 'primary', delivered: 'primary', released: 'money', refunded: 'neutral', disputed: 'danger',
};
export const ContractPill = ({ status }: { status: ContractStatus }) => <Pill label={CONTRACT_LABEL[status]} tone={CONTRACT_TONE[status]} />;

const PROJECT_TONE: Record<ProjectStatus, 'neutral' | 'primary' | 'money' | 'warning'> = {
  open: 'money', in_progress: 'primary', delivered: 'primary', completed: 'neutral', cancelled: 'neutral',
};
export const ProjectPill = ({ status }: { status: ProjectStatus }) => <Pill label={PROJECT_LABEL[status]} tone={PROJECT_TONE[status]} />;

export function ProjectCard({ project, onPress, matchScore, showStatus }: { project: Project; onPress: () => void; matchScore?: number; showStatus?: boolean }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} testID={`project-${project.id}`}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Row gap={6}>
          {project.featured ? <Pill label="Featured" tone="primary" /> : null}
          <Pill label={project.category} />
        </Row>
        {showStatus ? <ProjectPill status={project.status} /> : <Muted style={{ fontSize: 13 }}>{timeAgo(project.createdAt)}</Muted>}
      </Row>
      <Heading>{project.title}</Heading>
      <Muted style={{ marginTop: 2 }}>{project.companyName}</Muted>
      <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
        <Row gap={space.md}>
          <Money pence={project.budgetPence} size={22} />
          <Muted style={{ fontSize: 13 }}>{project.estimatedHours}h · {formatGBP(hourlyRatePence(project.budgetPence, project.estimatedHours))}/h</Muted>
        </Row>
        {matchScore != null && matchScore > 0 ? (
          <Row gap={4}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
            <Body style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.primary }}>{matchScore}%</Body>
          </Row>
        ) : (
          <Muted style={{ fontSize: 13 }}>{project.applicantCount} applied</Muted>
        )}
      </Row>
    </Card>
  );
}

/** What the business pays: price + service fee. Students always receive the full price. */
export function FeeBreakdown({ amountPence, plan, contract }: { amountPence?: number; plan?: Plan; contract?: Contract }) {
  const f = contract
    ? { amountPence: contract.amountPence, feeRate: contract.feeRate, feePence: contract.feePence, totalPence: contract.totalPence }
    : feeFor(amountPence ?? 0, plan ?? 'free');
  return (
    <View>
      <LineItem label="Project price" value={formatGBP(f.amountPence, { exact: true })} />
      <LineItem label={`Service fee (${Math.round(f.feeRate * 100)}%${plan ? `, ${PLANS[plan].name} plan` : ''})`} value={formatGBP(f.feePence, { exact: true })} />
      <Divider />
      <LineItem label="You pay" strong value={formatGBP(f.totalPence, { exact: true })} />
      <LineItem label="Student receives" value={<Money pence={f.amountPence} exact size={16} />} />
    </View>
  );
}
