import { QueryNodeRef } from '@/lib/api-types';

export const findEligibleQueryNodeRefIndex = (
  eligibleNodeRefs: QueryNodeRef[],
  nodeRef: QueryNodeRef,
): number | undefined => {
  const indices = eligibleNodeRefs
    .filter((n) => n.variables.some((v) => nodeRef.variables.includes(v)))
    .map((n) => n.index);

  return indices.includes(nodeRef.index) ? nodeRef.index : indices[0];
};
