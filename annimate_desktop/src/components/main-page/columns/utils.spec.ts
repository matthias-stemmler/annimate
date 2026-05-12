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
    ${{ ns: 'ns', name: 'name' }} | ${'{"ns":"ns","name":"name"}'}
    ${{ ns: '', name: 'name' }}   | ${'{"ns":"","name":"name"}'}
  `('annoKeyToValue', (params: { annoKey: AnnoKey; expectedValue: string }) => {
    const value = annoKeyToValue(params.annoKey);

    expect(value).toEqual(params.expectedValue);
  });

  test.each`
    value                          | expectedAnnoKey
    ${'{"ns":"ns","name":"name"}'} | ${{ ns: 'ns', name: 'name' }}
    ${'{"ns":"","name":"name"}'}   | ${{ ns: '', name: 'name' }}
  `('valueToAnnoKey', (params: { value: string; expectedAnnoKey: AnnoKey }) => {
    const value = valueToAnnoKey(params.value);

    expect(value).toEqual(params.expectedAnnoKey);
  });

  test.each`
    edgeType                                | expectedValue
    ${{ ctype: 'Dominance', name: '' }}     | ${'{"ctype":"Dominance","name":""}'}
    ${{ ctype: 'Dominance', name: 'name' }} | ${'{"ctype":"Dominance","name":"name"}'}
    ${{ ctype: 'Pointing', name: 'name' }}  | ${'{"ctype":"Pointing","name":"name"}'}
  `(
    'edgeTypeToValue',
    (params: { edgeType: EdgeType; expectedValue: string }) => {
      const value = edgeTypeToValue(params.edgeType);

      expect(value).toEqual(params.expectedValue);
    },
  );

  test.each`
    value                                    | expectedEdgeType
    ${'{"ctype":"Dominance","name":""}'}     | ${{ ctype: 'Dominance', name: '' }}
    ${'{"ctype":"Dominance","name":"name"}'} | ${{ ctype: 'Dominance', name: 'name' }}
    ${'{"ctype":"Pointing","name":"name"}'}  | ${{ ctype: 'Pointing', name: 'name' }}
  `(
    'valueToEdgeType',
    (params: { value: string; expectedEdgeType: EdgeType }) => {
      const value = valueToEdgeType(params.value);

      expect(value).toEqual(params.expectedEdgeType);
    },
  );
});
