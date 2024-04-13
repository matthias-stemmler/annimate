import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/custom/spinner';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCorpusSetsWithCount } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FC, PropsWithChildren } from 'react';

export type CorpusSetListProps = {
  onSelectCorpusSet?: (value: string | undefined) => void;
  selectedCorpusSet: string | undefined;
};

export const CorpusSetList: FC<CorpusSetListProps> = ({
  onSelectCorpusSet: onChange,
  selectedCorpusSet,
}) => {
  const {
    data: corpusSetsWithCount,
    error,
    isPending,
  } = useCorpusSetsWithCount();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error}`);
  }

  if (isPending) {
    return <Spinner />;
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="border rounded-md overflow-hidden">
        <SelectableRow
          buttonClassName="italic"
          caption="All corpora"
          isSelected={selectedCorpusSet === undefined}
          onClick={() => {
            onChange?.(undefined);
          }}
        />
      </div>

      <div className="flex-1 h-0 flex flex-col gap-2">
        <div className="flex justify-between items-end">
          <Label className="mb-2">Corpus sets</Label>

          <Button variant="secondary">
            <Plus className="h-4 w-4 mr-2" />
            Add corpus set
          </Button>
        </div>

        <div className="flex-1 h-0 border rounded-md overflow-hidden">
          {corpusSetsWithCount.length === 0 ? (
            <p className="text-center text-muted-foreground mt-4">
              No corpus sets available
            </p>
          ) : (
            <ScrollArea className="h-full ">
              <ScrollBar orientation="horizontal" />

              {corpusSetsWithCount.map(({ corpusSet, corpusCount }) => {
                const isSelected = corpusSet === selectedCorpusSet;

                return (
                  <SelectableRow
                    key={corpusSet}
                    caption={corpusSet}
                    isSelected={isSelected}
                    onClick={() => onChange?.(corpusSet)}
                  >
                    <div className="flex items-center">
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className="mx-4" variant="secondary">
                            {corpusCount}
                          </Badge>
                        </TooltipTrigger>

                        <TooltipContent>
                          Set contains {corpusCount}{' '}
                          {corpusCount === 1 ? 'corpus' : 'corpora'}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost">
                            <Pencil />
                          </Button>
                        </TooltipTrigger>

                        <TooltipContent>Rename corpus set</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="text-destructive hover:text-destructive"
                            variant="ghost"
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>

                        <TooltipContent>Delete corpus set</TooltipContent>
                      </Tooltip>
                    </div>
                  </SelectableRow>
                );
              })}
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

type SelectableRowProps = PropsWithChildren<{
  buttonClassName?: string;
  caption: string;
  isSelected: boolean;
  onClick?: () => void;
}>;

const SelectableRow: FC<SelectableRowProps> = ({
  buttonClassName,
  caption,
  children,
  isSelected,
  onClick,
}) => (
  <div
    className={cn(
      'flex gap-2 items-stretch justify-between shadow-[0_1px] shadow-gray-200 pl-4 pr-3 py-1',
      {
        'border-l-gray-400 border-l-8 pl-2': isSelected,
      },
    )}
  >
    <Button
      className={cn(
        buttonClassName,
        'block w-0 truncate text-left flex-1 py-2',
        {
          'font-bold': isSelected,
        },
      )}
      onClick={onClick}
      variant="link"
    >
      {caption}
    </Button>

    {children}
  </div>
);
