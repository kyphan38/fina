"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Settings sits top right on every page, like the other apps (hodi TopBar). */
export default function SettingsCorner() {
  const pathname = usePathname();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <div className="mx-auto flex w-full max-w-2xl shrink-0 justify-end px-4 pt-1 min-[900px]:max-w-5xl min-[900px]:px-6">
      <Link
        href="/settings"
        aria-label="Settings"
        aria-current={active ? "page" : undefined}
        className={`-mr-1.5 p-1.5 hover:text-ink active:text-ink ${active ? "text-ink" : "text-faint"}`}
      >
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
    </div>
  );
}
