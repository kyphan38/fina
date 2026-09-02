"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 5 tab cố định. Log là tab mặc định vì nó là lý do app tồn tại.
 * Icon vẽ tay bằng SVG, không dùng thư viện icon - mỗi KB tải về là mỗi
 * mili-giây chờ lúc cold start (nguyên tắc #12).
 */
const TABS = [
  { href: "/log", label: "Log", d: "M12 5v14M5 12h14" },
  { href: "/summary", label: "Summary", d: "M4 19V9M10 19V5M16 19v-6M4 19h16" },
  { href: "/history", label: "History", d: "M4 6h16M4 12h16M4 18h10" },
  { href: "/insights", label: "Insights", d: "M4 15l5-6 4 4 6-8" },
  { href: "/settings", label: "Settings", d: "M12 8a4 4 0 100 8 4 4 0 000-8M12 2v3M12 19v3M2 12h3M19 12h3" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-line bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
