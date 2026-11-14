"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useIndicator } from "@/hooks/useIndicator";

/**
 * 3 fixed tabs. Log is the default because it is why the app exists.
 * Trends live inside History, Settings behind the gear top right.
 * fina's own nav (DESIGN.md "Nav: one signature per app"): sans words, no
 * icons, a short line under the open tab. logi marks on the top edge.
 */
const TABS = [
  { href: "/log", label: "Log", also: [] },
  // Settings and its pages light up the gear instead.
  { href: "/summary", label: "Summary", also: ["/salary"] },
  { href: "/history", label: "History", also: ["/insights", "/import"] },
] as const;

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function BottomNav() {
  const pathname = usePathname();
  const current = TABS.find((tab) => [tab.href, ...tab.also].some((h) => under(pathname, h)));
  // Settings pages light up the gear, so no tab is current and the line hides.
  const { container, indicator } = useIndicator<HTMLUListElement, HTMLLIElement>(current?.href ?? "");

  return (
    <nav
      className="shrink-0 border-t border-line bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul ref={container} className="relative mx-auto flex max-w-2xl min-[900px]:max-w-5xl">
        {/* One bold line under the open tab, sliding between tabs. */}
        <li
          ref={indicator}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-0 flex justify-center"
        >
          <span className="h-0.5 w-5 rounded-full bg-ink" />
        </li>
        {TABS.map((tab) => {
          const active = tab === current;
          return (
            <li key={tab.href} data-active={active} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center justify-center text-[13px] transition-colors ${
                  active ? "font-medium text-ink" : "text-faint hover:text-ink active:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
