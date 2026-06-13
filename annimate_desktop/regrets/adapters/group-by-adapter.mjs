// Adapter for groupBy - wraps the pure function with serializable inputs
import { groupBy } from '../../dist/lib/utils.js';

export function groupByAdapter(input) {
  const { items, keyType } = input;
  let getKey;
  if (keyType === 'mod2') getKey = (x) => x % 2;
  else if (keyType === 'firstChar') getKey = (s) => s[0];
  else if (keyType === 'identity') getKey = (x) => x;
  else getKey = (x) => x;
  return groupBy(items, getKey);
}
