import { AutoScroller } from '@/components/ui/custom/auto-scroller';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DraggableAttributes,
  DraggableSyntheticListeners,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CSSProperties, ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

export type ReorderListProps<T> = {
  autoScroller?: AutoScroller;
  disabled?: boolean;
  getId: (item: T) => string;
  idPrefix: string;
  items: T[];
  onReorder: (
    reorder: <U>(items: U[], getId: (item: U) => string) => U[],
  ) => void;
  renderItem: (item: T, context: ReorderListContext) => ReactNode;
};

export type ReorderListContext = {
  dragHandleAttributes: DraggableAttributes;
  dragHandleListeners: DraggableSyntheticListeners;
  isOverlay: boolean;
  isPlaceholder: boolean;
  ref?: (node: HTMLElement | null) => void;
  style: CSSProperties;
};

export const ReorderList = <T,>({
  autoScroller,
  disabled,
  getId,
  idPrefix,
  items,
  onReorder,
  renderItem,
}: ReorderListProps<T>) => {
  const [activeId, setActiveId] = useState<string | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over !== null && active.id !== over.id) {
      onReorder(<U,>(is: U[], getId: (item: U) => string) => {
        const oldIndex = is.findIndex(
          (item) => idPrefix + '-' + getId(item) === active.id,
        );
        const newIndex = is.findIndex(
          (item) => idPrefix + '-' + getId(item) === over.id,
        );
        return arrayMove(is, oldIndex, newIndex);
      });
    }
  };

  const activeItem =
    activeId === undefined
      ? undefined
      : items.find((item) => idPrefix + '-' + getId(item) === activeId);

  return (
    <DndContext
      autoScroll={
        autoScroller === undefined
          ? false
          : {
              canScroll: autoScroller.canScroll,
            }
      }
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext
        items={items.map((item) => idPrefix + '-' + getId(item))}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <ReorderListItem
            key={idPrefix + '-' + getId(item)}
            disabled={disabled}
            id={idPrefix + '-' + getId(item)}
            item={item}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>

      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeItem !== undefined && (
            <ReorderListItem
              key={idPrefix + '-' + getId(activeItem)}
              id={idPrefix + '-' + getId(activeItem)}
              isOverlay
              item={activeItem}
              renderItem={renderItem}
            />
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
};

type ReorderListItemProps<T> = {
  id: string;
  disabled?: boolean;
  isOverlay?: boolean;
  item: T;
  renderItem: (item: T, context: ReorderListContext) => ReactNode;
};

const ReorderListItem = <T,>({
  id,
  disabled,
  isOverlay = false,
  item,
  renderItem,
}: ReorderListItemProps<T>) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled });

  const style = {
    // `translate3d(0, 0, 0)` works around a bug in WebKit
    // where items are slightly offset horizontally when dragging
    transform:
      transform === null
        ? 'translate3d(0, 0, 0)'
        : CSS.Transform.toString(transform),
    transition,
  };

  return renderItem(item, {
    dragHandleAttributes: attributes,
    dragHandleListeners: listeners,
    isOverlay,
    isPlaceholder: isDragging,
    ref: setNodeRef,
    style,
  });
};
