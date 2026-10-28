/**
 * Shared loading frame for every page in (main), shown while a route's code
 * loads. It is also the Suspense boundary for the client-only pages.
 *
 * Uses fina's bg-sunk token, not a hardcoded color: it follows the theme in
 * globals.css.
 */
export default function Loading() {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pt-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-6 w-28 breathe rounded bg-sunk" />
      <div className="mt-5 flex flex-col gap-3">
        <div className="h-20 w-full breathe rounded bg-sunk" />
        <div className="h-20 w-full breathe rounded bg-sunk" />
        <div className="h-20 w-full breathe rounded bg-sunk" />
      </div>
    </section>
  );
}
