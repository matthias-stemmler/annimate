import { useState } from 'react';

type DialogState = [boolean, (open: boolean) => void, number];

// The <Dialog> component doesn't support remounting a dialog (resetting its internal state) when it's opened.
// One can instead force a remount by giving a dialog a new key whenever it's opened.
// This is a utility hook to help manage the open state and the key.
// (Note that just using the open state itself as key isn't enough,
// because it also causes a remount when a dialog is *closed*, breaking the fade-out animation.)
export const useDialogState = (): DialogState => {
  const [open, setOpenInternal] = useState(false);
  const [key, setKey] = useState(0);

  const setOpen = (open: boolean) => {
    if (open) {
      setKey((k) => k + 1);
    }

    setOpenInternal(open);
  };

  return [open, setOpen, key];
};
