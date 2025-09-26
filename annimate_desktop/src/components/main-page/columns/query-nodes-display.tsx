import { QueryNode } from '@/lib/api-types';
import { groupBy, uniq } from '@/lib/utils';
import { FC } from 'react';

export type QueryNodesDisplayProps = {
  queryNodes: QueryNode[];
};

export const QueryNodesDisplay: FC<QueryNodesDisplayProps> = ({
  queryNodes,
}) => {
  const nodesByQueryFragment = groupBy(queryNodes, (n) => n.queryFragment);

  return (
    <div className="mr-2 flex min-w-0 gap-2 font-mono">
      {nodesByQueryFragment.map(([queryFragment, nodesForQueryFragment]) => (
        <div
          key={queryFragment}
          className="flex h-5.5 min-w-0 items-center gap-2 rounded-sm bg-gray-500 px-2 text-white"
        >
          {uniq(nodesForQueryFragment.map((n) => n.variable)).map(
            (variable, i) => (
              <span key={i} className="max-w-32 truncate font-semibold">
                #{variable}
              </span>
            ),
          )}
          <span className="max-w-64 flex-1 truncate">{queryFragment}</span>
        </div>
      ))}
    </div>
  );
};
