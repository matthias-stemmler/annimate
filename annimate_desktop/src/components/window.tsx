import { AboutDialog } from '@/components/dialogs/about-dialog';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { exit } from '@/lib/api';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';

export const Window: FC = () => (
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

    <Outlet />
  </div>
);
