import { AboutDialog } from '@/components/dialogs/about-dialog';
import { useDialogState } from '@/components/dialogs/use-dialog-state';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { UpdateAppTrigger } from '@/components/update-app-trigger';
import { exit, shellOpen } from '@/lib/api';
import { URL_ANNIMATE_USER_GUIDE, URL_AQL_OPERATORS } from '@/lib/urls';
import { ExternalLink } from 'lucide-react';
import { FC, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export const Window: FC = () => {
  const [aboutDialogOpen, setAboutDialogOpen, aboutDialogKey] =
    useDialogState();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'F1') {
        shellOpen(URL_ANNIMATE_USER_GUIDE);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

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
                  shellOpen(URL_ANNIMATE_USER_GUIDE);
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                User Guide
                <MenubarShortcut>F1</MenubarShortcut>
              </MenubarItem>

              <MenubarItem
                onSelect={() => {
                  shellOpen(URL_AQL_OPERATORS);
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                AQL Operators
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
