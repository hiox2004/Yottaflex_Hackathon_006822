// Fixture: rule versions (contract: GET /rules). Thresholds are on the 0-1 score scale.
import type { Rule } from '../types';

export const rules: Rule[] = [
  {
    rule_id: 'RULE-SIM',
    version: 2,
    log_threshold: 0.3,
    review_threshold: 0.6,
    priority_threshold: 0.8,
    appeal_window_days: 14,
    effective_from: '2026-01-01T00:00:00Z',
    effective_to: null,
  },
  {
    rule_id: 'RULE-SIM',
    version: 1,
    log_threshold: 0.25,
    review_threshold: 0.55,
    priority_threshold: 0.75,
    appeal_window_days: 10,
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2026-01-01T00:00:00Z',
  },
];
