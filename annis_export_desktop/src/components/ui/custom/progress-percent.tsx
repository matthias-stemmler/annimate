import { Progress } from '@/components/ui/progress';
import { formatPercentage } from '@/lib/utils';
import { FC } from 'react';

export type ProgressPercentProps = {
  value?: number;
};

export const ProgressPercent: FC<ProgressPercentProps> = ({ value }) => (
  <div className="flex justify-between items-center gap-4">
    <Progress value={Math.round((value ?? 0) * 100)} />

    <p className="basis-14 text-right whitespace-nowrap leading-none">
      {value && formatPercentage(value)}
    </p>
  </div>
);
