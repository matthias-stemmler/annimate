import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Textarea } from '@/components/ui/textarea';
import { FC } from 'react';
import { CorpusList } from './corpus-list';

export const Page: FC = () => (
  <div className="flex flex-col h-full">
    <header className="p-4">
      <h1>Title</h1>
    </header>

    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel minSize={10}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel className="p-2" minSize={10}>
            <Textarea className="font-mono" />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel className="p-2" minSize={10}>
            <CorpusList />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel className="p-2" minSize={10}>
        Export
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);
