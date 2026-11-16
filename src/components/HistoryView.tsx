'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import HistoryTabs from '@/components/HistoryTabs';
import Settle from '@/components/Settle';
import TxEditSheet from '@/components/TxEditSheet';
import { MoveDetailSheet } from '@/components/MoveSheet';
import { useFlip } from '@/hooks/useFlip';
import { useHistory } from '@/hooks/useHistory';
import { useRowMotion } from '@/hooks/useRowMotion';
import { cycleLabel } from '@/lib/cycle';
import { formatTyped, formatVnd } from '@/lib/money';
import { netSpending } from '@/lib/spending';
import { listTransactionsBetween } from '@/lib/transactions';
import { searchTxs } from '@/lib/tx-search';
import BucketDot from '@/components/BucketDot';
import Page from '@/components/Page';
import SectionTitle, { WORD, WORD_GO } from '@/components/SectionTitle';
import WordSelect from '@/components/WordSelect';
import type { Transaction } from '@/types/fina';

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

export default function HistoryView() {
  const h = useHistory();
  const [editing, setEditing] = useState<Transaction | null>(null);
  // F5: "search" reads every typed or imported entry once, then filters as you type.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [reloadAll, setReloadAll] = useState(0);
  useEffect(() => {
    if (!searchOpen || !h.uid) return;
    let cancelled = false;
    listTransactionsBetween(h.uid, 0, Date.now())
      .then((txs) => {
        if (!cancelled) setAll(txs.filter((t) => t.source === 'web' || t.source === 'import'));
      })
      .catch(() => {
        if (!cancelled) setAll([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchOpen, h.uid, reloadAll]);
  const found = useMemo(
    () => searchTxs(all ?? [], query, (id) => h.byId.get(id)?.name ?? id),
    [all, query, h.byId],
  );
  const closeEditor = () => {
    setEditing(null);
    // An edit made from the results must show in them.
    if (searchOpen) setReloadAll((n) => n + 1);
  };

  // Rows a live update adds or removes animate; a new cycle or filter swaps the list.
  const scope = `${h.cycle}|${h.bucketFilter ?? ''}|${h.showAllocations}`;
  const { shown, goingIds, rose } = useRowMotion(h.rows, scope, h.settled);
  const groups = groupByDay(shown);
  // The rows below one that leaves or arrives slide to their new place.
  const flip = useFlip(shown.map((t) => t.id));

  return (
    <Page
      top={
        <HistoryTabs
          active="entries"
          right={
            <Link href="/import" className={WORD_GO}>
              MoMo
            </Link>
          }
        />
      }
    >
      {/* Filters only. The count and total sit at the end of the list. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1">
        <WordSelect value={h.cycle} onChange={(e) => h.setCycle(e.target.value)} aria-label="Cycle">
          {h.cycleIds.map((id) => {
            const { month, year } = cycleLabel(id);
            return (
              <option key={id} value={id}>
                {month} {year}
              </option>
            );
          })}
        </WordSelect>

        <WordSelect
          value={h.bucketFilter ?? ''}
          onChange={(e) => h.setBucketFilter(e.target.value || null)}
          aria-label="Bucket filter"
        >
          <option value="">All buckets</option>
          {h.buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </WordSelect>

        {h.allocationCount > 0 && (
          <button
            type="button"
            onClick={() => h.setShowAllocations(!h.showAllocations)}
            className={WORD}
          >
            {h.showAllocations ? 'hide allocations' : `+${h.allocationCount} allocations`}
          </button>
        )}
        <button
          type="button"
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen((v) => !v);
            setQuery('');
          }}
          className={WORD}
        >
          {searchOpen ? 'close search' : 'search'}
        </button>
      </header>
      {searchOpen && (
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Note or amount"
          aria-label="Search all entries"
          enterKeyHint="search"
          className="mt-2 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[15px] placeholder:text-faint"
        />
      )}

      {searchOpen ? (
        <SearchResults
          loading={all === null}
          query={query}
          found={found}
          bucketName={(id) => h.byId.get(id)?.name ?? id}
          onOpen={setEditing}
        />
      ) : shown.length === 0 ? (
        <p className="pt-6 text-[15px] text-muted">Nothing logged in this cycle.</p>
      ) : (
        groups.map(([day, txs]) => (
          <section key={day} className="pt-4">
            <SectionTitle
              action={<span className="font-normal text-faint">{formatVnd(netSpending(txs))}</span>}
            >
              {day}
            </SectionTitle>
            <ul className="border-t border-line">
              {txs.map((t) => {
                const b = h.byId.get(t.bucketId);
                const pair = t.source === 'move' && t.moveId ? h.moves.get(t.moveId) : undefined;
                // A move is neither money in nor out, so no + sign.
                const isIn = t.direction === 'in' && !pair;
                const nameOf = (x?: Transaction | null) =>
                  x ? (h.byId.get(x.bucketId)?.name ?? x.bucketId) : '?';
                const note = pair
                  ? `${nameOf(pair.from)} → ${nameOf(pair.to)}${t.note ? ` · ${t.note}` : ''}`
                  : (t.note ?? '');
                return (
                  <li
                    key={t.id}
                    ref={flip(t.id)}
                    className={`border-b border-line ${
                      goingIds.has(t.id) ? 'row-out' : rose.has(t.id) ? 'rise' : ''
                    }`}
                    aria-hidden={goingIds.has(t.id) || undefined}
                  >
                    <button
                      type="button"
                      onClick={goingIds.has(t.id) ? undefined : () => setEditing(t)}
                      tabIndex={goingIds.has(t.id) ? -1 : undefined}
                      className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 py-2 text-left min-[900px]:grid-cols-[64px_minmax(0,1fr)_auto]"
                    >
                      <span className="text-[13px] text-faint">
                        {new Date(t.occurredAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="flex min-w-0 items-center gap-2 text-[15px]">
                        <BucketDot id={pair ? '' : t.bucketId} keepSpace />
                        <span className="truncate">{pair ? 'Move' : (b?.name ?? t.bucketId)}</span>
                      </span>
                      {/* Right-aligned so the amounts line up in one column. */}
                      <span className={`text-right text-[15px] font-medium ${isIn ? 'text-muted' : ''}`}>
                        {isIn ? '+' : ''}
                        {formatVnd(t.amountVnd)}
                      </span>
                      {note && (
                        <span
                          className={`col-start-2 truncate pl-4 text-[13px] text-faint ${t.expr ? 'col-end-3' : 'col-end-4'}`}
                        >
                          {note}
                        </span>
                      )}
                      {t.expr && (
                        <span className="col-start-3 text-right text-[12px] text-faint">{formatTyped(t.expr)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {!searchOpen && h.rows.length > 0 && (
        <div className="mt-4 flex justify-between text-[13px]">
          <span className="text-muted">
            {h.rows.length} {h.rows.length === 1 ? 'entry' : 'entries'}
          </span>
          <span className="font-semibold">
            <Settle value={h.total} settled={h.settled}>
              {formatVnd(h.total)}
            </Settle>
          </span>
        </div>
      )}

      {editing && h.uid && editing.source === 'move' && editing.moveId && (
        <MoveDetailSheet
          uid={h.uid}
          legs={[h.moves.get(editing.moveId)?.from, h.moves.get(editing.moveId)?.to].filter(
            (x): x is Transaction => Boolean(x),
          )}
          byId={h.byId}
          onClose={closeEditor}
        />
      )}

      {editing && h.uid && editing.source !== 'move' && (
        <TxEditSheet
          uid={h.uid}
          tx={editing}
          buckets={h.buckets}
          beforeKind={h.byId.get(editing.bucketId)?.kind ?? 'budget'}
          onClose={closeEditor}
        />
      )}
    </Page>
  );
}

function groupByDay(rows: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of rows) {
    const key = new Date(t.occurredAt).toLocaleDateString('en-GB', DAY_FMT);
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()];
}

const SEARCH_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };

/** Matches across every cycle, newest first, with the total of what they cost. */
function SearchResults({
  loading,
  query,
  found,
  bucketName,
  onOpen,
}: {
  loading: boolean;
  query: string;
  found: ReturnType<typeof searchTxs>;
  bucketName: (id: string) => string;
  onOpen: (t: Transaction) => void;
}) {
  if (loading) return <p className="pt-6 text-[15px] text-muted">Reading…</p>;
  if (!query.trim()) return null;
  if (found.rows.length === 0) return <p className="pt-6 text-[15px] text-muted">No match.</p>;
  return (
    <>
      <ul className="flex flex-col pt-3">
        {found.rows.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onOpen(t)}
              className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-2 py-2 text-left"
            >
              <span className="text-[13px] text-faint">
                {new Date(t.occurredAt).toLocaleDateString('en-GB', SEARCH_DATE)}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-[15px]">
                <BucketDot id={t.bucketId} keepSpace />
                <span className="truncate">{bucketName(t.bucketId)}</span>
              </span>
              <span className={`text-right text-[15px] font-medium ${t.direction === 'in' ? 'text-muted' : ''}`}>
                {t.direction === 'in' ? '+' : ''}
                {formatVnd(t.amountVnd)}
              </span>
              {t.note && (
                <span className="col-start-2 col-end-4 truncate pl-4 text-[13px] text-faint">{t.note}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between text-[13px]">
        <span className="text-muted">
          {found.more ? `First ${found.rows.length}` : `${found.rows.length} ${found.rows.length === 1 ? 'entry' : 'entries'}`}
        </span>
        <span className="font-semibold">{formatVnd(found.total)}</span>
      </div>
    </>
  );
}
