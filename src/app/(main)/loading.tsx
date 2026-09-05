/**
 * Khung chờ dùng chung cho mọi trang trong (main).
 *
 * Không phải để cho đẹp. Docs Next 16 (guides/prefetching.md) nói rõ: route động
 * chỉ được <Link> prefetch khi có loading boundary. Mọi route ở đây đều động vì
 * layout đọc cookie, nên trước khi có file này, bấm tab nào cũng đứng hình chờ
 * server trả về.
 *
 * Dùng token bg-sunk của fina, không dùng màu cứng: nó tự đổi theo dark mode
 * qua prefers-color-scheme trong globals.css.
 */
export default function Loading() {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto pt-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-6 w-28 animate-pulse rounded bg-sunk" />
      <div className="mt-5 flex flex-col gap-3">
        <div className="h-20 w-full animate-pulse rounded bg-sunk" />
        <div className="h-20 w-full animate-pulse rounded bg-sunk" />
        <div className="h-20 w-full animate-pulse rounded bg-sunk" />
      </div>
    </section>
  );
}
