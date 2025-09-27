import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { openPath } from '@/lib/api';
import { useClearCache, useDbDir } from '@/lib/store';
import { Folder } from 'lucide-react';
import { FC } from 'react';

export const AdvancedSection: FC = () => {
  const {
    mutation: { mutate: clearCache },
  } = useClearCache();
  const { toast } = useToast();
  const { data: dbDir, error: dbDirError } = useDbDir();

  if (dbDirError !== null) {
    throw new Error(`Failed to load data folder: ${dbDirError.message}`);
  }

  return (
    <div className="m-3 mt-0 flex items-center justify-between gap-8 rounded-md border px-3 py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="flex h-5 gap-2 px-2"
            disabled={dbDir === undefined}
            onClick={async () => {
              if (dbDir !== undefined) {
                await openPath(dbDir);
              }
            }}
            variant="link"
          >
            <Folder className="size-4" />
            Data folder
          </Button>
        </TooltipTrigger>

        <TooltipContent align="start" className="max-w-[calc(min(64rem,80vw))]">
          {dbDir ?? 'Loading ...'}
        </TooltipContent>
      </Tooltip>

      <Button
        className="h-8"
        size="sm"
        variant="secondary"
        onClick={() => {
          clearCache(undefined, {
            onError: (error: Error) => {
              toast({
                className: 'break-all',
                description: error.message,
                duration: 15000,
                title: 'Failed to clear annotation cache',
                variant: 'destructive',
              });
            },
            onSuccess: () => {
              toast({
                duration: 5000,
                title: 'Annotation cache cleared',
                variant: 'success',
              });
            },
          });
        }}
      >
        Clear annotation cache
      </Button>
    </div>
  );
};
