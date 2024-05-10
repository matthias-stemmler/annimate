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
import { shellOpen } from '@/lib/api';
import { RefObject, useCallback, useEffect, useRef } from 'react';

const ANIMATION_DURATION = 2000;
const ANIMATION_INITIAL_DELAY = 3000;
const logoTiming = (t: number) => 1 - Math.pow(t - 1, 2);

export const AboutDialog = () => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const triggerLogoAnimation = useLogoAnimation(logoRef);

  return (
    <DialogContent
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle className="mb-4">About AnniMate</DialogTitle>

        <div className="flex flex-col gap-4">
          <div
            ref={logoRef}
            className="w-36 mx-auto mb-8"
            onClick={triggerLogoAnimation}
          >
            <AnnimateLogo />
          </div>

          <div className="flex items-center">
            <Button
              className="min-w-32 h-4 p-0"
              onClick={() => {
                shellOpen('https://github.com/matthias-stemmler/annimate');
              }}
              variant="link"
            >
              <GithubLogo className="w-4 h-full mr-2" />
              AnniMate v{window.__ANNIMATE__.versionInfo.annimateVersion} by
              Matthias Stemmler
            </Button>
          </div>

          <div>
            <p className="text-sm mb-1">based on:</p>
            <div className="flex items-center">
              <Button
                className="h-4 p-0"
                onClick={() => {
                  shellOpen('https://github.com/korpling/graphANNIS');
                }}
                variant="link"
              >
                <GithubLogo className="w-4 h-full mr-2" />
                graphANNIS v{
                  window.__ANNIMATE__.versionInfo.graphannisVersion
                }{' '}
                by Thomas Krause
              </Button>
            </div>
          </div>
        </div>
      </DialogHeader>

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
const useLogoAnimation = (logoRef: RefObject<HTMLElement>) => {
  const animationFrameRef = useRef<number | null>(null);
  const delayRef = useRef(ANIMATION_INITIAL_DELAY);
  const startTimeRef = useRef<number | null>(null);

  const animationFrame = useCallback(
    (time: number) => {
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
        requestAnimationFrame(animationFrame);
      } else {
        startTimeRef.current = null;
      }
    },
    [delayRef, logoRef, startTimeRef],
  );

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
