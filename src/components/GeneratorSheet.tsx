'use client';

import { useState } from 'react';

import Numpad from '@/components/Numpad';
import { allocate } from '@/lib/generator';
import { formatVnd, fromVnd, pressKey, toVnd } from '@/lib/money';
import type { Bucket } from '@/types/fina';

/**
 * Generator - công cụ ĐỘC LẬP. Nó không bao giờ tự đồng bộ ngược vào
 * `limits` của chu kỳ đang chạy; `limits` đã đóng băng lúc chu kỳ mở.
 *
 * Các nhóm là số tiền cố định, ETF ăn phần dư. Phần trăm là kết quả tính ra.
 */
export default function GeneratorSheet({
  buckets,
  incomeVnd,
  onClose,
}: {
  buckets: Bucket[];
  incomeVnd: number | null;
  onClose: () => void;
}) {
  const [buf, setBuf] = useState(incomeVnd ? fromVnd(incomeVnd) : '');
  const salary = toVnd(buf) ?? 0;
  const r = allocate(salary, buckets);

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
            <Row key={a.bucket.id} name={a.bucket.name} amount={a.amountVnd} />
          ))}
        </Group>

        <Group title="BIDV — Funds" total={r.fundsTotalVnd} salary={salary}>
          {r.funds.map((a) => (
            <Row key={a.bucket.id} name={a.bucket.name} amount={a.amountVnd} />
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
          </p>
        </section>

        <div className="mt-3">
          <Numpad
            onKey={(k) => setBuf((cur) => pressKey(cur, k))}
            canSave={false}
            saveLabel="Planning only"
            onSave={() => {}}
          />
        </div>
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

function Row({ name, amount }: { name: string; amount: number }) {
  return (
    <li className="flex justify-between text-xs text-muted">
      <span>{name}</span>
      <span>{formatVnd(amount)}</span>
    </li>
  );
}
