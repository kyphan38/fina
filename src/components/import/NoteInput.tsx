'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Note field typed on this device; written to Firestore only after half a
 * second of no typing, or on blur. Writing every key costs a write per
 * letter, and the other device's copy could overwrite half-typed text.
 * When not typing, always shows the latest version from Firestore.
 */
export default function NoteInput({ value, onCommit }: { value: string; onCommit: (note: string) => void }) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next !== value) onCommit(next);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <input
      value={editing ? text : value}
      onFocus={() => {
        setText(value);
        setEditing(true);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(next), 500);
      }}
      onBlur={() => {
        setEditing(false);
        commit(text);
      }}
      placeholder="Note"
      enterKeyHint="done"
      className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs placeholder:text-faint"
    />
  );
}
