import {
  annoKeyToValue,
  edgeTypeToValue,
  valueToAnnoKey,
  valueToEdgeType,
} from '@/components/main-page/columns/utils';
import { AnnoKey, EdgeType } from '@/lib/api-types';
import { describe, expect, test } from 'vitest';

describe('utils', () => {
  test.each`
    annoKey                       | expectedValue
    ${{ ns: 'ns', name: 'name' }} | ${'ns:name'}
    ${{ ns: '', name: 'name' }}   | ${':name'}
  `('annoKeyToValue', (params: { annoKey: AnnoKey; expectedValue: string }) => {
    const value = annoKeyToValue(params.annoKey);

    expect(value).toEqual(params.expectedValue);
  });

  test.each`
    value        | expectedAnnoKey
    ${'ns:name'} | ${{ ns: 'ns', name: 'name' }}
    ${':name'}   | ${{ ns: '', name: 'name' }}
  `('valueToAnnoKey', (params: { value: string; expectedAnnoKey: AnnoKey }) => {
    const value = valueToAnnoKey(params.value);

    expect(value).toEqual(params.expectedAnnoKey);
  });

  test.each`
    edgeType                                | expectedValue
    ${{ ctype: 'Dominance', name: '' }}     | ${'Dominance/'}
    ${{ ctype: 'Dominance', name: 'name' }} | ${'Dominance/name'}
    ${{ ctype: 'Pointing', name: 'name' }}  | ${'Pointing/name'}
  `(
    'edgeTypeToValue',
    (params: { edgeType: EdgeType; expectedValue: string }) => {
      const value = edgeTypeToValue(params.edgeType);

      expect(value).toEqual(params.expectedValue);
    },
  );

  test.each`
    value               | expectedEdgeType
    ${'Dominance/'}     | ${{ ctype: 'Dominance', name: '' }}
    ${'Dominance/name'} | ${{ ctype: 'Dominance', name: 'name' }}
    ${'Pointing/name'}  | ${{ ctype: 'Pointing', name: 'name' }}
  `(
    'valueToEdgeType',
    (params: { value: string; expectedEdgeType: EdgeType }) => {
      const value = valueToEdgeType(params.value);

      expect(value).toEqual(params.expectedEdgeType);
    },
  );
});
