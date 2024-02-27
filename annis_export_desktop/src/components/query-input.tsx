import { Select } from '@/components/ui/custom/select';
import { Spinner } from '@/components/ui/custom/spinner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LineColumnRange, QueryValidationResult } from '@/lib/api';
import { useIsExporting } from '@/lib/mutations';
import {
  useAqlQuery,
  useQueryLanguage,
  useQueryValidationResult,
  useSetAqlQuery,
  useSetQueryLanguage,
} from '@/lib/store';
import { cn, lineColumnToCharacterIndex } from '@/lib/utils';
import { AlertTriangle, CheckSquare2, XSquare } from 'lucide-react';
import { FC, useId, useRef } from 'react';

export const QueryInput: FC = () => {
  const aqlQuery = useAqlQuery();
  const queryLanguage = useQueryLanguage();
  const setAqlQuery = useSetAqlQuery();
  const setQueryLanguage = useSetQueryLanguage();

  const { data: validationResult, isFetching: validationIsFetching } =
    useQueryValidationResult();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  const textAreaId = useId();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const status = validationIsFetching ? 'validating' : validationResult?.type;
  const isValid = validationResult?.type === 'valid';
  const isInvalid = validationResult?.type === 'invalid';

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <Label className="mr-2 mb-2" htmlFor={textAreaId}>
          Query
        </Label>

        <Select
          disabled={disabled}
          onChange={setQueryLanguage}
          options={[
            { value: 'AQL', caption: 'AQL (latest)' },
            { value: 'AQLQuirksV3', caption: 'AQL (compatibility mode)' },
          ]}
          triggerClassName="w-[220px]"
          value={queryLanguage}
        />
      </div>

      <div className="relative grow">
        <Textarea
          className={cn(
            'font-mono h-full pr-9 resize-none focus:bg-background',
            {
              'bg-red-50': isInvalid,
            },
          )}
          disabled={disabled}
          id={textAreaId}
          onChange={(event) => setAqlQuery(event.target.value)}
          placeholder="Enter AQL query"
          ref={textAreaRef}
          value={aqlQuery}
        />

        {status !== undefined && (
          <Tooltip
            delayDuration={isValid ? undefined : 0}
            open={disabled ? false : undefined}
          >
            <TooltipTrigger
              className="absolute top-2 right-2 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={disabled}
              onMouseDown={(event) => {
                event?.preventDefault();

                if (isInvalid) {
                  if (validationResult.location !== null) {
                    const { start, end } = validationResult.location;
                    const selectionStart = lineColumnToCharacterIndex(
                      start.line,
                      start.column,
                      aqlQuery,
                    );

                    textAreaRef.current?.setSelectionRange(
                      selectionStart,
                      end === null
                        ? selectionStart
                        : lineColumnToCharacterIndex(
                            end.line,
                            end.column,
                            aqlQuery,
                          ) + 1,
                    );
                  }

                  textAreaRef.current?.focus();
                }
              }}
            >
              <StatusIcon status={status} />
            </TooltipTrigger>

            <TooltipContent className="max-w-[80vw]">
              <ValidationResultDisplay validationResult={validationResult} />
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

type StatusIconProps = {
  status: QueryValidationResult['type'] | 'validating';
};

const StatusIcon: FC<StatusIconProps> = ({ status }) => {
  const [Icon, className] = (
    {
      valid: [CheckSquare2, 'text-green-700'],
      invalid: [XSquare, 'text-destructive'],
      indeterminate: [AlertTriangle, 'text-orange-400'],
      validating: [Spinner],
    } as const
  )[status];

  return <Icon className={className} />;
};

type ValidationResultDisplayProps = {
  validationResult?: QueryValidationResult;
};

const ValidationResultDisplay: FC<ValidationResultDisplayProps> = ({
  validationResult,
}) => {
  if (validationResult === undefined) {
    return 'Validating query ...';
  }

  if (validationResult.type === 'valid') {
    return 'Query is valid.';
  }

  if (validationResult.type === 'indeterminate') {
    return 'Please select at least one corpus.';
  }

  return (
    <>
      {validationResult.location !== null && (
        <LocationDisplay location={validationResult.location} />
      )}

      {validationResult.desc}
    </>
  );
};

type LocationDisplayProps = {
  location: LineColumnRange;
};

const LocationDisplay: FC<LocationDisplayProps> = ({
  location: { start, end },
}) => (
  <p className="font-mono italic mr-4">
    {start.line}:{start.column}
    {end !== null && (
      <>
        -{end.line}:{end.column}
      </>
    )}
  </p>
);
