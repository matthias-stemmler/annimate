import {
  columnIndexCodePointsToGraphemes,
  filterEligible,
  groupBy,
  lineColumnToCharacterIndex,
  uniq,
} from '@/lib/utils';
import { describe, expect, it } from 'vitest';

describe('utils', () => {
  describe('lineColumnToCharacterIndex', () => {
    it.each([
      ['123', 0, 0, '1'],
      ['123', 0, 2, '3'],
      ['123\n456\n789\n', 0, 0, '1'],
      ['123\n456\n789\n', 0, 2, '3'],
      ['123\n456\n789\n', 1, 0, '4'],
      ['123\n456\n789\n', 2, 2, '9'],
      ['héllo', 0, 1, 'é'],
      ['héllo', 0, 2, 'l'],
      ['h🎉llo', 0, 2, 'l'],
      ['h🎉llo', 0, 3, 'l'],
      ['h🎉llo', 0, 4, 'o'],
      ['🎉\n🎉', 1, 0, '\uD83C'],
    ])(
      'translates lineIndex/columnIndex to index correctly %#',
      (
        value: string,
        lineIndex: number,
        columnIndex: number,
        expectedCharacter: string,
      ) => {
        const index = lineColumnToCharacterIndex(lineIndex, columnIndex, value);

        expect(value[index]).toBe(expectedCharacter);
      },
    );

    it.each([
      ['h🎉llo', 0, 1, 'h🎉'],
      ['h🎉llo', 0, 2, 'h🎉l'],
      ['héllo', 0, 1, 'hé'],
    ])(
      'returns end index suitable for selecting through column %#',
      (
        value: string,
        lineIndex: number,
        columnIndex: number,
        expectedSelection: string,
      ) => {
        const end = lineColumnToCharacterIndex(
          lineIndex,
          columnIndex + 1,
          value,
        );

        expect(value.slice(0, end)).toBe(expectedSelection);
      },
    );
  });

  describe('columnIndexCodePointsToGraphemes', () => {
    it.each([
      ['', 0, 0],
      ['abc', 0, 0],
      ['abc', 1, 1],
      ['abc', 3, 3],
      // 'é': 1 code point, 1 grapheme
      ['héllo', 1, 1],
      ['héllo', 2, 2],
      ['héllo', 3, 3],
      // Non-BMP emoji: 1 code point, 1 grapheme
      ['h🎉llo', 1, 1],
      ['h🎉llo', 2, 2],
      ['h🎉llo', 5, 5],
      // Zero-width joiner (ZWJ) sequence (👨‍👩‍👧): 5 code points, 1 grapheme
      ['a\u{1F468}‍\u{1F469}‍\u{1F467}b', 1, 1],
      ['a\u{1F468}‍\u{1F469}‍\u{1F467}b', 6, 2],
      ['a\u{1F468}‍\u{1F469}‍\u{1F467}b', 7, 3],
      // Regional indicator pair (flag): 2 code points, 1 grapheme
      ['\u{1F1E9}\u{1F1EA}x', 2, 1],
      ['\u{1F1E9}\u{1F1EA}x', 3, 2],
      // Base + combining mark: 2 code points, 1 grapheme
      ['éx', 2, 1],
      ['éx', 3, 2],
    ])(
      'converts code-point column %#',
      (line: string, columnIndex: number, expectedGraphemeColumn: number) => {
        expect(columnIndexCodePointsToGraphemes(line, columnIndex)).toBe(
          expectedGraphemeColumn,
        );
      },
    );
  });

  describe('filterEligible', () => {
    it.each([
      ['eligible', ['a', 'b'], 'A', 'A'],
      ['not eligible', ['a', 'b'], 'c', undefined],
      ['value undefined', ['a', 'b'], undefined, undefined],
      ['eligible values undefined', undefined, 'a', undefined],
    ])(
      'filters for eligible values (%s)',
      (
        _description: string,
        eligibleValues: string[] | undefined,
        value: string | undefined,
        expectedValue: string | undefined,
      ) => {
        const filtered = filterEligible(
          eligibleValues,
          value,
          (a, b) => a.toLowerCase() === b.toLowerCase(),
        );
        expect(filtered).toEqual(expectedValue);
      },
    );
  });

  describe('groupBy', () => {
    it.each([
      ['no items', [], []],
      [
        'only singleton groups',
        ['a', 'bb', 'ccc'],
        [
          [1, ['a']],
          [2, ['bb']],
          [3, ['ccc']],
        ],
      ],
      ['only one group', ['aaa', 'bbb', 'ccc'], [[3, ['aaa', 'bbb', 'ccc']]]],
      [
        'multiple groups, not all singleton',
        ['aaa', 'bb', 'c', 'dd', 'eee'],
        [
          [3, ['aaa', 'eee']],
          [2, ['bb', 'dd']],
          [1, ['c']],
        ],
      ],
    ] as const)(
      'groups by the given key (%s)',
      (
        _description: string,
        items: readonly string[],
        expectedGroups: readonly (readonly [number, readonly string[]])[],
      ) => {
        expect(groupBy(items, (s) => s.length)).toEqual(expectedGroups);
      },
    );
  });

  describe('uniq', () => {
    it.each([
      [[], []],
      [['a'], ['a']],
      [
        ['a', 'b'],
        ['a', 'b'],
      ],
      [['a', 'a', 'a'], ['a']],
      [
        ['a', 'b', 'b', 'a'],
        ['a', 'b'],
      ],
    ] as const)(
      'returns unique items (%j)',
      (items: readonly string[], expectedUniqueItems: readonly string[]) => {
        expect(uniq(items)).toEqual(expectedUniqueItems);
      },
    );
  });
});
