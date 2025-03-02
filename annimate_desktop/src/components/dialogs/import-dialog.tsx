import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Select } from '@/components/ui/custom/select';
import { Spinner } from '@/components/ui/custom/spinner';
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FilesystemEntity } from '@/lib/api-types';
import {
  ImportCorpusMessage,
  ImportCorpusStatus,
  ImportResult,
} from '@/lib/mutations';
import { useCorpusSets } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronsUpDown,
  CircleMinus,
  File,
  Folder,
  Hourglass,
  Package,
  X,
  XCircle,
} from 'lucide-react';
import {
  FC,
  Fragment,
  RefAttributes,
  RefObject,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type ImportDialogProps = {
  cancelStatus: CancelStatus;
  corporaStatus: ImportCorpusStatus[] | undefined;
  messages: ImportCorpusMessage[];
  onCancelRequested?: () => void;
  onConfirm?: (addToSet: string | undefined) => void;
  result: ImportResult | undefined;
};

export type CancelStatus = 'pending' | 'enabled' | 'disabled';

export const ImportDialog: FC<ImportDialogProps> = ({
  cancelStatus,
  corporaStatus,
  messages,
  onCancelRequested,
  onConfirm,
  result,
}) => {
  const [addToSetActive, setAddToSetActive] = useState(false);
  const [option, setOption] = useState('none');
  const [newSet, setNewSet] = useState<string>('');
  const [existingSet, setExistingSet] = useState<string | undefined>();

  const importStatusDisplayRef = useRef<ImportStatusDisplayRef>(null);
  const noneOptionId = useId();
  const newOptionId = useId();
  const existingOptionId = useId();

  const {
    data: corpusSets,
    error: corpusSetsError,
    isPending: isCorpusSetsPending,
  } = useCorpusSets();

  if (corpusSetsError !== null) {
    throw new Error(`Failed to load corpora: ${corpusSetsError.message}`);
  }

  const importPending = result === undefined;
  const canAddToSet =
    !importPending &&
    result.type === 'imported' &&
    result.corpusNames.length > 0;
  const noSetsAvailable = (corpusSets ?? []).length === 0;

  const addToSet =
    option === 'new' ? newSet : option === 'existing' ? existingSet : undefined;
  const addToSetValid =
    option === 'none' ||
    (option === 'new' &&
      newSet !== '' &&
      corpusSets !== undefined &&
      !corpusSets?.includes(newSet)) ||
    (option === 'existing' && existingSet !== undefined);

  return (
    <DialogContent
      aria-describedby={undefined}
      className="max-w-[calc(min(64rem,80vw))]"
      noClose
      onOpenAutoFocus={(event) => {
        event.preventDefault();

        // Focus status display when opened to prevent cancel button from being focused first
        importStatusDisplayRef.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>Corpus import</DialogTitle>
      </DialogHeader>

      {/* Keep mounted to preserve state (including scroll position) */}
      <ImportStatusDisplay
        ref={importStatusDisplayRef}
        active={!addToSetActive}
        cancelStatus={cancelStatus}
        corporaStatus={corporaStatus}
        messages={messages}
        onCancelRequested={onCancelRequested}
        result={result}
      />

      {canAddToSet && addToSetActive && (
        <div>
          <p className="mt-1 mb-4">
            Add the{' '}
            {result.corpusNames.length === 1 ? (
              <>
                imported corpus{' '}
                <span className="mx-1">
                  &ldquo;{result.corpusNames[0]}&rdquo;
                </span>
              </>
            ) : (
              <>{result.corpusNames.length} imported corpora</>
            )}{' '}
            to a set?
          </p>

          <RadioGroup onValueChange={setOption} value={option}>
            <div
              className={cn(
                'shadow-border mb-4 rounded-md px-4 py-7 shadow-[0_0_0_1px]',
                {
                  'shadow-[0_0_0_2px] shadow-gray-400': option === 'none',
                },
              )}
              onClick={() => {
                setOption('none');
              }}
            >
              <div className="mb-2 flex items-center gap-3">
                <RadioGroupItem id={noneOptionId} value="none" />

                <Label htmlFor={noneOptionId} className="text-md">
                  Do not add to a set
                </Label>
              </div>

              <div className="ml-7 flex flex-col text-sm italic">
                The {result.corpusNames.length === 1 ? 'corpus' : 'corpora'}{' '}
                will be available under &ldquo;All corpora&rdquo; and can be
                added to a set later.
              </div>
            </div>

            <div
              className={cn(
                'shadow-border mb-3 rounded-md p-4 pb-6 shadow-[0_0_0_1px]',
                {
                  'shadow-[0_0_0_2px] shadow-gray-400': option === 'new',
                },
              )}
              onClick={() => {
                setOption('new');
              }}
            >
              <div className="mb-1 flex items-center gap-3">
                <RadioGroupItem id={newOptionId} className="peer" value="new" />

                <Label
                  htmlFor={newOptionId}
                  className="text-md grow peer-disabled:opacity-50"
                >
                  Add to a new set:
                </Label>

                {option === 'new' &&
                  newSet !== '' &&
                  corpusSets?.includes(newSet) && (
                    <div className="text-destructive peer-disabled:opacity-50">
                      This set already exists. Add to the existing set?{' '}
                      <Button
                        className="h-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExistingSet(newSet);
                          setNewSet('');
                          setOption('existing');
                        }}
                        tabIndex={option === 'new' ? 0 : -1}
                        variant="link"
                      >
                        Yes
                      </Button>
                    </div>
                  )}
              </div>

              <div className="ml-7 flex flex-col gap-2">
                <Input
                  className="disabled:pointer-events-none"
                  disabled={option !== 'new'}
                  maxLength={64}
                  onChange={(event) => {
                    setNewSet(event.target.value);
                  }}
                  placeholder="Choose a name"
                  tabIndex={option === 'new' ? 0 : -1}
                  value={newSet}
                />
              </div>
            </div>

            <div
              className={cn(
                'text-md shadow-border mb-4 rounded-md p-4 pb-6 shadow-[0_0_0_1px]',
                {
                  'cursor-not-allowed': noSetsAvailable,
                  'shadow-[0_0_0_2px] shadow-gray-400': option === 'existing',
                },
              )}
              onClick={() => {
                if (!noSetsAvailable) {
                  setOption('existing');
                }
              }}
            >
              <div className="mb-1 flex items-center gap-3">
                <RadioGroupItem
                  id={existingOptionId}
                  className="peer"
                  disabled={noSetsAvailable}
                  value="existing"
                />

                <Label
                  htmlFor={existingOptionId}
                  className="text-md peer-disabled:opacity-50"
                >
                  Add to an existing set:
                </Label>
              </div>

              <div className="ml-7 flex flex-col">
                <Select
                  className="disabled:pointer-events-none"
                  disabled={option !== 'existing'}
                  loading={isCorpusSetsPending}
                  onChange={(value) => {
                    setExistingSet(value.slice(1));
                  }}
                  options={
                    corpusSets?.map((s) => ({
                      caption: s,
                      value: `:${s}`,
                    })) ?? []
                  }
                  tabIndex={option === 'existing' ? 0 : -1}
                  value={
                    existingSet === undefined ? undefined : `:${existingSet}`
                  }
                />
              </div>
            </div>
          </RadioGroup>
        </div>
      )}

      <DialogFooter>
        {addToSetActive ? (
          <Fragment key="add-to-set-buttons">
            <Button
              className="min-w-32"
              onClick={() => {
                setAddToSetActive(false);
              }}
              variant="secondary"
            >
              Back
            </Button>

            <Button
              className="min-w-32"
              disabled={!addToSetValid}
              onClick={() => {
                onConfirm?.(addToSet);
              }}
            >
              OK
            </Button>
          </Fragment>
        ) : (
          <Fragment key="status-buttons">
            <Button
              className="min-w-32"
              disabled={importPending}
              onClick={() => {
                if (canAddToSet) {
                  setAddToSetActive(true);
                } else {
                  onConfirm?.(undefined);
                }
              }}
              variant="secondary"
            >
              {importPending
                ? 'Please wait'
                : canAddToSet
                  ? 'Continue'
                  : 'Close'}
            </Button>
          </Fragment>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

type ImportStatusDisplayProps = {
  active: boolean;
  cancelStatus: CancelStatus;
  corporaStatus: ImportCorpusStatus[] | undefined;
  messages: ImportCorpusMessage[];
  onCancelRequested?: () => void;
  result: ImportResult | undefined;
};

type ImportStatusDisplayRef = {
  focus: () => void;
};

const ImportStatusDisplay: FC<
  ImportStatusDisplayProps & RefAttributes<ImportStatusDisplayRef>
> = ({
  active,
  cancelStatus,
  corporaStatus,
  messages,
  onCancelRequested,
  ref,
  result,
}) => {
  const statusTabRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => statusTabRef.current?.focus(),
  }));

  const totalCorporaCount = corporaStatus?.length ?? 0;
  const finishedCorporaCount =
    corporaStatus?.filter((status) => status.type === 'finished').length ?? 0;
  const failedCorporaCount =
    corporaStatus?.filter(
      (status) => status.type === 'finished' && status.result.type === 'failed',
    ).length ?? 0;
  const progress =
    totalCorporaCount === 0 ? 0 : finishedCorporaCount / totalCorporaCount;

  return (
    <div hidden={!active}>
      <div className="mb-4 flex items-end gap-8">
        <div className="grow">
          <div className="mb-1 flex justify-between">
            <p className="w-0 grow-2 truncate">
              {(() => {
                if (result?.type === 'failed') {
                  return result.cancelled ? 'Stopped' : 'Failed';
                }

                if (corporaStatus !== undefined) {
                  return `Processed ${finishedCorporaCount}${totalCorporaCount === 0 ? '' : ` of ${totalCorporaCount}`} corpora`;
                }

                return cancelStatus === 'pending'
                  ? 'Stopping ...'
                  : 'Collecting corpora ...';
              })()}
            </p>

            {failedCorporaCount > 0 && (
              <p className="text-destructive w-0 grow truncate text-right">
                {failedCorporaCount} not imported
              </p>
            )}
          </div>

          <Progress value={Math.round(progress * 100)} />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="size-8 p-0"
              disabled={cancelStatus !== 'enabled'}
              onClick={onCancelRequested}
              variant="destructive"
            >
              {cancelStatus === 'pending' ? (
                <Hourglass className="size-4" />
              ) : (
                <X className="size-4" />
              )}
            </Button>
          </TooltipTrigger>

          <TooltipContent>Stop import</TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="status">
        <TabsList className="mb-2 grid w-full grid-cols-2">
          <TabsTrigger ref={statusTabRef} value="status">
            Status
          </TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        {/* Keep tabs mounted to preserve state (including scroll position) when switching tabs */}
        <TabsContent
          className="data-[state=inactive]:invisible"
          forceMount
          tabIndex={-1}
          value="status"
        >
          {result?.type === 'failed' ? (
            <div className="h-80">
              {result.cancelled ? (
                <Alert>
                  <AlertCircle className="size-4" />
                  <AlertTitle>Import stopped</AlertTitle>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Import failed</AlertTitle>

                  <AlertDescription>
                    <p>{result.message}</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <CorporaStatusDisplay corporaStatus={corporaStatus} />
          )}
        </TabsContent>

        <TabsContent
          // Use `visibility: hidden` instead of `display: none`
          // because WebKit would otherwise reset the scroll position
          className="-mt-80 data-[state=inactive]:invisible"
          forceMount
          tabIndex={-1}
          value="messages"
        >
          <MessagesDisplay messages={messages} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

type CorporaStatusDisplayProps = {
  corporaStatus: ImportCorpusStatus[] | undefined;
};

const CorporaStatusDisplay: FC<CorporaStatusDisplayProps> = ({
  corporaStatus,
}) => {
  if (corporaStatus?.length === 0) {
    return (
      <div className="flex h-80 w-full items-center justify-center rounded-md border px-4 text-gray-500">
        No importable corpora found
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="w-0 flex-1">
        <ScrollArea className="h-80 rounded-md border p-3">
          <div className="mt-1 mr-1">
            {(corporaStatus ?? []).map((corpusStatus, index) => (
              <CorpusStatusDisplay key={index} corpusStatus={corpusStatus} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

type CorpusStatusDisplayProps = {
  corpusStatus: ImportCorpusStatus;
};

const CorpusStatusDisplay: FC<CorpusStatusDisplayProps> = ({
  corpusStatus,
}) => (
  <Collapsible className="w-full">
    <div className="flex items-center gap-2">
      <CorpusStatusIcon corpusStatus={corpusStatus} />

      <CollapsibleTrigger asChild>
        <Button
          className="flex h-8 w-0 flex-1 items-center justify-between pl-2"
          variant="ghost"
        >
          <div className="flex w-0 flex-1 text-left">
            <span className="truncate">
              {corpusStatus.type === 'finished' &&
              corpusStatus.result.type === 'imported'
                ? corpusStatus.result.name
                : corpusStatus.importCorpus.fileName}
            </span>
          </div>

          <ChevronsUpDown className="ml-2 size-4" />
        </Button>
      </CollapsibleTrigger>
    </div>

    <CollapsibleContent className="my-1 px-8 text-sm">
      {corpusStatus.type === 'finished' &&
        corpusStatus.result.type === 'failed' &&
        !corpusStatus.result.cancelled && (
          <div className="my-1 flex w-full">
            <p className="text-destructive w-0 flex-1 overflow-hidden">
              {corpusStatus.result.message}
            </p>
          </div>
        )}
      <CorpusTraceDisplay trace={corpusStatus.importCorpus.trace} />
    </CollapsibleContent>
  </Collapsible>
);

type CorpusStatusIconProps = {
  corpusStatus: ImportCorpusStatus;
};

const CorpusStatusIcon: FC<CorpusStatusIconProps> = ({ corpusStatus }) =>
  corpusStatus.type === 'finished' && corpusStatus.result.type === 'failed' ? (
    <Tooltip delayDuration={0}>
      <TooltipTrigger className="outline-hidden" tabIndex={-1}>
        {corpusStatus.result.cancelled ? (
          <CircleMinus className="fill-destructive size-6 text-white" />
        ) : (
          <XCircle className="fill-destructive size-6 text-white" />
        )}
      </TooltipTrigger>

      <TooltipContent className="max-w-[80vw]">
        <p className="text-destructive">{corpusStatus.result.message}</p>
      </TooltipContent>
    </Tooltip>
  ) : (
    {
      idle: <div className="mx-1 size-4" />,
      pending: <Spinner className="mx-1 size-4" />,
      finished: <CheckCircle2 className="size-6 fill-green-700 text-white" />,
    }[corpusStatus.type]
  );

type CorpusTraceDisplayProps = {
  trace: FilesystemEntity[];
};

const CorpusTraceDisplay: FC<CorpusTraceDisplayProps> = ({ trace }) => (
  <ScrollArea
    className="w-full rounded-md border p-1 pb-2"
    orientation="horizontal"
  >
    <div className="flex flex-col gap-1">
      {trace.map(({ kind, path }, index) => (
        <div
          key={index}
          className="flex gap-2"
          style={{ marginLeft: `${index * 1.5}rem` }}
        >
          {
            {
              archive: <Package className="size-4" />,
              GraphML: <File className="size-4" />,
              RelANNIS: <Folder className="size-4" />,
            }[kind.type === 'corpus' ? kind.format : kind.type]
          }
          <div className="w-0 whitespace-nowrap">{path}</div>
        </div>
      ))}
    </div>
  </ScrollArea>
);

type MessagesDisplayProps = {
  messages: ImportCorpusMessage[];
};

const MessagesDisplay: FC<MessagesDisplayProps> = ({ messages }) => {
  const [autoscroll, setAutoscroll] = useState(true);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoscroll) {
      scrollToBottom(scrollAreaViewportRef);
    }
  }, [autoscroll, messages, scrollAreaViewportRef]);

  useEffect(() => {
    if (!isScrolledToBottom(scrollAreaViewportRef)) {
      setHasUnreadMessages(true);
    }
  }, [messages, scrollAreaViewportRef]);

  return (
    <div className="flex">
      <div className="relative w-0 flex-1">
        <ScrollArea
          className="h-80 rounded-md border p-3"
          onScroll={() => {
            if (isScrolledToBottom(scrollAreaViewportRef)) {
              setAutoscroll(true);
              setHasUnreadMessages(false);
            } else {
              setAutoscroll(false);
            }
          }}
          orientation="both"
          viewportRef={scrollAreaViewportRef}
        >
          <div className="mt-1 mr-1 text-sm">
            {Array.from(
              (function* () {
                let currentIndex = undefined;

                for (const { id, index, message } of messages) {
                  if (index !== currentIndex) {
                    if (currentIndex !== undefined) {
                      yield (
                        <Separator
                          key={`separator-${index}`}
                          className="my-2"
                        />
                      );
                    }

                    currentIndex = index;
                  }

                  yield (
                    <div key={`message-${id}`} className="whitespace-nowrap">
                      {message}
                    </div>
                  );
                }
              })(),
            )}
          </div>
        </ScrollArea>

        {autoscroll ? null : (
          <Button
            className={cn('absolute right-3 bottom-3 rounded-full', {
              'animate-pulse': hasUnreadMessages,
            })}
            onClick={() => {
              scrollToBottom(scrollAreaViewportRef);
            }}
            size="icon"
            variant="secondary"
          >
            <ArrowDown className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const isScrolledToBottom = (viewportRef: RefObject<HTMLDivElement | null>) => {
  const viewport = viewportRef.current;
  return (
    viewport !== null &&
    viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight
  );
};

const scrollToBottom = (viewportRef: RefObject<HTMLDivElement | null>) => {
  const viewport = viewportRef.current;
  if (viewport !== null) {
    viewport.scrollTop = viewport.scrollHeight;
  }
};
