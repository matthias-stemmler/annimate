import { annoKeyToValue, valueToAnnoKey } from '@/components/columns/utils';
import { describe, expect, test } from 'vitest';

describe('utils', () => {
  test('annoKeyToValue', () => {
    const value = annoKeyToValue({ ns: 'ns', name: 'name' });

    expect(value).toEqual('ns:name');
  });

  test('valueToAnnoKey', () => {
    const value = valueToAnnoKey('ns:name');

    expect(value).toEqual({ ns: 'ns', name: 'name' });
  });
});
