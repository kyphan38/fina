"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 3 fixed tabs. Log is the default because it is why the app exists.
 * Trends live inside History, Settings behind the gear on Summary.
 * Icons are hand-drawn SVG, no icon library - every KB downloaded is
 * waiting time at cold start (rule #12).
 */
const TABS = [
  { href: "/log", label: "Log", d: "M12 5v14M5 12h14", also: [] },
  {
    href: "/summary",
    label: "Summary",
    d: "M4 19V9M10 19V5M16 19v-6M4 19h16",
    also: ["/settings", "/guide", "/salary"],
  },
  { href: "/history", label: "History", d: "M4 6h16M4 12h16M4 18h10", also: ["/insights", "/import"] },
] as const;

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-line bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl min-[900px]:max-w-5xl">
        {TABS.map((tab) => {
          const active = [tab.href, ...tab.also].some((h) => under(pathname, h));
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] tracking-wide ${
                  active ? "text-ink" : "text-faint"
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={tab.d} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
