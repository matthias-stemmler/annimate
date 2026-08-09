import {
  annoKeyOrDefaultToValue,
  annoKeyToValue,
  edgeTypeToValue,
  segmentationToValue,
  valueToAnnoKey,
  valueToAnnoKeyOrDefault,
  valueToEdgeType,
  valueToSegmentation,
} from '@/components/main-page/columns/utils';
import { AnnoKey, EdgeType } from '@/lib/api-types';
import { describe, expect, test } from 'vitest';

describe('utils', () => {
  test.each`
    annoKey                       | expectedValue
    ${{ ns: 'ns', name: 'name' }} | ${'anno-key:{"ns":"ns","name":"name"}'}
    ${{ ns: '', name: 'name' }}   | ${'anno-key:{"ns":"","name":"name"}'}
    ${{ ns: 'ns', name: 'a:b' }}  | ${'anno-key:{"ns":"ns","name":"a:b"}'}
  `('annoKeyToValue', (params: { annoKey: AnnoKey; expectedValue: string }) => {
    const value = annoKeyToValue(params.annoKey);

    expect(value).toEqual(params.expectedValue);
  });

  test.each`
    value                                   | expectedAnnoKey
    ${'anno-key:{"ns":"ns","name":"name"}'} | ${{ ns: 'ns', name: 'name' }}
    ${'anno-key:{"ns":"","name":"name"}'}   | ${{ ns: '', name: 'name' }}
    ${'anno-key:{"ns":"ns","name":"a:b"}'}  | ${{ ns: 'ns', name: 'a:b' }}
  `('valueToAnnoKey', (params: { value: string; expectedAnnoKey: AnnoKey }) => {
    const value = valueToAnnoKey(params.value);

    expect(value).toEqual(params.expectedAnnoKey);
  });

  test.each`
    value
    ${'no-separator'}
    ${'edge-type:{"ctype":"Dominance","name":""}'}
  `('valueToAnnoKey throws', (params: { value: string }) => {
    expect(() => valueToAnnoKey(params.value)).toThrow();
  });

  test.each`
    annoKeyOrDefault              | expectedValue
    ${'default'}                  | ${'default:null'}
    ${{ ns: 'ns', name: 'name' }} | ${'anno-key:{"ns":"ns","name":"name"}'}
  `(
    'annoKeyOrDefaultToValue',
    (params: {
      annoKeyOrDefault: AnnoKey | 'default';
      expectedValue: string;
    }) => {
      const value = annoKeyOrDefaultToValue(params.annoKeyOrDefault);

      expect(value).toEqual(params.expectedValue);
    },
  );

  test.each`
    value                                   | expectedAnnoKeyOrDefault
    ${'default:null'}                       | ${'default'}
    ${'anno-key:{"ns":"ns","name":"name"}'} | ${{ ns: 'ns', name: 'name' }}
  `(
    'valueToAnnoKeyOrDefault',
    (params: {
      value: string;
      expectedAnnoKeyOrDefault: AnnoKey | 'default';
    }) => {
      const value = valueToAnnoKeyOrDefault(params.value);

      expect(value).toEqual(params.expectedAnnoKeyOrDefault);
    },
  );

  test.each`
    value
    ${'no-separator'}
    ${'edge-type:{"ctype":"Dominance","name":""}'}
  `('valueToAnnoKeyOrDefault throws', (params: { value: string }) => {
    expect(() => valueToAnnoKeyOrDefault(params.value)).toThrow();
  });

  test.each`
    edgeType                                | expectedValue
    ${{ ctype: 'Dominance', name: '' }}     | ${'edge-type:{"ctype":"Dominance","name":""}'}
    ${{ ctype: 'Dominance', name: 'name' }} | ${'edge-type:{"ctype":"Dominance","name":"name"}'}
    ${{ ctype: 'Pointing', name: 'name' }}  | ${'edge-type:{"ctype":"Pointing","name":"name"}'}
  `(
    'edgeTypeToValue',
    (params: { edgeType: EdgeType; expectedValue: string }) => {
      const value = edgeTypeToValue(params.edgeType);

      expect(value).toEqual(params.expectedValue);
    },
  );

  test.each`
    value                                              | expectedEdgeType
    ${'edge-type:{"ctype":"Dominance","name":""}'}     | ${{ ctype: 'Dominance', name: '' }}
    ${'edge-type:{"ctype":"Dominance","name":"name"}'} | ${{ ctype: 'Dominance', name: 'name' }}
    ${'edge-type:{"ctype":"Pointing","name":"name"}'}  | ${{ ctype: 'Pointing', name: 'name' }}
  `(
    'valueToEdgeType',
    (params: { value: string; expectedEdgeType: EdgeType }) => {
      const value = valueToEdgeType(params.value);

      expect(value).toEqual(params.expectedEdgeType);
    },
  );

  test.each`
    value
    ${'no-separator'}
    ${'anno-key:{"ns":"ns","name":"name"}'}
  `('valueToEdgeType throws', (params: { value: string }) => {
    expect(() => valueToEdgeType(params.value)).toThrow();
  });

  test.each`
    segmentation | expectedValue
    ${''}        | ${'segmentation:""'}
    ${'dipl'}    | ${'segmentation:"dipl"'}
  `(
    'segmentationToValue',
    (params: { segmentation: string; expectedValue: string }) => {
      const value = segmentationToValue(params.segmentation);

      expect(value).toEqual(params.expectedValue);
    },
  );

  test.each`
    value                    | expectedSegmentation
    ${'segmentation:""'}     | ${''}
    ${'segmentation:"dipl"'} | ${'dipl'}
  `(
    'valueToSegmentation',
    (params: { value: string; expectedSegmentation: string }) => {
      const value = valueToSegmentation(params.value);

      expect(value).toEqual(params.expectedSegmentation);
    },
  );

  test.each`
    value
    ${'no-separator'}
    ${'anno-key:{"ns":"ns","name":"name"}'}
  `('valueToSegmentation throws', (params: { value: string }) => {
    expect(() => valueToSegmentation(params.value)).toThrow();
  });
});
