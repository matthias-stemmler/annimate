import { CorpusList } from '@/components/corpus-list';
import { ExportSection } from '@/components/export-section';
import { QueryInput } from '@/components/query-input';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { FC } from 'react';

export const Page: FC = () => (
  <div className="flex flex-col h-full">
    <header className="p-4">
      <h1>Title</h1>
    </header>

    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={30} minSize={25}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel
            className="px-3 pt-1 pb-4"
            defaultSize={50}
            minSize={25}
          >
            <QueryInput />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel className="p-3" defaultSize={50} minSize={25}>
            <CorpusList />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel className="px-3 pb-4" defaultSize={70} minSize={25}>
        <ExportSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);
