import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const LOCALE = 'en-US';
const PERCENTAGE_FORMAT = new Intl.NumberFormat(LOCALE, { style: 'percent' });

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatPercentage = (value: number): string =>
  PERCENTAGE_FORMAT.format(value);

export const lineColumnToCharacterIndex = (
  line: number,
  column: number,
  value: string,
): number => {
  const lineIndex = line - 1;
  const columnIndex = column - 1;

  const numCharsBeforeLine = value
    .split('\n')
    .slice(0, lineIndex)
    .reduce((acc, line) => acc + line.length + '\n'.length, 0);

  return numCharsBeforeLine + columnIndex;
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
  const groups: [K, T[]][] = [];

  for (const item of items) {
    const key = getKey(item);
    let members = groups.find(([k]) => k === key)?.[1];
    if (members === undefined) {
      members = [];
      groups.push([key, members]);
    }
    members.push(item);
  }

  return groups;
};
