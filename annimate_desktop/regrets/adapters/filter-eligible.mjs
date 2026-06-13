// Adapter for filterEligible - wraps the pure function with serializable inputs
import { filterEligible } from '../../dist/lib/utils.js';

export function filterEligibleAdapter(input) {
  const { eligibleValues, value, compareType } = input;
  let compare;
  if (compareType === 'equality') compare = (a, b) => a === b;
  else if (compareType === 'lessThan') compare = (a, b) => a < b;
  else compare = (a, b) => a === b;
  return filterEligible(eligibleValues, value, compare);
}
