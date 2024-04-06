import GithubLogo from '@/assets/github-mark.svg?react';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { open } from '@/lib/api';
import { useRef } from 'react';

export const AboutDialog = () => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogContent
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle className="mb-4">About</DialogTitle>

        <DialogDescription className="flex flex-col gap-4">
          <p className="flex items-center">
            <Button
              className="h-4 p-0"
              onClick={() => {
                open('https://github.com/matthias-stemmler/annimate');
              }}
              variant="link"
            >
              <GithubLogo className="w-4 h-full mr-2" />
              AnniMate v{window.__ANNIMATE__.versionInfo.annimateVersion} by
              Matthias Stemmler
            </Button>
          </p>

          <div>
            <p className="mb-1">based on:</p>
            <p className="flex items-center">
              <Button
                className="h-4 p-0"
                onClick={() => {
                  open('https://github.com/korpling/graphANNIS');
                }}
                variant="link"
              >
                <GithubLogo className="w-4 h-full mr-2" />
                graphANNIS v{
                  window.__ANNIMATE__.versionInfo.graphannisVersion
                }{' '}
                by Thomas Krause
              </Button>
            </p>
          </div>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <DialogClose asChild>
          <Button ref={closeButtonRef} variant="outline">
            OK
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};
