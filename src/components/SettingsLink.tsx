import Link from "next/link";

/**
 * Gear at the right end of each main page's top row, the same corner as
 * the other apps. It sits in a row that is already there, so no height is lost.
 */
export default function SettingsLink() {
  return (
    <Link href="/settings" aria-label="Settings" className="-m-1.5 shrink-0 p-1.5 text-faint hover:text-ink active:text-ink">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 8a4 4 0 100 8 4 4 0 000-8M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </Link>
  );
}
