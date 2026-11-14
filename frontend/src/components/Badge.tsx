// Status and band badges: icon + text + colour, never colour alone.
import {
  CircleDot,
  Flag,
  FileText,
  Gavel,
  Lock,
  Minus,
  Scale,
  Search,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { Band, Status } from '../api/types';
import { BAND_LABEL, STATUS_LABEL } from '../labels';

const STATUS_VIEW: Record<Status, { icon: LucideIcon; tone: string }> = {
  open: { icon: CircleDot, tone: 'info' },
  under_review: { icon: Search, tone: 'warn' },
  decided: { icon: Gavel, tone: 'neutral' },
  appealed: { icon: Scale, tone: 'warn' },
  appeal_review: { icon: Scale, tone: 'warn' },
  appeal_decided: { icon: ShieldCheck, tone: 'neutral' },
  closed: { icon: Lock, tone: 'muted' },
};

const BAND_VIEW: Record<Band, { icon: LucideIcon; tone: string }> = {
  priority_review: { icon: TriangleAlert, tone: 'fail' },
  review: { icon: Flag, tone: 'warn' },
  log_only: { icon: FileText, tone: 'muted' },
  no_action: { icon: Minus, tone: 'muted' },
};

export function StatusBadge({ status }: { status: Status }) {
  const { icon: Icon, tone } = STATUS_VIEW[status];
  return (
    <span className={`badge tone-${tone}`}>
      <Icon size={14} aria-hidden /> {STATUS_LABEL[status]}
    </span>
  );
}

export function BandBadge({ band }: { band: Band }) {
  const { icon: Icon, tone } = BAND_VIEW[band];
  return (
    <span className={`badge tone-${tone}`}>
      <Icon size={14} aria-hidden /> {BAND_LABEL[band]}
    </span>
  );
}
