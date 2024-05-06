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
  TriangleAlert,
  X,
  XCircle,
} from 'lucide-react';
import {
  FC,
  Fragment,
  RefObject,
  useEffect,
  useId,
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
    <DialogContent className="max-w-[48rem]" noClose>
      <DialogHeader>
        <DialogTitle>Corpus import</DialogTitle>
      </DialogHeader>

      {/* Keep mounted to preserve state (including scroll position) */}
      <ImportStatusDisplay
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
                'cursor-pointer shadow-[0_0_0_1px] shadow-border rounded-md px-4 py-7 mb-4',
                {
                  'shadow-[0_0_0_2px] shadow-gray-400': option === 'none',
                },
              )}
              onClick={() => {
                setOption('none');
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <RadioGroupItem id={noneOptionId} value="none" />

                <Label
                  htmlFor={noneOptionId}
                  className="cursor-pointer text-md"
                >
                  Do not add to a set
                </Label>
              </div>

              <div className="flex flex-col ml-7 text-sm italic">
                The {result.corpusNames.length === 1 ? 'corpus' : 'corpora'}{' '}
                will be available under &ldquo;All corpora&rdquo; and can be
                added to a set later.
              </div>
            </div>

            <div
              className={cn(
                'cursor-pointer shadow-[0_0_0_1px] shadow-border rounded-md p-4 pb-6 mb-3',
                {
                  'shadow-[0_0_0_2px] shadow-gray-400': option === 'new',
                },
              )}
              onClick={() => {
                setOption('new');
              }}
            >
              <div className="flex items-center gap-3 mb-1">
                <RadioGroupItem id={newOptionId} className="peer" value="new" />

                <Label
                  htmlFor={newOptionId}
                  className="cursor-pointer grow text-md peer-disabled:opacity-50"
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

              <div className="flex flex-col gap-2 ml-7">
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
                'cursor-pointer shadow-[0_0_0_1px] shadow-border rounded-md p-4 pb-6 mb-4 text-md',
                {
                  'cursor-not-allowed': noSetsAvailable,
                  'shadow-[0_0_0_2px] shadow-gray-400': option === 'existing',
                },
              )}
              onClick={() => {
                !noSetsAvailable && setOption('existing');
              }}
            >
              <div className="flex items-center gap-3 mb-1">
                <RadioGroupItem
                  id={existingOptionId}
                  className="peer"
                  disabled={noSetsAvailable}
                  value="existing"
                />

                <Label
                  htmlFor={existingOptionId}
                  className="cursor-pointer text-md peer-disabled:opacity-50"
                >
                  Add to an existing set:
                </Label>
              </div>

              <div className="flex flex-col ml-7">
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

