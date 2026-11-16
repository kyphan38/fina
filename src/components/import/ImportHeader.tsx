import Link from 'next/link';

export default function ImportHeader() {
  return (
    <header className="flex items-center gap-2 border-b border-line pb-2.5 pt-3">
      <Link href="/history" className="text-xs text-muted">
        ← History
      </Link>
      <span className="ml-auto text-xs font-semibold">Import from MoMo</span>
    </header>
  );
}
