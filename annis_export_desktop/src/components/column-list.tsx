import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/custom/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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
import { GripVertical } from 'lucide-react';
import { FC, useState } from 'react';
import { createPortal } from 'react-dom';

export const ColumnList: FC = () => {
  const [columns, setColumns] = useState<UniqueIdentifier[]>([
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
  ]);
  const [activeColumn, setActiveColumn] = useState<
    UniqueIdentifier | undefined
  >();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveColumn(active.id);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over !== null && active.id !== over.id) {
      setColumns((columns) => {
        const oldIndex = columns.indexOf(active.id);
        const newIndex = columns.indexOf(over.id);

        return arrayMove(columns, oldIndex, newIndex);
      });
    }
  };

  return (
    <ScrollArea className="h-full p-3 border rounded-md bg-gray-100">
      <div className="flex flex-col gap-3">
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
          <SortableContext
            items={columns}
            strategy={verticalListSortingStrategy}
          >
            {columns.map((column) => (
              <ColumnCard key={column} caption={column.toString()} />
            ))}
          </SortableContext>

          {createPortal(
            <DragOverlay>
              {activeColumn && (
                <ColumnCard caption={activeColumn.toString()} isOverlay />
              )}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </div>
    </ScrollArea>
  );
};

type ColumnCardProp = {
  caption: string;
  isOverlay?: boolean;
};

const ColumnCard: FC<ColumnCardProp> = ({ caption, isOverlay = false }) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: caption });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      // transform-gpu works around a bug in WebKit
      // where items are slightly offset horizontally when dragging
      className={cn('border-green-600 border-l-8 transform-gpu', {
        'opacity-30': isDragging,
        'ring-ring ring-2': isOverlay,
      })}
      ref={setNodeRef}
      style={style}
    >
      <CardContent className="pl-4 pr-3 py-0 flex items-center gap-4">
        <div className="grow pt-1 pb-4">
          <p className="font-semibold text-sm mb-1">{caption}</p>
          <Select options={[{ caption: 'a', value: 'a' }]} />
        </div>
        <Button
          className={cn(
            'h-5 w-5 p-0 hover:bg-inherit cursor-grab active:cursor-grabbing',
            { 'focus-visible:ring-transparent': isDragging },
          )}
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};
