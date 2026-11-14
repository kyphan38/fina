import type { SelectHTMLAttributes } from 'react';

/**
 * A native select that reads as a word with a small ▾, not a boxed field.
 * The native picker still opens on tap, which is the best one on a phone.
 */
export default function WordSelect({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <select
        {...props}
        className="appearance-none bg-transparent py-1 pr-4 [field-sizing:content] text-[13px] text-muted hover:text-ink focus-visible:text-ink"
      />
      <span aria-hidden="true" className="pointer-events-none absolute right-0 text-[11px] text-faint">
        ▾
      </span>
    </span>
  );
}
