import type { Bank } from '@/types/fina';

const BANKS: Bank[] = ['VCB', 'BIDV', 'Cash'];

/** Which account the People money went through, so the bank check stays right. */
export default function PersonBank({ bank, onChange }: { bank: Bank; onChange: (b: Bank) => void }) {
  return (
    <div role="radiogroup" aria-label="Account" className="flex gap-3.5 px-1 pb-2 text-[13px]">
      {BANKS.map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={bank === b}
          onClick={() => onChange(b)}
          className={bank === b ? 'font-medium text-ink' : 'text-faint hover:text-ink'}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
