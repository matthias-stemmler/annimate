import { QueryNode } from '@/lib/api-types';
import { cn, groupBy, uniq } from '@/lib/utils';
import { FC, useLayoutEffect, useRef, useState } from 'react';

const GAP = 8; // gap-2 between flex children, in px
const PILL_PAD = 16; // px-2 horizontal padding of a pill, in px

// A pill is the grey rounded box shown per distinct query fragment. It contains
// one chip (a `#variable` label) for each node sharing that fragment, followed by
// the fragment text. When pills/chips overflow the row, a badge ("+n") summarizes
// how many chips are hidden.
type Pill = {
  queryFragment: string;
  variables: string[]; // one chip per variable
};

type PillMetric = {
  chipWidths: number[];
  fragmentWidth: number;
};

export type QueryNodesDisplayProps = {
  queryNodes: QueryNode[];
};

export const QueryNodesDisplay: FC<QueryNodesDisplayProps> = ({
  queryNodes,
}) => {
  const pills: Pill[] = groupBy(queryNodes, (n) => n.queryFragment).map(
    ([queryFragment, nodes]) => ({
      queryFragment,
      variables: uniq(nodes.map((n) => n.variable)),
    }),
  );
  const totalChips = pills.reduce(
    (sum, pill) => sum + pill.variables.length,
    0,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [chipsPerPill, setChipsPerPill] = useState<number[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (container === null || measure === null) {
      return;
    }

    const pillElements = Array.from(
      measure.querySelectorAll<HTMLElement>('[data-pill]'),
    );
    const badgeElement = measure.querySelector<HTMLElement>('[data-badge]');
    const metrics: PillMetric[] = pillElements.map((pillElement) => {
      const fragmentElement =
        pillElement.querySelector<HTMLElement>('[data-fragment]');
      return {
        chipWidths: Array.from(
          pillElement.querySelectorAll<HTMLElement>('[data-chip]'),
        ).map((chipElement) => chipElement.offsetWidth),
        fragmentWidth: fragmentElement?.offsetWidth ?? 0,
      };
    });
    const badgeWidth = badgeElement?.offsetWidth ?? 0;

    const update = () =>
      setChipsPerPill(fitChips(metrics, badgeWidth, container.clientWidth));

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [queryNodes]);

  // Always show at least one node: when not even one chip + fragment fits,
  // show the first node alone, shrunk/truncated to fit.
  const nothingFits = chipsPerPill.length === 0 && pills.length > 0;
  const visiblePills: Pill[] = nothingFits
    ? [{ ...pills[0], variables: pills[0].variables.slice(0, 1) }]
    : chipsPerPill.flatMap((chips, i) =>
        pills[i] === undefined
          ? []
          : [{ ...pills[i], variables: pills[i].variables.slice(0, chips) }],
      );
  const shownChips = visiblePills.reduce(
    (sum, pill) => sum + pill.variables.length,
    0,
  );
  const hiddenChips = totalChips - shownChips;

  return (
    <div
      ref={containerRef}
      className="relative mr-2 flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-mono"
    >
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute flex gap-2"
      >
        {pills.map((pill, i) => (
          <PillView key={i} pill={pill} />
        ))}
        {/* totalChips is an upper bound on hiddenChips, so this measures the
            widest the badge can get and we never under-reserve its width. */}
        <span data-badge>+{totalChips}</span>
      </div>

      {visiblePills.map((pill, i) => (
        <PillView key={i} pill={pill} shrinkable={nothingFits} />
      ))}
      {hiddenChips > 0 && (
        <span className="shrink-0 text-gray-500 dark:text-gray-400">
          +{hiddenChips}
        </span>
      )}
    </div>
  );
};

const PillView: FC<{ pill: Pill; shrinkable?: boolean }> = ({
  pill,
  shrinkable = false,
}) => (
  <div
    data-pill
    className={cn(
      'flex h-5 items-center gap-2 rounded-sm bg-gray-200 px-2 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      shrinkable ? 'min-w-0' : 'shrink-0',
    )}
  >
    {pill.variables.map((variable, i) => (
      <span
        key={i}
        data-chip
        className="max-w-32 shrink-0 truncate font-semibold"
      >
        #{variable}
      </span>
    ))}
    <span data-fragment className="max-w-64 truncate">
      {pill.queryFragment}
    </span>
  </div>
);

/**
 * Decides how many variable chips of each pill fit into `available`.
 * Returns one entry per shown pill with the number of chips to show;
 * pills/chips that don't fit are dropped (counted by the caller into "+n").
 * When not everything fits, room for the badge is reserved so it never gets clipped.
 */
const fitChips = (
  metrics: PillMetric[],
  badgeWidth: number,
  available: number,
): number[] => {
  const fullWidth = metrics.reduce(
    (sum, m, i) => sum + (i > 0 ? GAP : 0) + pillWidth(m, m.chipWidths.length),
    0,
  );
  if (fullWidth <= available) {
    return metrics.map((m) => m.chipWidths.length);
  }

  const chipsPerPill: number[] = [];
  let used = 0;
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const base = used + (i > 0 ? GAP : 0);
    let bestChips = 0;
    for (let chips = 1; chips <= metric.chipWidths.length; chips++) {
      if (base + pillWidth(metric, chips) + GAP + badgeWidth <= available) {
        bestChips = chips;
      } else {
        break;
      }
    }
    if (bestChips === 0) {
      break;
    }
    chipsPerPill.push(bestChips);
    used = base + pillWidth(metric, bestChips);
    if (bestChips < metric.chipWidths.length) {
      break;
    }
  }
  return chipsPerPill;
};

// Width of a pill showing the first `chips` variable chips plus its fragment.
const pillWidth = (metric: PillMetric, chips: number): number =>
  PILL_PAD +
  metric.chipWidths.slice(0, chips).reduce((sum, w) => sum + w, 0) +
  chips * GAP +
  metric.fragmentWidth;
