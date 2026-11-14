'use client';

import { useEffect, useState } from 'react';

import { saveNotes, watchNotes } from '@/lib/notes';
import { WORD } from '@/components/SectionTitle';

/** Free-text note on Summary. Closed by default so it never pushes the numbers down. */
export default function NotesBlock({ uid }: { uid: string }) {
  const [saved, setSaved] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchNotes(uid, setSaved), [uid]);

  const text = draft ?? saved;
  const dirty = draft !== null && draft !== saved;

  const save = async () => {
    if (!dirty) return;
    setError(null);
    try {
      await saveNotes(uid, draft);
      setDraft(null);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? 'unknown';
      setError(`Could not save (${code}).`);
    }
  };

  return (
    <section className="mt-7">
      <h2 className="text-[13px] font-medium text-muted">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-8 w-full items-center gap-3 text-left"
        >
          Notes
          {/* Closed: the first line still shows, as a reminder. */}
          <span className="min-w-0 flex-1 truncate font-normal text-faint">
            {open ? '' : saved.trim().split('\n')[0]}
          </span>
          <span className="shrink-0 font-normal text-faint">{open ? 'hide' : 'show'}</span>
        </button>
      </h2>

      {open && (
        <div className="mt-2.5">
          <textarea
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
            }}
            rows={Math.min(14, Math.max(4, text.split('\n').length + 1))}
            aria-label="Notes"
            placeholder="Debts, reminders"
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[15px] leading-relaxed"
          />
          {(dirty || error) && (
            <div className="mt-1.5 flex items-center gap-3">
              {dirty && (
                <>
                  <button type="button" onClick={save} className="text-[13px] font-semibold text-ink">
                    Save
                  </button>
                  <button type="button" onClick={() => setDraft(null)} className={WORD}>
                    Cancel
                  </button>
                </>
              )}
              {error && <span className="text-[13px] text-over">{error}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
