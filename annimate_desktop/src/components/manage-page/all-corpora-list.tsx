import { DeleteCorpusDialog } from '@/components/dialogs/delete-corpus-dialog';
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
import { useDeleteCorpus } from '@/lib/store';
import { Trash2 } from 'lucide-react';
import { FC } from 'react';

export type AllCorporaListProps = {
  corpusNames: string[];
};

export const AllCorporaList: FC<AllCorporaListProps> = ({ corpusNames }) => {
  const {
    mutation: { mutate: deleteCorpus },
  } = useDeleteCorpus();
  const { toast } = useToast();

  return (
    <div className="flex h-full flex-col gap-2">
      <Label className="mb-2 truncate leading-5">All corpora</Label>

      <div className="flex-1 overflow-hidden rounded-md border">
        {corpusNames.length === 0 ? (
          <p className="mt-4 text-center text-muted-foreground">
            No corpora available
          </p>
        ) : (
          <ScrollArea className="h-full">
            {corpusNames.map((corpusName) => (
              <div
                key={corpusName}
                className={
                  'flex items-center justify-between gap-2 py-1 pl-4 pr-3 shadow-[0_1px] shadow-gray-200 dark:shadow-gray-800'
                }
              >
                <Label className="w-0 flex-1 truncate leading-5">
                  {corpusName}
                </Label>

                <Dialog>
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

                    <TooltipContent>Delete corpus</TooltipContent>
                  </Tooltip>

                  <DeleteCorpusDialog
                    corpusName={corpusName}
                    onConfirm={() => {
                      deleteCorpus(
                        { corpusName },
                        {
                          onError: (error: Error) => {
                            toast({
                              className: 'break-all',
                              description: error.message,
                              duration: 15000,
                              title: 'Failed to delete corpus',
                              variant: 'destructive',
                            });
                          },
                        },
                      );
                    }}
                  />
                </Dialog>
              </div>
            ))}
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
