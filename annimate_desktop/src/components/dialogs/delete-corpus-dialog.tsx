import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useDeleteCorpus } from '@/lib/store';
import { FC } from 'react';

export type DeleteCorpusDialogProps = {
  corpusName: string;
};

export const DeleteCorpusDialog: FC<DeleteCorpusDialogProps> = ({
  corpusName,
}) => {
  const {
    mutation: { mutate: deleteCorpus },
  } = useDeleteCorpus();
  const { toast } = useToast();

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete corpus</DialogTitle>
      </DialogHeader>

      <div>
        <span className="mr-1">Are you sure you want to delete corpus</span>{' '}
        &ldquo;{corpusName}&rdquo;?
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button
            onClick={() => {
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
            variant="destructive"
          >
            Delete
          </Button>
        </DialogClose>

        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};
