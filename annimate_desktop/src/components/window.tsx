import { AboutDialog } from '@/components/about-dialog';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { exit } from '@/lib/api';
import { FC } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export const Window: FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
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
            <MenubarTrigger>View</MenubarTrigger>

            <MenubarContent>
              <MenubarRadioGroup value={pathname}>
                <MenubarRadioItem
                  onClick={() => {
                    navigate('/', { replace: true });
                  }}
                  value="/"
                >
                  Export matches
                </MenubarRadioItem>
                <MenubarRadioItem
                  onClick={() => {
                    navigate('/manage', { replace: true });
                  }}
                  value="/manage"
                >
                  Manage corpora
                </MenubarRadioItem>
              </MenubarRadioGroup>
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
};
