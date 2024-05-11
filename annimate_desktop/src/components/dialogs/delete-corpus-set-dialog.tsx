import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FC, useId, useState } from 'react';

export type DeleteCorpusSetDialogProps = {
  corpusCount: number;
  corpusSet: string;
  onConfirm?: (params: { deleteCorpora: boolean }) => void;
};

export const DeleteCorpusSetDialog: FC<DeleteCorpusSetDialogProps> = ({
  corpusCount,
  corpusSet,
  onConfirm,
}) => {
  const [option, setOption] = useState('only-set');

  const onlySetOptionId = useId();
  const alsoCorporaOptionId = useId();

  const corpusOrCorpora = corpusCount === 1 ? 'corpus' : 'corpora';

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete corpus set</DialogTitle>
      </DialogHeader>

      {corpusCount === 0 ? (
        <div className="overflow-hidden mb-4">
          <span className="mr-1">
            Are you sure you want to delete the corpus set
          </span>{' '}
          &ldquo;{corpusSet}&rdquo;?
        </div>
      ) : (
        <>
          <div className="overflow-hidden">
            <span className="mr-1">Delete only the corpus set</span> &ldquo;
            {corpusSet}&rdquo;{' '}
            <span className="ml-1">
              itself or also its {corpusCount} {corpusOrCorpora}?
            </span>
          </div>

          <RadioGroup
            className="gap-0 mb-4"
            onValueChange={setOption}
            value={option}
          >
            <div
              className="flex items-center gap-2 py-1 cursor-pointer"
              onClick={() => {
                setOption('only-set');
              }}
            >
              <RadioGroupItem id={onlySetOptionId} value="only-set" />

              <Label
                htmlFor={onlySetOptionId}
                className="cursor-pointer text-md"
              >
                Only delete set, keep {corpusOrCorpora}
              </Label>
            </div>

            <div
              className="flex items-center gap-2 py-1 cursor-pointer"
              onClick={() => {
                setOption('also-corpora');
              }}
            >
              <RadioGroupItem id={alsoCorporaOptionId} value="also-corpora" />

              <Label
                htmlFor={alsoCorporaOptionId}
                className="cursor-pointer text-md"
              >
                Delete set and {corpusOrCorpora}
              </Label>
            </div>
          </RadioGroup>
        </>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button
            className="min-w-32"
            onClick={() => {
              onConfirm?.({ deleteCorpora: option === 'also-corpora' });
            }}
            variant="destructive"
          >
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
};
