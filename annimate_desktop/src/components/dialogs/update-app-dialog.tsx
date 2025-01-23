import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { shellOpen } from '@/lib/api';
import { formatPercentage } from '@/lib/utils';
import { FC, JSX } from 'react';
import Markdown from 'react-markdown';

export type UpdateData = {
  currentVersion: string;
  notes: string;
  version: string;
};

export type UpdateStatus =
  | {
      type: 'idle';
    }
  | {
      type: 'downloading';
      progress: number;
    }
  | {
      type: 'installing';
    }
  | {
      type: 'failed';
      error: Error;
    };

export type UpdateAppDialogProps = {
  onClose?: () => void;
  onConfirm?: () => void;
  status: UpdateStatus;
  update: UpdateData;
};

export const UpdateAppDialog: FC<UpdateAppDialogProps> = ({
  onClose,
  onConfirm,
  status,
  update,
}) => (
  <DialogContent
    aria-describedby={undefined}
    className="max-w-[calc(min(48rem,80vw))]"
    noClose
  >
    <DialogHeader>
      <DialogTitle>Update available</DialogTitle>
    </DialogHeader>

    <div className="flex">
      <div className="grid grid-cols-2 gap-x-4">
        <span>Current version:</span>
        <span className="font-semibold">{update.currentVersion}</span>

        <span>New version:</span>
        <span className="font-semibold">{update.version}</span>
      </div>
    </div>

    <div className="flex h-96 flex-col gap-6">
      <ScrollArea className="h-full rounded-md border">
        <Markdown
          className="prose prose-sm dark:prose-invert prose-a:text-blue-800 m-3 cursor-text select-text"
          components={{ a: ExternalAnchor }}
        >
          {update.notes}
        </Markdown>
      </ScrollArea>

      {status.type !== 'idle' && (
        <div className="mb-4">
          <div className="mb-2 flex justify-between">
            {status.type === 'downloading' && <p>Downloading &hellip;</p>}
            {status.type === 'installing' && <p>Installing &hellip;</p>}
            {status.type === 'failed' && (
              <p className="text-destructive">{status.error.message}</p>
            )}

            {status.type === 'downloading' && (
              <p className="w-0 grow truncate text-right">
                {formatPercentage(status.progress)}
              </p>
            )}
          </div>

          <Progress
            value={Math.round(
              (status.type === 'downloading'
                ? status.progress
                : status.type === 'installing'
                  ? 1
                  : 0) * 100,
            )}
          />
        </div>
      )}
    </div>

    <DialogFooter>
      <Button
        className="min-w-40"
        disabled={status.type !== 'idle'}
        onClick={() => {
          onConfirm?.();
        }}
      >
        Update and restart
      </Button>

      <Button
        className="min-w-40"
        disabled={status.type !== 'idle' && status.type !== 'failed'}
        onClick={() => {
          onClose?.();
        }}
        variant="secondary"
      >
        Ask again later
      </Button>
    </DialogFooter>
  </DialogContent>
);

const ExternalAnchor = (props: JSX.IntrinsicElements['a']) => (
  <a
    {...props}
    onClick={(event) => {
      event.preventDefault();

      if (props.href !== undefined) {
        shellOpen(props.href);
      }
    }}
  ></a>
);
