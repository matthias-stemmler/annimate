import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReorderList } from '@/components/ui/custom/reorder-list';
import { Select } from '@/components/ui/custom/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { ExportColumnType } from '@/lib/api';
import { useClientState } from '@/lib/client-state-context';
import { cn } from '@/lib/utils';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { FC, PropsWithChildren } from 'react';

export const ExportColumnList: FC = () => {
  const {
    addExportColumn,
    exportColumns,
    removeExportColumn,
    reorderExportColumns,
    unremoveExportColumn,
  } = useClientState();
  const { toast } = useToast();

  return (
    <div className="flex-1 overflow-hidden pt-1 flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <Label className="mr-2 mb-2">Columns</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Add column
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <CardMenuItem
              columnType="anno_corpus"
              onClick={() => addExportColumn('anno_corpus')}
            >
              Corpus metadata
            </CardMenuItem>
            <CardMenuItem
              columnType="anno_document"
              onClick={() => addExportColumn('anno_document')}
            >
              Document metadata
            </CardMenuItem>
            <CardMenuItem
              columnType="anno_match"
              onClick={() => addExportColumn('anno_match')}
            >
              Match annotation
            </CardMenuItem>
            <CardMenuItem
              columnType="match_in_context"
              onClick={() => addExportColumn('match_in_context')}
            >
              Match in context
            </CardMenuItem>
            <CardMenuItem
              columnType="number"
              onClick={() => addExportColumn('number')}
            >
              Number
            </CardMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {exportColumns.length === 0 ? (
        <div className="border rounded-md bg-gray-100 text-gray-500 flex-1 flex justify-center items-center">
          Please add a column to be exported.
        </div>
      ) : (
        <ScrollArea className="flex-1 p-3 border rounded-md bg-gray-100">
          <div className="flex flex-col gap-4 mb-1">
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
                        <TooltipTrigger asChild>
                          <Button
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              removeExportColumn(item.id);

                              toast({
                                action: (
                                  <ToastAction
                                    altText="Undo"
                                    onClick={() =>
                                      unremoveExportColumn(item.id)
                                    }
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

                        <TooltipContent side="left">
                          Remove column
                        </TooltipContent>
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
      )}
    </div>
  );
};

type CardMenuItemProps = PropsWithChildren<{
  columnType: ExportColumnType;
  onClick?: () => void;
}>;

const CardMenuItem: FC<CardMenuItemProps> = ({
  children,
  columnType,
  onClick,
}) => (
  <DropdownMenuItem className="group focus:bg-transparent" onClick={onClick}>
    <Card
      className={cn('w-full border-l-8 shadow-md group-focus:bg-accent', {
        'border-column-number-600': columnType === 'number',
        'border-column-anno-corpus-600': columnType === 'anno_corpus',
        'border-column-anno-document-600': columnType === 'anno_document',
        'border-column-anno-match-600': columnType === 'anno_match',
        'border-column-match-in-context-600': columnType === 'match_in_context',
      })}
    >
      <CardContent className="pl-2 py-1">{children}</CardContent>
    </Card>
  </DropdownMenuItem>
);
