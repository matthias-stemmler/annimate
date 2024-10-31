import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FC } from 'react';

export type DeleteCorpusDialogProps = {
  corpusName: string;
  onConfirm?: () => void;
};

export const DeleteCorpusDialog: FC<DeleteCorpusDialogProps> = ({
  corpusName,
  onConfirm,
}) => (
  <DialogContent aria-describedby={undefined}>
    <DialogHeader>
      <DialogTitle>Delete corpus</DialogTitle>
    </DialogHeader>

    <div className="mb-4 overflow-hidden">
      <span className="mr-1">Are you sure you want to delete the corpus</span>{' '}
      &ldquo;{corpusName}&rdquo;?
    </div>

    <DialogFooter>
      <DialogClose asChild>
        <Button className="min-w-32" onClick={onConfirm} variant="destructive">
          Delete
        </Button>
      </DialogClose>

      <DialogClose asChild>
        <Button className="min-w-32" variant="secondary">
          Cancel
        </Button>
      </DialogClose>
    </DialogFooter>
  </DialogContent>
);
