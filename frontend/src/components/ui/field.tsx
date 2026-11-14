// Native form controls styled like shadcn inputs (native select keeps keyboard and mobile behaviour).
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const base = 'w-full rounded-md border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cn(base, 'h-9', className)} {...p} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cn(base, 'h-9', className)} {...p} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn(base, 'py-2', className)} {...p} />
);
