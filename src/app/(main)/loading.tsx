/**
 * Shared loading frame for every page in (main).
 *
 * Not for looks. Next 16 docs (guides/prefetching.md): a dynamic route is only
 * prefetched by <Link> when it has a loading boundary. Every route here is
 * dynamic because the layout reads a cookie, so before this file every tab
 * tap froze while waiting for the server.
 *
 * Uses fina's bg-sunk token, not a hardcoded color: it follows the theme in
 * globals.css.
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
