import { cn } from '@/lib/utils';
import { LoaderIcon } from 'lucide-react';
import { FC } from 'react';

export type SpinnerProps = {
  className?: string;
};

export const Spinner: FC<SpinnerProps> = ({ className }) => (
  <LoaderIcon className={cn('animate-spin', className)} />
);
