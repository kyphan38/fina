'use client';

import { useState } from 'react';

import { checkPassword, gateStore } from '@/lib/gate';

/**
 * Màn chắn trước Salary.
 *
 * Không nói "sai mật khẩu" nhanh hơn hay chậm hơn tuỳ trường hợp, và không
 * hiện gợi ý gì về mật khẩu. Ai mở app lên cũng chỉ thấy một ô trống.
 */
export default function SalaryGate() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setWrong(false);
    const ok = await checkPassword(value);
    if (ok) {
      gateStore.unlock();
      return;
    }
    setValue('');
    setWrong(true);
    setBusy(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-16">
      <form onSubmit={submit} className="w-full max-w-[280px]">
        <label htmlFor="gate" className="block text-center text-xs text-faint">
          Locked
        </label>
        <input
          id="gate"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoFocus
          className="mt-2 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-center text-sm"
        />
        <button
          type="submit"
          disabled={busy || value === ''}
          className="mt-2 w-full rounded-[10px] bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        {wrong && <p className="mt-2 text-center text-xs text-over">Nope.</p>}
      </form>
    </div>
  );
}
