import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReorderList } from '@/components/ui/custom/reorder-list';
import { Select } from '@/components/ui/custom/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { useClientState } from '@/lib/client-state-context';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2 } from 'lucide-react';
import { FC } from 'react';

export const ExportColumnList: FC = () => {
  const {
    exportColumns,
    removeExportColumn,
    reorderExportColumns,
    unremoveExportColumn,
  } = useClientState();
  const { toast } = useToast();

  return (
    <div className="h-full pt-1 flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <Label className="mr-2 mb-2">Columns</Label>
        <Button variant="outline">Add column</Button>
      </div>

      <ScrollArea className="h-full p-3 border rounded-md bg-gray-100">
        <div className="flex flex-col gap-3">
          <ReorderList
            items={exportColumns}
            onReorder={reorderExportColumns}
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
                className={cn('border-0 border-l-8 shadow-md', {
                  'border-column-number-600 ring-column-number-600':
                    item.type === 'number',
                  'border-column-anno-corpus-600 ring-column-anno-corpus-600':
                    item.type === 'anno_corpus',
                  'border-column-anno-document-600 ring-column-anno-document-600':
                    item.type === 'anno_document',
                  'border-column-anno-match-600 ring-column-anno-match-600':
                    item.type === 'anno_match',
                  'border-column-match-in-context-600 ring-column-match-in-context-600':
                    item.type === 'match_in_context',
                  'opacity-30': isPlaceholder,
                  'ring-2': isOverlay,
                })}
                ref={ref}
                style={style}
              >
                <CardContent className="pl-4 pr-3 py-0 flex items-center gap-4">
                  <div className="grow pt-1 pb-4">
                    <p className="font-semibold text-sm mb-1">{item.type}</p>
                    <Select options={[{ caption: 'a', value: 'a' }]} />
                  </div>

                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            removeExportColumn(item.id);

                            toast({
                              action: (
                                <ToastAction
                                  altText="Undo"
                                  onClick={() => unremoveExportColumn(item.id)}
                                >
                                  Undo
                                </ToastAction>
                              ),
                              title: 'Column removed',
                            });
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>

                      <TooltipContent side="left">Remove column</TooltipContent>
                    </Tooltip>

                    <Button
                      className={cn(
                        'h-5 w-5 p-0 hover:bg-inherit cursor-grab active:cursor-grabbing',
                        { 'focus-visible:ring-transparent': isPlaceholder },
                      )}
                      disabled={exportColumns.length <= 1}
                      variant="ghost"
                      {...dragHandleAttributes}
                      {...dragHandleListeners}
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          />
        </div>
      </ScrollArea>
    </div>
  );
};
