import { QueryNode, QueryNodeRef } from '@/lib/api-types';

export const findEligibleQueryNodeRef = (
  eligibleNodes: QueryNode[][] | undefined,
  nodeRef: QueryNodeRef | undefined,
): QueryNodeRef | undefined => {
  if (eligibleNodes === undefined || nodeRef === undefined) {
    return undefined;
  }

  const indices = eligibleNodes
    .map((ns, i): [QueryNode[], number] => [ns, i])
    .filter(([ns]) => ns.some((n) => nodeRef.variables.includes(n.variable)))
    .map(([, i]) => i);

  const index: number | undefined = indices.includes(nodeRef.index)
    ? nodeRef.index
    : indices[0];

  return index === undefined
    ? undefined
    : {
        index,
        variables: eligibleNodes[index].map((n) => n.variable),
      };
};
