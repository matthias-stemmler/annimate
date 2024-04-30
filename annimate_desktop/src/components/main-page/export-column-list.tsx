import { AnnoCorpusColumn } from '@/components/main-page/columns/anno-corpus-column';
import { AnnoDocumentColumn } from '@/components/main-page/columns/anno-document-column';
import { AnnoMatchColumn } from '@/components/main-page/columns/anno-match-column';
import { MatchInContextColumn } from '@/components/main-page/columns/match-in-context-column';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReorderList } from '@/components/ui/custom/reorder-list';
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
import { ExportColumnType } from '@/lib/api-types';
import {
  ExportColumnItem,
  useAddExportColumn,
  useExportColumnItems,
  useIsExporting,
  useRemoveExportColumn,
  useReorderExportColumns,
  useUnremoveExportColumn,
  useUpdateExportColumn,
} from '@/lib/store';
import { cn } from '@/lib/utils';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { FC, PropsWithChildren } from 'react';

const COLUMN_TYPE_TO_NAME: Record<ExportColumnType, string> = {
  number: 'Number',
  anno_corpus: 'Corpus metadata',
  anno_document: 'Document metadata',
  anno_match: 'Match annotation',
  match_in_context: 'Match in context',
};

export const ExportColumnList: FC = () => {
  const exportColumns = useExportColumnItems();
  const addExportColumn = useAddExportColumn();
  const updateExportColumn = useUpdateExportColumn();
  const reorderExportColumns = useReorderExportColumns();
  const removeExportColumn = useRemoveExportColumn();
  const unremoveExportColumn = useUnremoveExportColumn();

  const isExporting = useIsExporting();
  const disabled = isExporting;
  const reorderDisabled = disabled || exportColumns.length <= 1;

  const { toast } = useToast();

  return (
    <div className="flex-1 overflow-hidden pt-1 pr-1 flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <Label className="mr-2 mb-2">Columns</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={disabled} variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Add column
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            {(
              [
                'anno_corpus',
                'anno_document',
                'anno_match',
                'match_in_context',
                'number',
              ] as const
            ).map((columnType: ExportColumnType) => (
              <CardMenuItem
                key={columnType}
                columnType={columnType}
                onClick={() => addExportColumn(columnType)}
              >
                {COLUMN_TYPE_TO_NAME[columnType]}
              </CardMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {exportColumns.length === 0 ? (
        <div className="border rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 flex-1 flex justify-center items-center px-4">
          Please add a column to be exported.
        </div>
      ) : (
        <ScrollArea
          className="flex-1 p-3 border rounded-md bg-gray-100 dark:bg-gray-800"
          orientation="both"
        >
          <div className="flex flex-col gap-4 mb-1">
            <ReorderList
              disabled={reorderDisabled}
              getId={getExportColumnId}
              idPrefix="export-columns"
              items={exportColumns}
              onReorder={(reorder) =>
                reorderExportColumns((items) =>
                  reorder(items, getExportColumnId),
                )
              }
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
                  className={cn('min-w-[36rem] border-0 border-l-8 shadow-md', {
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
                    <div className="grow py-2 flex flex-col gap-4">
                      <p
                        className={cn(
                          'font-semibold text-sm py-2 cursor-default',
                          {
                            'text-column-number-800 dark:text-column-number-600':
                              item.type === 'number',
                            'text-column-anno-corpus-800 dark:text-column-anno-corpus-600':
                              item.type === 'anno_corpus',
                            'text-column-anno-document-800 dark:text-column-anno-document-600':
                              item.type === 'anno_document',
                            'text-column-anno-match-800 dark:text-column-anno-match-600':
                              item.type === 'anno_match',
                            'text-column-match-in-context-800 dark:text-column-match-in-context-600':
                              item.type === 'match_in_context',
                            'cursor-grab': !reorderDisabled,
                            'cursor-grabbing': isOverlay || isPlaceholder,
                          },
                        )}
                        {...dragHandleAttributes}
                        {...dragHandleListeners}
                        tabIndex={-1}
                      >
                        {COLUMN_TYPE_TO_NAME[item.type]}
                      </p>
                      {item.type === 'anno_corpus' && (
                        <AnnoCorpusColumn
                          data={item}
                          onChange={(payload) =>
                            updateExportColumn(item.id, {
                              type: item.type,
                              payload,
                            })
                          }
                        />
                      )}
                      {item.type === 'anno_document' && (
                        <AnnoDocumentColumn
                          data={item}
                          onChange={(payload) =>
                            updateExportColumn(item.id, {
                              type: item.type,
                              payload,
                            })
                          }
                        />
                      )}
                      {item.type === 'anno_match' && (
                        <AnnoMatchColumn
                          data={item}
                          onChange={(payload) =>
                            updateExportColumn(item.id, {
                              type: item.type,
                              payload,
                            })
                          }
                        />
                      )}
                      {item.type === 'match_in_context' && (
                        <MatchInContextColumn
                          data={item}
                          onChange={(payload) =>
                            updateExportColumn(item.id, {
                              type: item.type,
                              payload,
                            })
                          }
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="text-destructive hover:text-destructive"
                            disabled={disabled}
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
                          'h-5 w-5 p-0 hover:bg-inherit cursor-grab',
                          {
                            'focus-visible:ring-transparent': isPlaceholder,
                            'cursor-grabbing': isOverlay || isPlaceholder,
                          },
                        )}
                        disabled={reorderDisabled}
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

const getExportColumnId = (exportColumn: ExportColumnItem): string =>
  `${exportColumn.id}`;

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
      <CardContent className="p-2">{children}</CardContent>
    </Card>
  </DropdownMenuItem>
);
