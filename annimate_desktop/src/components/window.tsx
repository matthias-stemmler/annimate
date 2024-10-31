import { AboutDialog } from '@/components/dialogs/about-dialog';
import { useDialogState } from '@/components/dialogs/use-dialog-state';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { UpdateAppTrigger } from '@/components/update-app-trigger';
import { exit, shellOpen } from '@/lib/api';
import { ExternalLink } from 'lucide-react';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';

export const Window: FC = () => {
  const [aboutDialogOpen, setAboutDialogOpen, aboutDialogKey] =
    useDialogState();

  return (
    <div className="flex h-full flex-col">
      {window.__ANNIMATE__.updateEnabled && <UpdateAppTrigger />}

      <Dialog onOpenChange={setAboutDialogOpen} open={aboutDialogOpen}>
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
              <MenubarItem
                onSelect={() => {
                  shellOpen(
                    'https://korpling.github.io/ANNIS/4.0/user-guide/aql/operators.html',
                  );
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                AQL operator reference
              </MenubarItem>

              <MenubarSeparator />

              <DialogTrigger asChild>
                <MenubarItem>About</MenubarItem>
              </DialogTrigger>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <AboutDialog key={aboutDialogKey} />
      </Dialog>

      <Outlet />
    </div>
  );
};
