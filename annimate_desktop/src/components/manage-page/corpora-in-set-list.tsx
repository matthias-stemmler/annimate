import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Corpus } from '@/lib/api-types';
import { useToggleCorpusInSet } from '@/lib/store';
import { FC, useId } from 'react';

export type CorporaInSetListProps = {
  corpora: Corpus[];
  corpusSet: string;
};

export const CorporaInSetList: FC<CorporaInSetListProps> = ({
  corpora,
  corpusSet,
}) => (
  <div className="h-full flex flex-col gap-2">
    <Label className="truncate leading-5 mb-2">
      Corpora in set <span className="px-2">&ldquo;{corpusSet}&rdquo;</span>
    </Label>

    <div className="flex-1 border rounded-md overflow-hidden">
      {corpora.length === 0 ? (
        <p className="text-center text-muted-foreground mt-4">
          No corpora available
        </p>
      ) : (
        <ScrollArea className="h-full">
          <ScrollBar orientation="horizontal" />

          {corpora.map(({ name, includedInSets }) => (
            <CorporaInSetListItem
              key={name}
              checked={includedInSets.includes(corpusSet)}
              corpusName={name}
              corpusSet={corpusSet}
            />
          ))}
        </ScrollArea>
      )}
    </div>
  </div>
);

type CorporaInSetListItemProps = {
  checked: boolean;
  corpusName: string;
  corpusSet: string;
};

const CorporaInSetListItem: FC<CorporaInSetListItemProps> = ({
  checked,
  corpusName,
  corpusSet,
}) => {
  const id = useId();
  const {
    mutation: { mutate: toggleCorpusInSet },
  } = useToggleCorpusInSet();
  const { toast } = useToast();

  return (
    <Label
      htmlFor={id}
      className="group cursor-pointer flex items-center gap-2 shadow-[0_1px] shadow-gray-200 dark:shadow-gray-800 px-4 py-3"
    >
      <Checkbox
        id={id}
        aria-label={corpusName}
        checked={checked}
        onClick={() => {
          toggleCorpusInSet(
            { corpusSet, corpusName },
            {
              onError: (error: Error) => {
                toast({
                  className: 'break-all',
                  description: error.toString(),
                  duration: 15000,
                  title: 'Failed to toggle corpus',
                  variant: 'destructive',
                });
              },
            },
          );
        }}
      />
      <div className="h-6 w-0 flex-1 truncate leading-5 group-hover:underline underline-offset-4 translate-y-0.5">
        {corpusName}
      </div>
    </Label>
  );
};
