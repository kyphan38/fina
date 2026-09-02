import type { ReactNode } from 'react';
import BottomNav from '@/components/BottomNav';

/**
 * Khung app chiếm đúng một màn hình, không bao giờ cao hơn.
 *
 * Trước đây dùng min-h-dvh + sticky nav: cả trang cuộn, nav trôi theo và
 * nút Save của màn Log tụt xuống dưới đáy. Giờ chỉ vùng nội dung cuộn, nav
 * là phần tử flex cố định - không cần sticky, không có gì trôi được.
 *
 * min-h-0 là bắt buộc: thiếu nó thì flex item không co lại được và vùng
 * cuộn sẽ đẩy nav ra khỏi màn hình.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <main className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col px-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
