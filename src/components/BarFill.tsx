/**
 * The filled part of a progress bar. Drawn with `scaleX`, so it is smooth and
 * cheap. It animates only when `settled` (the screen has loaded), so a bar
 * that appears with the page is already at its value.
 */
export default function BarFill({
  fraction,
  color,
  settled = false,
  className = '',
}: {
  /** 0 to 1, see `barScale`. */
  fraction: number;
  color: string;
  settled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`block h-full w-full origin-left ${className}`}
      style={{
        transform: `scaleX(${fraction})`,
        background: color,
        transition: settled ? 'transform 500ms var(--ease-soft)' : 'none',
      }}
    />
  );
}
