import { AboutDialog } from '@/components/about-dialog';
import { CorpusList } from '@/components/corpus-list';
import { ExportSection } from '@/components/export-section';
import { QueryInput } from '@/components/query-input';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { exit } from '@/lib/api';
import { FC } from 'react';

export const Page: FC = () => (
  <div className="flex flex-col h-full">
    <Dialog>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>

          <MenubarContent>
            <MenubarItem
              onClick={() => {
                exit(0);
              }}
            >
              Quit
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>

          <MenubarContent>
            <DialogTrigger asChild>
              <MenubarItem>About</MenubarItem>
            </DialogTrigger>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <AboutDialog />
    </Dialog>

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
  </div>
);
