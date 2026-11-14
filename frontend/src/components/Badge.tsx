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
import { Badge, type Tone } from './ui/badge';

const STATUS_VIEW: Record<Status, { icon: LucideIcon; tone: Tone }> = {
  open: { icon: CircleDot, tone: 'primary' },
  under_review: { icon: Search, tone: 'warning' },
  decided: { icon: Gavel, tone: 'neutral' },
  appealed: { icon: Scale, tone: 'warning' },
  appeal_review: { icon: Scale, tone: 'warning' },
  appeal_decided: { icon: ShieldCheck, tone: 'neutral' },
  closed: { icon: Lock, tone: 'neutral' },
};

const BAND_VIEW: Record<Band, { icon: LucideIcon; tone: Tone }> = {
  priority_review: { icon: TriangleAlert, tone: 'danger' },
  review: { icon: Flag, tone: 'warning' },
  log_only: { icon: FileText, tone: 'neutral' },
  no_action: { icon: Minus, tone: 'neutral' },
};

export function StatusBadge({ status }: { status: Status }) {
  const { icon: Icon, tone } = STATUS_VIEW[status];
  return (
    <Badge tone={tone} className="gap-1">
      <Icon size={14} aria-hidden /> {STATUS_LABEL[status]}
    </Badge>
  );
}

export function BandBadge({ band }: { band: Band }) {
  const { icon: Icon, tone } = BAND_VIEW[band];
  return (
    <Badge tone={tone} className="gap-1">
      <Icon size={14} aria-hidden /> {BAND_LABEL[band]}
    </Badge>
  );
}
