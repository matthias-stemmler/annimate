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
    <div className="min-w-0 flex gap-2 mr-2 font-mono">
      {nodesByQueryFragment.map(([queryFragment, nodesForQueryFragment]) => (
        <div
          key={queryFragment}
          className="h-5 min-w-0 flex items-center gap-2 px-2 bg-gray-500 text-white rounded-sm"
        >
          {uniq(nodesForQueryFragment.map((n) => n.variable)).map(
            (variable, i) => (
              <span key={i} className="max-w-32 truncate font-semibold">
                #{variable}
              </span>
            ),
          )}
          <span className="flex-1 max-w-64 truncate">{queryFragment}</span>
        </div>
      ))}
    </div>
  );
};
