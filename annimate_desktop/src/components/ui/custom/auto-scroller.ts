import { RefCallback, useEffect, useRef } from 'react';

// Helper module implementing a workaround for a WebKit bug where item rendering and cursor position can get out of sync
// when a drag&drop list is auto-scrolled, see https://github.com/clauderic/dnd-kit/issues/1333.
//
// One possible workaround is to set a high auto-scroll acceleration, e.g.
//     <DndContext autoScroll={{ acceleration: 2000 }}>{/* ... */}</DndContext>
// but that makes it harder to hit the desired drop position.
//
// Instead, here we implement the workaround suggested in https://github.com/clauderic/dnd-kit/issues/1333#issuecomment-2163433527.
// However, instead of patching @dnd-kit/core, we overwrite the `scrollBy` method to make it apply `Math.round` to the given scroll offsets.
//
// Usage:
//   const autoScroller = useAutoScroller();
//
//   return (
//     <div ref={autoScroller.ref}>
//       <ReorderList autoScroller={autoScroller}>
//         {/* ... */}
//       </ReorderList>
//     </div>
//   );
//
// where the <div> is the element to be auto-scrolled.

export type AutoScroller = {
  readonly canScroll: (element: Element) => boolean;
  readonly ref: RefCallback<Element>;
};

export const useAutoScroller = (): AutoScroller => {
  const ref = useRef<Element>(null);

  useEffect(() => {
    if (ref.current === null) {
      return;
    }

    const scrollByOrig = ref.current.scrollBy;

    ref.current.scrollBy = (
      firstArg?: ScrollToOptions | number,
      secondArg?: number,
    ) => {
      if (typeof firstArg === 'number') {
        const [x, y] = [firstArg, secondArg as number];
        scrollByOrig.call(ref.current, Math.round(x), Math.round(y));
      } else if (firstArg !== undefined) {
        const { left, top, ...rest } = firstArg;
        const newScrollToOptions: ScrollToOptions = {
          left: left === undefined ? undefined : Math.round(left),
          top: top === undefined ? undefined : Math.round(top),
          ...rest,
        };
        // @ts-expect-error `call` incorrectly assumes the last overload of `scrollBy`, see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-2.html#caveats
        scrollByOrig.call(ref.current, newScrollToOptions);
      } else {
        // @ts-expect-error `call` incorrectly assumes the last overload of `scrollBy`, see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-2.html#caveats
        scrollByOrig.call(ref.current);
      }
    };

    return () => {
      if (ref.current !== null) {
        ref.current.scrollBy = scrollByOrig;
      }
    };
  }, [ref]);

  return {
    canScroll: (element) => element === ref.current,
    ref: (element) => {
      ref.current = element;
    },
  };
};
