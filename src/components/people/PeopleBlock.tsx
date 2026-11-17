'use client';

import { useState } from 'react';

import PersonSheet from '@/components/people/PersonSheet';
import { usePeople } from '@/hooks/usePeople';
import { formatVnd } from '@/lib/money';
import { balanceWord, bankExtra, openBalances, sortPeople } from '@/lib/people';
import type { Bucket } from '@/types/fina';

/** People on Summary: who owes whom. Settled people are one faint line. */
export default function PeopleBlock({ uid, buckets }: { uid: string; buckets: Bucket[] }) {
  const people = usePeople(uid);
  const [openId, setOpenId] = useState<string | null>(null);
  const withMoney = openBalances(people);
  const settled = sortPeople(people).filter((p) => p.balanceVnd === 0);
  const extra = bankExtra(people);
  const open = people.find((p) => p.id === openId) ?? null;

  if (withMoney.length === 0 && settled.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="text-[13px] font-medium text-muted">People</h2>
      {withMoney.length > 0 && (
        <ul className="mt-2 text-[15px]">
          {withMoney.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-baseline gap-3 py-1.5 text-left">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-medium">
                  {p.balanceVnd > 0 ? '+' : ''}
                  {formatVnd(p.balanceVnd)}
                </span>
                <span className="w-16 shrink-0 text-right text-[13px] text-muted">{balanceWord(p.balanceVnd)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {settled.length > 0 && (
        <p className="mt-1 text-[13px] text-faint">
          settled:{' '}
          {settled.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ' · '}
              <button type="button" onClick={() => setOpenId(p.id)} className="hover:text-ink">
                {p.name}
              </button>
            </span>
          ))}
        </p>
      )}
      {extra !== 0 && (
        <p className="mt-2 text-[13px] text-muted">
          Bank holds {formatVnd(Math.abs(extra))} {extra > 0 ? 'more' : 'less'} than the buckets
        </p>
      )}
      {open && <PersonSheet uid={uid} person={open} buckets={buckets} onClose={() => setOpenId(null)} />}
    </section>
  );
}
