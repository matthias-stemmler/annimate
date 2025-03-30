import { AnnoCorpusColumn } from '@/components/main-page/columns/anno-corpus-column';
import { AnnoDocumentColumn } from '@/components/main-page/columns/anno-document-column';
import { AnnoMatchColumn } from '@/components/main-page/columns/anno-match-column';
import { MatchInContextColumn } from '@/components/main-page/columns/match-in-context-column';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AutoScroller,
  useAutoScroller,
} from '@/components/ui/custom/auto-scroller';
import {
  ReorderList,
  ReorderListContext,
} from '@/components/ui/custom/reorder-list';
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
import { FC, PropsWithChildren, useEffect, useRef } from 'react';

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
  const reorderExportColumns = useReorderExportColumns();

  const isExporting = useIsExporting();
  const disabled = isExporting;
  const reorderDisabled = disabled || exportColumns.length <= 1;

  const autoScroller = useAutoScroller();

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-hidden pt-1 pr-1">
      <div className="flex items-end justify-between">
        <Label className="mr-2 mb-2">Columns</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={disabled} variant="outline">
              <Plus className="mr-2 size-4" /> Add column
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="mr-1">
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
        <div className="flex flex-1 items-center justify-center rounded-md border bg-gray-100 px-4 text-gray-500 dark:bg-gray-800">
          Please add a column to be exported.
        </div>
      ) : (
        <ScrollArea
          className="flex-1 rounded-md border bg-gray-100 p-3 dark:bg-gray-800"
          orientation="both"
          viewportRef={autoScroller.ref}
        >
          <div className="mb-1 flex flex-col gap-4">
            <ReorderList
              autoScroller={autoScroller}
              disabled={reorderDisabled}
              getId={getExportColumnId}
              idPrefix="export-columns"
              items={exportColumns}
              onReorder={(reorder) =>
                reorderExportColumns((items) =>
                  reorder(items, getExportColumnId),
                )
              }
              renderItem={(item, context) => (
                <ExportColumnListItem
                  autoScroller={autoScroller}
                  context={context}
                  disabled={disabled}
                  item={item}
                  reorderDisabled={reorderDisabled}
                />
              )}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

type ExportColumnListItemProps = {
  autoScroller?: AutoScroller;
  context: ReorderListContext;
  disabled: boolean;
  item: ExportColumnItem;
  reorderDisabled: boolean;
};

const ExportColumnListItem: FC<ExportColumnListItemProps> = ({
  autoScroller,
  context: {
    dragHandleAttributes,
    dragHandleListeners,
    isOverlay,
    isPlaceholder,
    ref: contextRef,
    style,
  },
  disabled,
  item,
  reorderDisabled,
}) => {
  const updateExportColumn = useUpdateExportColumn();
  const removeExportColumn = useRemoveExportColumn();

  const { toast } = useToast();

  const localRef = useRef<HTMLDivElement>(null);
  const scrolledIntoViewRef = useRef<boolean>(false);

  useEffect(() => {
    if (!scrolledIntoViewRef.current) {
      localRef.current?.scrollIntoView({ behavior: 'smooth' });
      scrolledIntoViewRef.current = true;
    }
  }, [localRef, scrolledIntoViewRef]);

  return (
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
        ring: isOverlay,
      })}
      ref={(ref) => {
        contextRef?.(ref);
        localRef.current = ref;
      }}
      style={style}
    >
      <CardContent className="flex items-center gap-4 py-0 pr-3 pl-4">
        <div className="flex grow flex-col gap-4 py-2">
          <p
            className={cn('cursor-default py-2 text-sm font-semibold', {
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
            })}
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
              autoScroller={autoScroller}
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
                    action: <UndoRemoveColumnAction columnId={item.id} />,
                    title: 'Column removed',
                  });
                }}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>

            <TooltipContent side="left">Remove column</TooltipContent>
          </Tooltip>

          <Button
            className={cn('size-5 cursor-grab p-0 hover:bg-inherit', {
              'focus-visible:ring-transparent': isPlaceholder,
              'cursor-grabbing': isOverlay || isPlaceholder,
            })}
            disabled={reorderDisabled}
            variant="ghost"
            {...dragHandleAttributes}
            {...dragHandleListeners}
          >
            <GripVertical className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
      className={cn('group-focus:bg-accent w-full border-l-8 shadow-md', {
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

type UndoRemoveColumnActionProps = {
  columnId: number;
};

const UndoRemoveColumnAction: FC<UndoRemoveColumnActionProps> = ({
  columnId,
}) => {
  const unremoveExportColumn = useUnremoveExportColumn();
  const isExporting = useIsExporting();

  return (
    <ToastAction
      altText="Undo"
      disabled={isExporting}
      onClick={() => unremoveExportColumn(columnId)}
    >
      Undo
    </ToastAction>
  );
};
