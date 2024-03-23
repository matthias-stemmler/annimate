import { QueryNodeRef } from '@/lib/api-types';

export const findEligibleQueryNodeRefIndex = (
  eligibleNodeRefs: QueryNodeRef[],
  nodeRef: QueryNodeRef,
): number | undefined => {
  const eligibleNodeRefsWithIndex = eligibleNodeRefs
    .map((n, i): [QueryNodeRef, number] => [n, i])
    .filter(([n]) => n.variables.some((v) => nodeRef.variables.includes(v)));

  if (eligibleNodeRefsWithIndex.length === 0) {
    return undefined;
  }

  const [, index] =
    eligibleNodeRefsWithIndex.find(([n]) => n.index === nodeRef.index) ??
    eligibleNodeRefsWithIndex[0];

  return index;
};
