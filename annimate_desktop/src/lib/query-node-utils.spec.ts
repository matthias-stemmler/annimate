import { QueryNodeRef } from '@/lib/api-types';
import { findEligibleQueryNodeRefIndex } from '@/lib/query-node-utils';
import { describe, expect, it } from 'vitest';

describe('query-node-utils', () => {
  describe('findEligibleQueryNodeRefIndex', () => {
    it.each([
      [
        'given node ref uniquely eligible -> chooses it',
        [
          { index: 100, variables: ['a'] },
          { index: 101, variables: ['b', 'c'] },
          { index: 102, variables: ['d'] },
        ],
        { index: 101, variables: ['b'] },
        1,
      ],
      [
        'given node ref non-uniquely eligible -> chooses it',
        [
          { index: 100, variables: ['a', 'b'] },
          { index: 101, variables: ['b', 'c'] },
          { index: 102, variables: ['d'] },
        ],
        { index: 101, variables: ['b'] },
        1,
      ],
      [
        'only other node refs eligible -> chooses first eligible',
        [
          { index: 100, variables: ['a', 'b'] },
          { index: 101, variables: ['c'] },
          { index: 102, variables: ['b', 'd'] },
        ],
        { index: 101, variables: ['b'] },
        0,
      ],
      [
        'no node refs eligible -> chooses none',
        [
          { index: 100, variables: ['a'] },
          { index: 101, variables: ['c'] },
          { index: 102, variables: ['d'] },
        ],
        { index: 101, variables: ['b'] },
        undefined,
      ],
    ])(
      'finds eligible query node ref (%s)',
      (
        _description: string,
        eligibleNodeRefs: QueryNodeRef[],
        nodeRef: QueryNodeRef,
        expectedEligibleIndex: number | undefined,
      ) => {
        expect(findEligibleQueryNodeRefIndex(eligibleNodeRefs, nodeRef)).toBe(
          expectedEligibleIndex,
        );
      },
    );
  });
});
