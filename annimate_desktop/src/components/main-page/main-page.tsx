import { CorpusList } from '@/components/main-page/corpus-list';
import { ExportSection } from '@/components/main-page/export-section';
import { QueryInput } from '@/components/main-page/query-input';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useToast } from '@/components/ui/use-toast';
import { FC, useEffect } from 'react';

export const MainPage: FC = () => {
  const { dismiss: dismissToast } = useToast();
  useEffect(() => {
    dismissToast();
  }, [dismissToast]);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="pt-2" defaultSize={30} minSize={30}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel
            className="px-3 pt-1 pb-4"
            defaultSize={50}
            minSize={30}
          >
            <QueryInput />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel className="p-3" defaultSize={50} minSize={30}>
            <CorpusList />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel className="px-3 pt-2 pb-4" defaultSize={70} minSize={30}>
        <ExportSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
