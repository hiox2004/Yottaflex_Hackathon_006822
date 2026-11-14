import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variants = cva('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      primary: 'border-primary/30 bg-primary/10 text-primary',
      success: 'border-success/30 bg-success/10 text-success',
      warning: 'border-warning/40 bg-warning/15 text-warning',
      danger: 'border-danger/30 bg-danger/10 text-danger',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type Tone = NonNullable<VariantProps<typeof variants>['tone']>;

export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof variants>) => (
  <span className={cn(variants({ tone }), className)} {...p} />
);
