import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReorderList } from '@/components/ui/custom/reorder-list';
import { Select } from '@/components/ui/custom/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import { FC, useState } from 'react';

export const ColumnList: FC = () => {
  const [columns, setColumns] = useState([
    { id: 'a', text: 'a' },
    { id: 'b', text: 'b' },
    { id: 'c', text: 'c' },
    { id: 'd', text: 'd' },
    { id: 'e', text: 'e' },
    { id: 'f', text: 'f' },
    { id: 'g', text: 'g' },
    { id: 'h', text: 'h' },
    { id: 'i', text: 'i' },
  ]);

  return (
    <ScrollArea className="h-full p-3 border rounded-md bg-gray-100">
      <div className="flex flex-col gap-3">
        <ReorderList
          items={columns}
          onReorder={setColumns}
          renderItem={(
            item,
            {
              dragHandleAttributes,
              dragHandleListeners,
              isOverlay,
              isPlaceholder,
              ref,
              style,
            },
          ) => (
            <Card
              className={cn('border-green-600 ring-green-600 border-l-8', {
                'opacity-30': isPlaceholder,
                'ring-2': isOverlay,
              })}
              ref={ref}
              style={style}
            >
              <CardContent className="pl-4 pr-3 py-0 flex items-center gap-4">
                <div className="grow pt-1 pb-4">
                  <p className="font-semibold text-sm mb-1">{item.text}</p>
                  <Select options={[{ caption: 'a', value: 'a' }]} />
                </div>
                <Button
                  className={cn(
                    'h-5 w-5 p-0 hover:bg-inherit cursor-grab active:cursor-grabbing',
                    { 'focus-visible:ring-transparent': isPlaceholder },
                  )}
                  variant="ghost"
                  {...dragHandleAttributes}
                  {...dragHandleListeners}
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        />
      </div>
    </ScrollArea>
  );
};
