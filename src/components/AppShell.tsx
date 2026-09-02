import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";

/**
 * Khung chung cho 5 tab. Nội dung cuộn, nav dính đáy.
 * max-w-2xl để trên Mac không bị kéo dài thành một dải chữ.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4">{children}</main>
      <BottomNav />
    </div>
  );
}
