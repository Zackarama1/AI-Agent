import type { ApplicationStatus, ContractStatus, ProjectStatus } from './types';

/** UI words: never "escrow". */
export const CONTRACT_LABEL: Record<ContractStatus, string> = {
  awaiting_funding: 'Awaiting payment',
  funded: 'Payment held',
  delivered: 'Delivered',
  released: 'Paid',
  refunded: 'Refunded',
  disputed: 'Under review',
};

export const PROJECT_LABEL: Record<ProjectStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  hired: 'Hired',
  declined: 'Not selected',
};

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
