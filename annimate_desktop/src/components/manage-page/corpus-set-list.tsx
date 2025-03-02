import { CorpusSetDialog } from '@/components/dialogs/corpus-set-dialog';
import { DeleteCorpusSetDialog } from '@/components/dialogs/delete-corpus-set-dialog';
import { useDialogState } from '@/components/dialogs/use-dialog-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreateCorpusSet,
  useDeleteCorpusSet,
  useRenameCorpusSet,
} from '@/lib/store';
import { cn } from '@/lib/utils';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FC, PropsWithChildren } from 'react';

export type CorpusSetListProps = {
  corpusCount: number;
  corpusSetsWithCount: { corpusSet: string; corpusCount: number }[];
  onSelectCorpusSet?: (value: string | undefined) => void;
  selectedCorpusSet: string | undefined;
};

export const CorpusSetList: FC<CorpusSetListProps> = ({
  corpusCount,
  corpusSetsWithCount,
  onSelectCorpusSet,
  selectedCorpusSet,
}) => (
  <div className="flex h-full flex-col gap-6">
    <div className="overflow-hidden rounded-md border">
      <SelectableRow
        caption="All corpora"
        isSelected={selectedCorpusSet === undefined}
        onClick={() => {
          onSelectCorpusSet?.(undefined);
        }}
      >
        <div className="mr-28 flex items-center">
          <Tooltip>
            <TooltipTrigger tabIndex={-1}>
              <Badge className="mx-4" variant="secondary">
                {corpusCount}
              </Badge>
            </TooltipTrigger>

            <TooltipContent>
              {corpusCount} {corpusCount === 1 ? 'corpus' : 'corpora'} in total
            </TooltipContent>
          </Tooltip>
        </div>
      </SelectableRow>
    </div>

    <div className="flex h-0 flex-1 flex-col gap-2">
      <div className="flex items-end justify-between">
        <Label className="mb-2 truncate leading-5">Corpus sets</Label>

        <AddCorpusSetTrigger onCorpusSetAdded={onSelectCorpusSet} />
      </div>

      <div className="flex-1 overflow-hidden rounded-md border">
        {corpusSetsWithCount.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-center">
            No corpus sets available
          </p>
        ) : (
          <ScrollArea className="h-full">
            {corpusSetsWithCount.map(({ corpusSet, corpusCount }) => {
              const isSelected = corpusSet === selectedCorpusSet;

              return (
                <SelectableRow
                  key={corpusSet}
                  caption={corpusSet}
                  isSelected={isSelected}
                  onClick={() => onSelectCorpusSet?.(corpusSet)}
                >
                  <div className="flex items-center">
                    <Tooltip>
                      <TooltipTrigger tabIndex={-1}>
                        <Badge className="mx-4" variant="secondary">
                          {corpusCount}
                        </Badge>
                      </TooltipTrigger>

                      <TooltipContent>
                        Set contains {corpusCount}{' '}
                        {corpusCount === 1 ? 'corpus' : 'corpora'}
                      </TooltipContent>
                    </Tooltip>

                    <RenameCorpusSetTrigger corpusSet={corpusSet} />

                    <DeleteCorpusSetTrigger
                      corpusCount={corpusCount}
                      corpusSet={corpusSet}
                    />
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

type AddCorpusSetTriggerProps = {
  onCorpusSetAdded?: (corpusSet: string) => void;
};

const AddCorpusSetTrigger: FC<AddCorpusSetTriggerProps> = ({
  onCorpusSetAdded,
}) => {
  const [open, setOpen, key] = useDialogState();
  const {
    mutation: { mutate: createCorpusSet },
  } = useCreateCorpusSet();
  const { toast } = useToast();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="ml-1" variant="secondary">
          <Plus className="mr-2 size-4" />
          Add corpus set
        </Button>
      </DialogTrigger>

      <CorpusSetDialog
        key={key}
        onConfirm={(newName) => {
          createCorpusSet(
            { corpusSet: newName },
            {
              onSuccess: () => {
                onCorpusSetAdded?.(newName);
              },
              onError: (error: Error) => {
                toast({
                  className: 'break-all',
                  description: error.message,
                  duration: 15000,
                  title: 'Failed to create corpus set',
                  variant: 'destructive',
                });
              },
            },
          );
        }}
        title="Add corpus set"
      />
    </Dialog>
  );
};

type RenameCorpusSetTriggerProps = {
  corpusSet: string;
};

const RenameCorpusSetTrigger: FC<RenameCorpusSetTriggerProps> = ({
  corpusSet,
}) => {
  const [open, setOpen, key] = useDialogState();
  const {
    mutation: { mutate: renameCorpusSet },
  } = useRenameCorpusSet();
  const { toast } = useToast();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost">
              <Pencil />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>

        <TooltipContent>Rename set</TooltipContent>
      </Tooltip>

      <CorpusSetDialog
        key={key}
        currentName={corpusSet}
        onConfirm={(newName) => {
          renameCorpusSet(
            { corpusSet, newCorpusSet: newName },
            {
              onError: (error: Error) => {
                toast({
                  className: 'break-all',
                  description: error.message,
                  duration: 15000,
                  title: 'Failed to rename corpus set',
                  variant: 'destructive',
                });
              },
            },
          );
        }}
        title={
          <>
            <span className="mr-1">Rename corpus set</span> &ldquo;{corpusSet}
            &rdquo;
          </>
        }
      />
    </Dialog>
  );
};

type DeleteCorpusSetTriggerProps = {
  corpusCount: number;
  corpusSet: string;
};

const DeleteCorpusSetTrigger: FC<DeleteCorpusSetTriggerProps> = ({
  corpusCount,
  corpusSet,
}) => {
  const [open, setOpen, key] = useDialogState();
  const {
    mutation: { mutate: deleteCorpusSet },
  } = useDeleteCorpusSet();
  const { toast } = useToast();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              className="text-destructive hover:text-destructive"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>

        <TooltipContent>Delete set</TooltipContent>
      </Tooltip>

      <DeleteCorpusSetDialog
        key={key}
        corpusCount={corpusCount}
        corpusSet={corpusSet}
        onConfirm={({ deleteCorpora }) => {
          deleteCorpusSet(
            { corpusSet, deleteCorpora },
            {
              onError: (error: Error) => {
                toast({
                  className: 'break-all',
                  description: error.message,
                  duration: 15000,
                  title: 'Failed to delete corpus set',
                  variant: 'destructive',
                });
              },
            },
          );
        }}
      />
    </Dialog>
  );
};

type SelectableRowProps = PropsWithChildren<{
  caption: string;
  isSelected: boolean;
  onClick?: () => void;
}>;

const SelectableRow: FC<SelectableRowProps> = ({
  caption,
  children,
  isSelected,
  onClick,
}) => (
  <div
    className={cn(
      'flex items-stretch justify-between gap-2 py-1 pr-3 pl-4 shadow-[0_1px] shadow-gray-200 dark:shadow-gray-800',
      {
        'border-l-8 border-l-gray-400 pl-2': isSelected,
      },
    )}
  >
    <Button
      className={cn('block w-0 flex-1 truncate py-2 text-left leading-5', {
        'font-bold': isSelected,
      })}
      onClick={onClick}
      variant="link"
    >
      {caption}
    </Button>

    {children}
  </div>
);
