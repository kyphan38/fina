import type { RefObject } from "react";

import BucketTile from "@/components/BucketTile";
import SectionTitle, { WORD } from "@/components/SectionTitle";
import type { Bucket } from "@/types/fina";

/** The Monthly, Funds and Goals grids on Log. */
export default function BucketSections({
  monthly,
  funds,
  goals,
  spent,
  covered,
  limitOf,
  selectedId,
  settled,
  fundsOpen,
  fundsRef,
  onToggleFunds,
  onSelect,
}: {
  monthly: Bucket[];
  funds: Bucket[];
  goals: Bucket[];
  spent: Record<string, number>;
  covered: Record<string, number>;
  limitOf: (b: Bucket) => number;
  selectedId: string | null;
  settled: boolean;
  fundsOpen: boolean;
  fundsRef: RefObject<HTMLDivElement | null>;
  onToggleFunds: () => void;
  onSelect: (id: string) => void;
}) {
  const setSelectedId = onSelect;
  const toggleFunds = onToggleFunds;
  return (
    <>
      <Section title="Monthly">
        <div className="grid grid-cols-3 gap-1.5">
          {monthly.map((b) => (
            <BucketTile
              key={b.id}
              bucket={b}
              spentVnd={spent[b.id] ?? 0}
              coveredVnd={covered[b.id] ?? 0}
              limitVnd={limitOf(b)}
              selected={b.id === selectedId}
              settled={settled}
              onSelect={() => setSelectedId(b.id)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Funds"
        action={
          <button
            type="button"
            onClick={toggleFunds}
            aria-expanded={fundsOpen}
            className={`${WORD} min-[900px]:hidden`}
          >
            {fundsOpen ? "hide" : "show"}
          </button>
        }
      >
        {/* Always shown on Mac: there is room, and collapsing saves nothing. */}
        <div
          ref={fundsRef}
          className={fundsOpen ? "block" : "hidden min-[900px]:block"}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {funds.map((b) => (
              <BucketTile
                key={b.id}
                bucket={b}
                spentVnd={spent[b.id] ?? 0}
                selected={b.id === selectedId}
                settled={settled}
                onSelect={() => setSelectedId(b.id)}
              />
            ))}
          </div>
          {goals.length > 0 && (
            <>
              <SectionTitle className="pt-2">Goals</SectionTitle>
              <div className="grid grid-cols-3 gap-1.5">
                {goals.map((b) => (
                  <BucketTile
                    key={b.id}
                    bucket={b}
                    spentVnd={spent[b.id] ?? 0}
                    selected={b.id === selectedId}
                    settled={settled}
                    onSelect={() => setSelectedId(b.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </Section>
    </>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-2">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </section>
  );
}
