/**
 * Both words always show; the current one is ink. Shared with the edit
 * sheet so money in and out looks the same everywhere.
 */
export default function DirectionToggle({
  direction,
  onFlip,
}: {
  direction: 'out' | 'in';
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={direction === 'in' ? 'Money in' : 'Money out'}
      className="flex gap-2.5 text-[13px]"
    >
      <span className={direction === 'out' ? 'font-semibold text-ink' : 'text-faint'}>out</span>
      <span className={direction === 'in' ? 'font-semibold text-ink' : 'text-faint'}>in</span>
    </button>
  );
}
