import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCorpusSets } from '@/lib/store';
import { cn } from '@/lib/utils';
import { FC, ReactNode, useState } from 'react';

export type CorpusSetDialogProps = {
  currentName?: string;
  onConfirm?: (newName: string) => void;
  title: ReactNode;
};

export const CorpusSetDialog: FC<CorpusSetDialogProps> = ({
  currentName,
  onConfirm,
  title,
}) => {
  const [newName, setNewName] = useState<string>(currentName ?? '');
  const [confirmedName, setConfirmedName] = useState<string | undefined>(
    undefined,
  );

  const { data: corpusSets, error: corpusSetsError } = useCorpusSets();

  if (corpusSetsError !== null) {
    throw new Error(`Failed to load corpora: ${corpusSetsError.message}`);
  }

  // If newName === confirmedName, this means that the dialog is closing after the new name has been confirmed,
  // so it's okay if it's already in the list of corpus sets
  const alreadyExists =
    newName !== currentName &&
    newName !== confirmedName &&
    corpusSets?.includes(newName);

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="flex flex-col gap-1">
          <Input
            maxLength={64}
            onChange={(event) => {
              setNewName(event.target.value);
            }}
            placeholder="Choose a name"
            value={newName}
          />

          <p
            className={cn('text-destructive', {
              invisible: !alreadyExists,
            })}
          >
            A corpus set with this name already exists.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="min-w-32"
              disabled={newName === '' || alreadyExists}
              onClick={() => {
                setConfirmedName(newName);
                onConfirm?.(newName);
              }}
              type="submit"
            >
              OK
            </Button>
          </DialogClose>

          <DialogClose asChild>
            <Button className="min-w-32" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
