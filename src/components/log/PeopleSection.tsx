'use client';

import { useState } from 'react';

import { Section } from '@/components/log/BucketSections';
import { WORD } from '@/components/SectionTitle';
import { formatVnd } from '@/lib/money';
import { cleanPersonName, sortPeople } from '@/lib/people';
import { createPerson } from '@/lib/people-store';
import type { Person } from '@/types/fina';

/** People on Log (PLAN-people.md): money that passes through, never spending. */
export default function PeopleSection({
  uid,
  people,
  selectedId,
  onSelect,
}: {
  uid: string | null;
  people: Person[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const open = sortPeople(people);
  const clean = cleanPersonName(name, people);

  const add = async () => {
    if (!uid || !clean || busy) return;
    setBusy(true);
    try {
      const p = await createPerson(uid, clean);
      onSelect(p.id);
      setName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="People"
      action={
        <button type="button" onClick={() => setAdding((v) => !v)} className={WORD} aria-expanded={adding}>
          {adding ? 'cancel' : '+ person'}
        </button>
      }
    >
      {adding && (
        <div className="mb-1.5 flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
            }}
            autoFocus
            maxLength={60}
            placeholder="Name"
            aria-label="Person name"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!clean || busy}
            className="shrink-0 rounded-md bg-ink px-3 text-[13px] text-bg disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
      {open.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {open.map((p) => {
            const selected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                aria-pressed={selected}
                className={`rounded-[10px] border border-dotted px-2.5 pb-3 pt-2.5 text-left transition-colors duration-150 ${
                  selected ? 'border-ink bg-ink text-bg' : 'border-line bg-surface-2'
                }`}
              >
                <span className="block truncate text-[13px] font-medium">{p.name}</span>
                <span className={`block text-[13px] ${selected ? 'text-bg' : 'text-muted'}`}>
                  {p.balanceVnd > 0 ? '+' : ''}
                  {formatVnd(p.balanceVnd)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}
