import { lineColumnToCharacterIndex } from '@/lib/utils';
import { describe, expect, it } from 'vitest';

describe('utils', () => {
  describe('lineColumnToCharacterIndex', () => {
    it.each([
      ['123', 1, 1, '1'],
      ['123', 1, 3, '3'],
      ['123\n456\n789\n', 1, 1, '1'],
      ['123\n456\n789\n', 1, 3, '3'],
      ['123\n456\n789\n', 2, 1, '4'],
      ['123\n456\n789\n', 3, 3, '9'],
    ])(
      'translates line/column to index correctly %#',
      (
        value: string,
        line: number,
        column: number,
        expectedCharacter: string,
      ) => {
        const index = lineColumnToCharacterIndex(line, column, value);

        expect(value[index]).toBe(expectedCharacter);
      },
    );
  });
});
