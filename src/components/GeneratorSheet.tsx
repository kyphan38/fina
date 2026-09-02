'use client';

import { useState } from 'react';

import Numpad from '@/components/Numpad';
import { allocate, type Allocation } from '@/lib/generator';
import { setCycleLimits } from '@/lib/cycles';
import { cycleLabel } from '@/lib/cycle';
import { formatVnd, fromVnd, pressKey, toVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

/**
 * Generator - công cụ ĐỘC LẬP. Nó không bao giờ tự đồng bộ ngược vào
 * `limits` của chu kỳ đang chạy; `limits` đã đóng băng lúc chu kỳ mở.
 *
 * Các nhóm là số tiền cố định, ETF ăn phần dư. Phần trăm là kết quả tính ra.
 */
export default function GeneratorSheet({
  uid,
  cycleId,
  cycleClosed,
  buckets,
  incomeVnd,
  onClose,
}: {
  uid: string;
  cycleId: string;
  cycleClosed: boolean;
  buckets: Bucket[];
  incomeVnd: number | null;
  onClose: () => void;
}) {
  const [buf, setBuf] = useState(incomeVnd ? fromVnd(incomeVnd) : '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Số sửa tay chỉ sống trong lần mở này. Tháng sau mở lại Generator là quay
  // về chuẩn - đó là ý nghĩa của "điều chỉnh ngắn hạn".
  const [edits, setEdits] = useState<Record<string, string>>({});

  const salary = toVnd(buf) ?? 0;
  const overrides: Record<string, number> = {};
  for (const [id, raw] of Object.entries(edits)) {
    const v = raw.trim() === '' || raw.trim() === '0' ? 0 : toVnd(raw);
    if (v !== null) overrides[id] = v;
  }
  const r = allocate(salary, buckets, overrides);
  const { month } = cycleLabel(cycleId);
  const edited = Object.keys(overrides).length > 0;

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const limits: Record<string, number> = {};
      for (const a of r.monthly) limits[a.bucket.id] = a.amountVnd;
      await setCycleLimits(uid, cycleId, limits, salary);
      onClose();
    } catch (err) {
      setError(`Could not apply (${(err as { code?: string })?.code ?? 'unknown'}).`);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
      <div className="max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pt-3">
        <div className="flex items-baseline justify-between pb-3">
          <span className="text-xs font-semibold">Salary</span>
          <span className={`text-[30px] leading-none font-medium ${buf ? '' : 'text-faint'}`}>
            {buf || '0'}
          </span>
        </div>

        <Group title="VCB — Monthly" total={r.monthlyTotalVnd} salary={salary}>
          {r.monthly.map((a) => (
            <Row key={a.bucket.id} a={a} edits={edits} setEdits={setEdits} />
          ))}
        </Group>

        <Group title="BIDV — Funds" total={r.fundsTotalVnd} salary={salary}>
          {r.funds.map((a) => (
            <Row key={a.bucket.id} a={a} edits={edits} setEdits={setEdits} />
          ))}
        </Group>

        <section className="mt-3 border-t border-line pt-2">
          <div className="flex items-baseline justify-between text-sm font-semibold">
            <span>ETF</span>
            <span className={r.etfVnd < 0 ? 'text-over' : ''}>
              {formatVnd(r.etfVnd)} · {Math.round(r.etfPercent)}%
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-faint">
            {r.etfVnd < 0
              ? `Salary is ${formatVnd(-r.etfVnd)} short of the allocations.`
              : 'Whatever is left after the fixed amounts.'}
            {edited && ' Edits here apply to this cycle only — Settings is untouched.'}
          </p>
        </section>

        {confirming ? (
          <div className="mt-3 rounded-[10px] border border-line px-3 py-3">
            <p className="text-sm">
              Replace this cycle&rsquo;s limits with these amounts?
            </p>
            <p className="mt-1 text-xs text-muted">
              {month} is already running. Whatever you have spent stays; only the limits
              move.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={apply}
              className="mt-3 w-full rounded-[10px] bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Applying…' : `Apply to ${month}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="mt-1 w-full py-2 text-xs text-muted"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <Numpad
              onKey={(k) => setBuf((cur) => pressKey(cur, k))}
              canSave={salary > 0 && !cycleClosed}
              saveLabel={cycleClosed ? 'Cycle is closed' : `Apply to ${month}`}
              onSave={() => setConfirming(true)}
            />
          </div>
        )}

        {error && <p className="mt-2 text-xs text-over">{error}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mb-3 w-full py-2 text-center text-xs text-muted"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Group({
  title,
  total,
  salary,
  children,
}: {
  title: string;
  total: number;
  salary: number;
  children: React.ReactNode;
}) {
  const pct = salary > 0 ? Math.round((total / salary) * 100) : 0;
  return (
    <section className="mt-3 border-t border-line pt-2">
      <div className="flex items-baseline justify-between text-sm font-semibold">
        <span>{title}</span>
        <span>
          {formatVnd(total)} · {pct}%
        </span>
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

function Row({
  a,
  edits,
  setEdits,
}: {
  a: Allocation;
  edits: Record<string, string>;
  setEdits: (fn: (e: Record<string, string>) => Record<string, string>) => void;
}) {
  const off = a.deltaVnd !== 0;
  return (
    <li className="flex items-center gap-2 py-0.5 text-xs">
      <span className="flex-1 truncate">{a.bucket.name}</span>

      {off && (
        <span className={a.farFromStandard ? 'font-semibold text-over' : 'text-muted'}>
          {a.deltaVnd > 0 ? '+' : '−'}
          {formatVnd(Math.abs(a.deltaVnd))}
        </span>
      )}

      <span className="w-10 text-right text-faint">{Math.round(a.percent)}%</span>

      <input
        value={edits[a.bucket.id] ?? fromVnd(a.standardVnd)}
        inputMode="decimal"
        aria-label={`${a.bucket.name} amount`}
        onChange={(e) => setEdits((prev) => ({ ...prev, [a.bucket.id]: e.target.value }))}
        className={`w-20 rounded-md border bg-surface-2 px-2 py-1 text-right text-xs ${
          a.farFromStandard ? 'border-over' : 'border-line'
        }`}
      />
    </li>
  );
}