const ImportStatusDisplay: FC<ImportStatusDisplayProps> = ({
  active,
  cancelStatus,
  corporaStatus,
  messages,
  onCancelRequested,
  result,
}) => {
  const totalCorporaCount = corporaStatus?.length ?? 0;
  const finishedCorporaCount =
    corporaStatus?.filter((status) => status.type === 'finished').length ?? 0;
  const failedCorporaCount =
    corporaStatus?.filter(
      (status) => status.type === 'finished' && status.result.type === 'failed',
    ).length ?? 0;
  const progress =
    totalCorporaCount === 0 ? 0 : finishedCorporaCount / totalCorporaCount;

  const statusTabRef = useRef<HTMLButtonElement>(null);

  // Focus status tab when mounted to prevent cancel button from being focused first
  useEffect(() => {
    statusTabRef.current?.focus();
  }, [statusTabRef]);

  return (
    <div hidden={!active}>
      <div className="flex items-end gap-8 mb-4">
        <div className="grow">
          <div className="flex justify-between mb-1">
            <p className="w-0 grow-[2] truncate">
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
              <p className="w-0 grow truncate text-right text-destructive">
                {failedCorporaCount} not imported
              </p>
            )}
          </div>

          <Progress value={Math.round(progress * 100)} />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 p-0"
              disabled={cancelStatus !== 'enabled'}
              onClick={onCancelRequested}
              variant="destructive"
            >
              {cancelStatus === 'pending' ? (
                <Hourglass className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>

          <TooltipContent>Stop import</TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="status">
        <TabsList className="w-full grid grid-cols-2 mb-2">
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
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import stopped</AlertTitle>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
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
          className="data-[state=inactive]:invisible -mt-80"
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
      <div className="w-full h-80 border rounded-md text-gray-500 flex justify-center items-center px-4">
        No importable corpora found
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="w-0 flex-1">
        <ScrollArea className="h-80 border rounded-md p-3">
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
          className="flex-1 w-0 flex justify-between items-center pl-2 h-8"
          variant="ghost"
        >
          <div className="flex-1 w-0 flex text-left">
            <span className="truncate">
              {corpusStatus.type === 'finished' &&
              corpusStatus.result.type === 'imported'
                ? corpusStatus.result.corpus.importedName
                : corpusStatus.importCorpus.fileName}
            </span>

            {corpusStatus.type === 'finished' &&
              corpusStatus.result.type === 'imported' &&
              corpusStatus.result.corpus.conflictingName && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger
                    asChild
                    className="outline-none"
                    tabIndex={-1}
                  >
                    <TriangleAlert className="h-4 w-4 ml-2 inline fill-yellow-200 dark:text-yellow-800" />
                  </TooltipTrigger>

                  <TooltipContent className="max-w-[80vw]">
                    Corpus with name &ldquo;
                    {corpusStatus.result.corpus.conflictingName}
                    &rdquo; already existed
                  </TooltipContent>
                </Tooltip>
              )}
          </div>

          <ChevronsUpDown className="h-4 w-4 ml-2" />
        </Button>
      </CollapsibleTrigger>
    </div>

    <CollapsibleContent className="text-sm px-8 my-1">
      {corpusStatus.type === 'finished' &&
        corpusStatus.result.type === 'failed' &&
        !corpusStatus.result.cancelled && (
          <div className="w-full flex my-1">
            <p className="w-0 overflow-hidden flex-1 text-destructive">
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
      <TooltipTrigger className="outline-none" tabIndex={-1}>
        {corpusStatus.result.cancelled ? (
          <CircleMinus className="h-6 w-6 fill-destructive text-white" />
        ) : (
          <XCircle className="h-6 w-6 fill-destructive text-white" />
        )}
      </TooltipTrigger>

      <TooltipContent className="max-w-[80vw]">
        <p className="text-destructive">{corpusStatus.result.message}</p>
      </TooltipContent>
    </Tooltip>
  ) : (
    {
      idle: <div className="h-4 w-4 mx-1" />,
      pending: <Spinner className="h-4 w-4 mx-1" />,
      finished: <CheckCircle2 className="h-6 w-6 fill-green-700 text-white" />,
    }[corpusStatus.type]
  );

type CorpusTraceDisplayProps = {
  trace: FilesystemEntity[];
};

const CorpusTraceDisplay: FC<CorpusTraceDisplayProps> = ({ trace }) => (
  <ScrollArea
    className="w-full border rounded-md p-1 pb-2"
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
              archive: <Package className="h-4 w-4" />,
              GraphML: <File className="h-4 w-4" />,
              RelANNIS: <Folder className="h-4 w-4" />,
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
      <div className="w-0 flex-1 relative">
        <ScrollArea
          className="h-80 border rounded-md p-3"
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
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const isScrolledToBottom = (viewportRef: RefObject<HTMLDivElement>) => {
  const viewport = viewportRef.current;
  return (
    viewport !== null &&
    viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight
  );
};

const scrollToBottom = (viewportRef: RefObject<HTMLDivElement>) => {
  const viewport = viewportRef.current;
  if (viewport !== null) {
    viewport.scrollTop = viewport.scrollHeight;
  }
};
