import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/custom/spinner';
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
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
import {
  AlertCircle,
  CheckCircle2,
  ChevronsUpDown,
  File,
  Folder,
  Package,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { FC } from 'react';

export type ImportDialogProps = {
  corporaStatus: ImportCorpusStatus[] | undefined;
  messages: ImportCorpusMessage[];
  onConfirm?: () => void;
  result: ImportResult | undefined;
};

export const ImportDialog: FC<ImportDialogProps> = ({
  corporaStatus,
  messages,
  onConfirm,
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

  return (
    <DialogContent className="max-w-[48rem]" noClose>
      <DialogHeader>
        <DialogTitle>Corpus import</DialogTitle>
      </DialogHeader>

      <div className="mb-1">
        <div className="flex justify-between mb-1">
          <p className="w-0 grow-[2] truncate">
            {result?.type === 'failed'
              ? 'Failed'
              : corporaStatus === undefined
                ? 'Collecting corpora ...'
                : `Processed ${finishedCorporaCount}${totalCorporaCount === 0 ? '' : ` of ${totalCorporaCount}`} corpora`}
          </p>

          {failedCorporaCount > 0 && (
            <p className="w-0 grow truncate text-right text-destructive">
              {failedCorporaCount} failed
            </p>
          )}
        </div>

        <Progress value={Math.round(progress * 100)} />
      </div>

      <Tabs defaultValue="status">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="status" tabIndex={-1}>
          {result?.type === 'failed' ? (
            <div className="h-80">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import failed</AlertTitle>

                <AlertDescription>
                  <p>{result.message}</p>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <CorporaStatusDisplay corporaStatus={corporaStatus} />
          )}
        </TabsContent>

        <TabsContent value="messages" tabIndex={-1}>
          <MessagesDisplay messages={messages} />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button
          className="min-w-32"
          disabled={result === undefined}
          onClick={onConfirm}
          variant="secondary"
        >
          {result === undefined ? 'Please wait' : 'Close'}
        </Button>
      </DialogFooter>
    </DialogContent>
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
        corpusStatus.result.type === 'failed' && (
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
      <TooltipTrigger asChild className="outline-none" tabIndex={-1}>
        <XCircle className="h-6 w-6 fill-destructive text-white" />
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

const MessagesDisplay: FC<MessagesDisplayProps> = ({ messages }) => (
  <div className="flex">
    <div className="w-0 flex-1">
      <ScrollArea className="h-80 border rounded-md p-3" orientation="both">
        <div className="mt-1 mr-1 text-sm">
          {Array.from(
            (function* () {
              let currentIndex = undefined;

              for (const { id, index, message } of messages) {
                if (index !== currentIndex) {
                  if (currentIndex !== undefined) {
                    yield (
                      <Separator key={`separator-${index}`} className="my-2" />
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
    </div>
  </div>
);
