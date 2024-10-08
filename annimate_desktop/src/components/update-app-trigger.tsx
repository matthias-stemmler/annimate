import {
  UpdateAppDialog,
  UpdateData,
  UpdateStatus,
} from '@/components/dialogs/update-app-dialog';
import { useDialogState } from '@/components/dialogs/use-dialog-state';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { checkForUpdate } from '@/lib/api';
import { Update } from '@/lib/api-types';
import { useApplyAppUpdate } from '@/lib/store';
import { useEffect, useRef } from 'react';

export const UpdateAppTrigger = () => {
  const checkedRef = useRef<boolean>(false);
  const updateRef = useRef<Update | null>(null);
  // Save update data for display separately, so we can close (drop) the update when the dialog is closed without breaking the fade-out animation
  const updateDataRef = useRef<UpdateData | null>(null);

  const { mutation, progress, reset, stage } = useApplyAppUpdate();

  const { toast } = useToast();
  const [dialogOpen, setDialogOpen, dialogKey] = useDialogState();

  useEffect(() => {
    if (checkedRef.current) {
      return;
    }
    checkedRef.current = true;

    checkForUpdate()
      .then((update) => {
        if (update !== null) {
          updateRef.current = update;
          updateDataRef.current = {
            currentVersion: update.currentVersion,
            notes: update.body ?? '',
            version: update.version,
          };
          setDialogOpen(true);
        }
      })
      .catch((error: Error) => {
        toast({
          className: 'break-all',
          description: error.message,
          duration: 15000,
          title: 'Failed to check for update',
          variant: 'destructive',
        });
      });
  }, [checkedRef, setDialogOpen, toast, updateDataRef, updateRef]);

  const status: UpdateStatus = (() => {
    if (mutation.isError) {
      return { type: 'failed', error: mutation.error };
    }

    if (progress === undefined) {
      return { type: 'idle' };
    }

    return stage === 'download'
      ? { type: 'downloading', progress: progress ?? 0 }
      : { type: 'installing' };
  })();

  return (
    <Dialog open={dialogOpen}>
      {updateDataRef.current !== null && (
        <UpdateAppDialog
          key={dialogKey}
          onClose={() => {
            updateRef.current?.close();
            updateRef.current = null;
            setDialogOpen(false);
            reset();
          }}
          onConfirm={() => {
            if (updateRef.current !== null) {
              mutation.mutate({ update: updateRef.current });
            }
          }}
          status={status}
          update={updateDataRef.current}
        />
      )}
    </Dialog>
  );
};
