import { AllCorporaList } from '@/components/manage-page/all-corpora-list';
import { CorporaInSetList } from '@/components/manage-page/corpora-in-set-list';
import { CorpusSetList } from '@/components/manage-page/corpus-set-list';
import { Spinner } from '@/components/ui/custom/spinner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useCorpora } from '@/lib/store';
import { FC } from 'react';

export type CorporaSectionProps = {
  onSelectCorpusSet?: (corpusSet: string | undefined) => void;
  selectedCorpusSet: string | undefined;
};

export const CorporaSection: FC<CorporaSectionProps> = (props) => {
  const { data: corporaData, error, isPending } = useCorpora();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error.message}`);
  }

  if (isPending) {
    return <Spinner className="m-3" />;
  }

  const { corpora, sets } = corporaData;
  const selectedCorpusSet =
    props.selectedCorpusSet !== undefined &&
    sets.includes(props.selectedCorpusSet)
      ? props.selectedCorpusSet
      : undefined;

  const corpusNames = corpora.map((c) => c.name);
  const corpusSetsWithCount = sets.map((corpusSet) => ({
    corpusSet,
    corpusCount: corpora.filter((c) => c.includedInSets.includes(corpusSet))
      .length,
  }));

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="p-3" defaultSize={50} minSize={30}>
        <CorpusSetList
          corpusCount={corpora.length}
          corpusSetsWithCount={corpusSetsWithCount}
          onSelectCorpusSet={props.onSelectCorpusSet}
          selectedCorpusSet={selectedCorpusSet}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel className="p-3" defaultSize={50} minSize={30}>
        {selectedCorpusSet === undefined ? (
          <AllCorporaList corpusNames={corpusNames} />
        ) : (
          <CorporaInSetList corpora={corpora} corpusSet={selectedCorpusSet} />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
