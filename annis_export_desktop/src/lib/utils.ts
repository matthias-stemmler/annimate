import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
