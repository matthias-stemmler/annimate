import { QueryNode, QueryNodeRef } from '@/lib/api-types';
import { findEligibleQueryNodeRef } from '@/lib/query-node-utils';
import { describe, expect, it } from 'vitest';

describe('query-node-utils', () => {
  describe('findEligibleQueryNodeRef', () => {
    it.each([
      [
        'given node ref uniquely eligible -> chooses it',
        [
          [{ variable: 'a', queryFragment: '' }],
          [
            { variable: 'b', queryFragment: '' },
            { variable: 'c', queryFragment: '' },
          ],
          [{ variable: 'd', queryFragment: '' }],
        ],
        { index: 1, variables: ['b'] },
        { index: 1, variables: ['b', 'c'] },
      ],
      [
        'given node ref non-uniquely eligible -> chooses it',
        [
          [
            { variable: 'a', queryFragment: '' },
            { variable: 'b', queryFragment: '' },
          ],
          [
            { variable: 'b', queryFragment: '' },
            { variable: 'c', queryFragment: '' },
          ],
          [{ variable: 'd', queryFragment: '' }],
        ],
        { index: 1, variables: ['b'] },
        { index: 1, variables: ['b', 'c'] },
      ],
      [
        'only other node refs eligible -> chooses first eligible',
        [
          [
            { variable: 'a', queryFragment: '' },
            { variable: 'b', queryFragment: '' },
          ],
          [{ variable: 'c', queryFragment: '' }],
          [
            { variable: 'b', queryFragment: '' },
            { variable: 'd', queryFragment: '' },
          ],
        ],
        { index: 1, variables: ['b'] },
        { index: 0, variables: ['a', 'b'] },
      ],
      [
        'no node refs eligible -> chooses none',
        [
          [{ variable: 'a', queryFragment: '' }],
          [{ variable: 'c', queryFragment: '' }],
          [{ variable: 'd', queryFragment: '' }],
        ],
        { index: 1, variables: ['b'] },
        undefined,
      ],
      [
        'node ref undefined -> chooses none',
        [[{ variable: '1', queryFragment: '' }]],
        undefined,
        undefined,
      ],
      [
        'eligible nodes undefined -> chooses none',
        undefined,
        { index: 0, variables: ['1'] },
        undefined,
      ],
    ])(
      'finds eligible query node ref (%s)',
      (
        _description: string,
        eligibleNodes: QueryNode[][] | undefined,
        nodeRef: QueryNodeRef | undefined,
        expectedEligibleNodeRef: QueryNodeRef | undefined,
      ) => {
        expect(findEligibleQueryNodeRef(eligibleNodes, nodeRef)).toEqual(
          expectedEligibleNodeRef,
        );
      },
    );
  });
});
