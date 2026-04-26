import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});
const LOCALE = 'en-US';
const PERCENTAGE_FORMAT = new Intl.NumberFormat(LOCALE, { style: 'percent' });

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatPercentage = (value: number): string =>
  PERCENTAGE_FORMAT.format(value);

export const lineColumnToCharacterIndex = (
  lineIndex: number,
  columnIndex: number,
  value: string,
): number => {
  const lines = value.split('\n');
  const numCharsBeforeLine = lines
    .slice(0, lineIndex)
    .reduce((acc, line) => acc + line.length + '\n'.length, 0);

  // `columnIndex` is in Unicode code points (per the Rust backend), but
  // `setSelectionRange` expects UTF-16 code units. Spreading the line splits it
  // into code points so non-BMP characters like emojis count as one column.
  const columnOffset = [...(lines[lineIndex] ?? '')]
    .slice(0, columnIndex)
    .join('').length;

  return numCharsBeforeLine + columnOffset;
};

// Converts a code-point-based column index (as produced by the Rust backend) to
// a grapheme-cluster column index, so that displayed positions count the same
// way the textarea moves the caret/selection on cursor keys.
export const columnIndexCodePointsToGraphemes = (
  line: string,
  columnIndex: number,
): number => {
  const prefix = [...line].slice(0, columnIndex).join('');
  let count = 0;
  for (const _ of GRAPHEME_SEGMENTER.segment(prefix)) {
    count++;
  }
  return count;
};

export const filterEligible = <S, T>(
  eligibleValues: S[] | undefined,
  value: T | undefined,
  compare: (a: S, b: T) => boolean,
): T | undefined =>
  eligibleValues !== undefined &&
  value !== undefined &&
  eligibleValues.some((v) => compare(v, value))
    ? value
    : undefined;

export const groupBy = <K, T>(
  items: readonly T[],
  getKey: (x: T) => K,
): [K, T[]][] => {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const members = groups.get(key);
    if (members === undefined) {
      groups.set(key, [item]);
    } else {
      members.push(item);
    }
  }

  return [...groups];
};

export const uniq = <T>(items: readonly T[]): T[] => [...new Set(items)];
