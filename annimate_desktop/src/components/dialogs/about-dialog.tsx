import AnnimateLogo from '@/assets/annimate-logo.svg?react';
import GithubLogo from '@/assets/github-mark.svg?react';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { openUrl } from '@/lib/api';
import { URL_ANNIMATE, URL_GRAPHANNIS } from '@/lib/urls';
import { RefObject, useEffect, useMemo, useRef } from 'react';

const ANIMATION_DURATION = 2000;
const ANIMATION_INITIAL_DELAY = 3000;
const logoTiming = (t: number) => 1 - Math.pow(t - 1, 2);

export const AboutDialog = () => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const triggerLogoAnimation = useLogoAnimation(logoRef);

  return (
    <DialogContent
      aria-describedby={undefined}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle className="mb-4">About Annimate</DialogTitle>
      </DialogHeader>

      <div className="overflow-hidden px-1 pb-1 text-sm">
        <div
          ref={logoRef}
          className="mx-auto mb-8 w-36"
          onClick={triggerLogoAnimation}
        >
          <AnnimateLogo />
        </div>

        <div className="mb-4">
          <Button
            className="h-4 min-w-32 p-0"
            onClick={() => {
              openUrl(URL_ANNIMATE);
            }}
            variant="link"
          >
            <GithubLogo className="mr-2 h-full w-4" />
            Annimate v{window.__ANNIMATE__.versionInfo.annimateVersion} by
            Matthias Stemmler
          </Button>
        </div>

        <div>
          <p className="mb-1">based on:</p>

          <Button
            className="h-4 p-0"
            onClick={() => {
              openUrl(URL_GRAPHANNIS);
            }}
            variant="link"
          >
            <GithubLogo className="mr-2 h-full w-4" />
            graphANNIS v{window.__ANNIMATE__.versionInfo.graphannisVersion} by
            Thomas Krause
          </Button>
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button ref={closeButtonRef} variant="secondary">
            Close
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};

// JS instead of CSS animation because the native webview used by Tauri doesn't seem to support animation-timing-function
const useLogoAnimation = (logoRef: RefObject<HTMLElement | null>) => {
  const animationFrameRef = useRef<number>(null);
  const delayRef = useRef<number>(ANIMATION_INITIAL_DELAY);
  const startTimeRef = useRef<number>(null);

  const animationFrame = useMemo(() => {
    const callback = (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }

      const timeDelta = time - startTimeRef.current;

      if (timeDelta >= delayRef.current) {
        const progress = logoTiming(
          (timeDelta - delayRef.current) / ANIMATION_DURATION,
        );

        if (logoRef.current !== null) {
          logoRef.current.style.transform = `rotate(${progress * 180}deg)`;
        }
      }

      if (timeDelta < delayRef.current + ANIMATION_DURATION) {
        requestAnimationFrame(callback);
      } else {
        startTimeRef.current = null;
      }
    };

    return callback;
  }, [delayRef, logoRef, startTimeRef]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animationFrame);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animationFrame, animationFrameRef]);

  return () => {
    if (startTimeRef.current === null) {
      delayRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(animationFrame);
    }
  };
};
