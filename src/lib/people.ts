// ============================================================
// fina - People: money that passes through (PLAN-people.md)
//
// A person's balance: + they owe you, - you owe them. `out` (money to them)
// raises it, `in` (money from them) lowers it. Pure: no Firebase.
// ============================================================

import type { Person, Transaction, TxDirection } from '@/types/fina';

export const PERSON_NAME_MAX = 60;

/** Effect of one entry on the person's balance. */
export function personDelta(direction: TxDirection, amountVnd: number): number {
  return direction === 'out' ? amountVnd : -amountVnd;
}

/** A trimmed name, or null when empty or taken by an open person (case and accents count). */
export function cleanPersonName(raw: string, people: Person[]): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, PERSON_NAME_MAX);
  if (!name) return null;
  const key = name.toLocaleLowerCase('vi');
  if (people.some((p) => !p.archived && p.name.toLocaleLowerCase('vi') === key)) return null;
  return name;
}

/** Open people, any balance; the ones with money first (biggest first), then by name. */
export function sortPeople(people: Person[]): Person[] {
  return people
    .filter((p) => !p.archived)
    .sort((a, b) => Math.abs(b.balanceVnd) - Math.abs(a.balanceVnd) || a.name.localeCompare(b.name, 'vi'));
}

/** People with a balance, for the Summary block. */
export function openBalances(people: Person[]): Person[] {
  return sortPeople(people).filter((p) => p.balanceVnd !== 0);
}

/** "owes you" / "you owe" / "settled". */
export function balanceWord(balanceVnd: number): string {
  if (balanceVnd > 0) return 'owes you';
  if (balanceVnd < 0) return 'you owe';
  return 'settled';
}

/**
 * Money in your own accounts = money in the buckets minus what people hold
 * for you: you owe 2.000 and are owed 500, so the bank holds 1.500 more than
 * the buckets show (PLAN-people.md, bank check).
 */
export function bankExtra(people: Person[]): number {
  return -people.reduce((sum, p) => sum + p.balanceVnd, 0);
}

/** Rebuilds each person's balance from their entries (for checks and the recompute script). */
export function balancesFromTxs(txs: Pick<Transaction, 'personId' | 'direction' | 'amountVnd'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (!t.personId) continue;
    out[t.personId] = (out[t.personId] ?? 0) + personDelta(t.direction, t.amountVnd);
  }
  return out;
}

/** "Count as spending" is only for money owed to you; Archive only when settled. */
export function canCountAsSpending(p: Person): boolean {
  return p.balanceVnd > 0;
}
export function canArchive(p: Person): boolean {
  return p.balanceVnd === 0 && !p.archived;
}

/** Entries of one person, oldest first, with the balance after each. */
export function runningBalance<T extends Pick<Transaction, 'direction' | 'amountVnd' | 'occurredAt'>>(txs: T[]): { tx: T; after: number }[] {
  let bal = 0;
  return [...txs]
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .map((tx) => {
      bal += personDelta(tx.direction, tx.amountVnd);
      return { tx, after: bal };
    });
}

/** History filter value for one person: 'person:<id>'. */
export const PERSON_FILTER = 'person:';

/**
 * History rows: People entries show only when asked for (a person filter,
 * or "show people"); a person filter shows only that person.
 */
export function historyRows<T extends Pick<Transaction, 'personId'>>(rows: T[], filter: string | null, showPeople: boolean): T[] {
  if (filter?.startsWith(PERSON_FILTER)) {
    const id = filter.slice(PERSON_FILTER.length);
    return rows.filter((t) => t.personId === id);
  }
  return showPeople ? rows : rows.filter((t) => !t.personId);
}
