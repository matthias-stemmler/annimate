import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DraggableAttributes,
  DraggableSyntheticListeners,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
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

export type ReorderListProps<T, I> = {
  items: T[];
  onReorder: (reorder: <U extends { id: I }>(items: U[]) => U[]) => void;
  renderItem: (item: T, context: ReorderListContext) => ReactNode;
};

export type ReorderListContext = {
  dragHandleAttributes: DraggableAttributes;
  dragHandleListeners: DraggableSyntheticListeners;
  isOverlay: boolean;
  isPlaceholder: boolean;
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
};

export const ReorderList = <T extends { id: I }, I extends UniqueIdentifier>({
  items,
  onReorder,
  renderItem,
}: ReorderListProps<T, I>) => {
  const [activeId, setActiveId] = useState<I | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as I);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over !== null && active.id !== over.id) {
      onReorder(<U extends { id: I }>(is: U[]) => {
        const oldIndex = is.findIndex(({ id }) => id === active.id);
        const newIndex = is.findIndex(({ id }) => id === over.id);
        return arrayMove(is, oldIndex, newIndex);
      });
    }
  };

  const activeItem =
    activeId === undefined
      ? undefined
      : items.find(({ id }) => id === activeId);

  return (
    <DndContext
      autoScroll={{
        // High acceleration works around a bug in WebKit
        // where auto scroll causes item rendering and scroll position to get out of sync
        acceleration: 2000,
      }}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <ReorderListItem
            key={item.id}
            id={item.id}
            item={item}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>

      {createPortal(
        <DragOverlay>
          {activeItem !== undefined && (
            <ReorderListItem
              key={activeItem.id}
              id={activeItem.id}
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

type ReorderListItemProps<T, I> = {
  id: I;
  isOverlay?: boolean;
  item: T;
  renderItem: (item: T, context: ReorderListContext) => ReactNode;
};

const ReorderListItem = <T, I extends UniqueIdentifier>({
  id,
  isOverlay = false,
  item,
  renderItem,
}: ReorderListItemProps<T, I>) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

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
