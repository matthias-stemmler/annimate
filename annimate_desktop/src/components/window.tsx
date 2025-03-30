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
import { useToast } from '@/components/ui/use-toast';
import { UpdateAppTrigger } from '@/components/update-app-trigger';
import { exit, open, openUrl, save } from '@/lib/api';
import { useIsExporting } from '@/lib/mutations';
import { useLoadProject, useSaveProject } from '@/lib/store';
import { URL_ANNIMATE_USER_GUIDE, URL_AQL_OPERATORS } from '@/lib/urls';
import { ExternalLink } from 'lucide-react';
import { FC, useEffect } from 'react';
import { Outlet } from 'react-router';

const PROJECT_FILTERS = [
  {
    name: 'Annimate project (*.anmt)',
    extensions: ['anmt'],
  },
  {
    name: 'All files',
    extensions: ['*'],
  },
];

export const Window: FC = () => {
  const {
    mutation: { mutate: loadProject },
  } = useLoadProject();
  const {
    mutation: { mutate: saveProject },
  } = useSaveProject();
  const isExporting = useIsExporting();

  const [aboutDialogOpen, setAboutDialogOpen, aboutDialogKey] =
    useDialogState();
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'F1') {
        openUrl(URL_ANNIMATE_USER_GUIDE);
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
                disabled={isExporting}
                onSelect={async () => {
                  const inputFile = await open({
                    filters: PROJECT_FILTERS,
                    title: 'Load project',
                  });

                  if (inputFile !== null) {
                    loadProject(
                      { inputFile },
                      {
                        onSuccess: (result) => {
                          // TODO show yellow toast if result says project was not fully loaded
                        },
                        onError: (error: Error) => {
                          toast({
                            description: error.message,
                            duration: 15000,
                            title: 'Failed to load project',
                            variant: 'destructive',
                          });
                        },
                      },
                    );
                  }
                }}
              >
                Load project
              </MenubarItem>

              <MenubarItem
                onSelect={async () => {
                  const outputFile = await save({
                    filters: PROJECT_FILTERS,
                    title: 'Save project',
                  });

                  if (outputFile !== null) {
                    saveProject(
                      { outputFile },
                      {
                        onError: (error: Error) => {
                          toast({
                            description: error.message,
                            duration: 15000,
                            title: 'Failed to save project',
                            variant: 'destructive',
                          });
                        },
                      },
                    );
                  }
                }}
              >
                Save project as &hellip;
              </MenubarItem>

              <MenubarSeparator />

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
                  openUrl(URL_ANNIMATE_USER_GUIDE);
                }}
              >
                <ExternalLink className="mr-2 size-4" />
                User Guide
                <MenubarShortcut>F1</MenubarShortcut>
              </MenubarItem>

              <MenubarItem
                onSelect={() => {
                  openUrl(URL_AQL_OPERATORS);
                }}
              >
                <ExternalLink className="mr-2 size-4" />
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
