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

  const { data: corpusSets, error: corpusSetsError } = useCorpusSets();

  if (corpusSetsError !== null) {
    throw new Error(`Failed to load corpora: ${corpusSetsError.message}`);
  }

  const alreadyExists =
    newName !== currentName && corpusSets?.includes(newName);

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
