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
import { documentDir, exit, open, openUrl, save } from '@/lib/api';
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
  const { dismiss: dismissToast, toast } = useToast();

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
                    defaultPath: await documentDir(),
                    filters: PROJECT_FILTERS,
                    title: 'Load project',
                  });

                  if (inputFile !== null) {
                    dismissToast();

                    loadProject(
                      { inputFile },
                      {
                        onSuccess: (result) => {
                          if (result.missingCorpusNames.length > 0) {
                            const [firstCorpusName, ...restCorpusNames] =
                              result.missingCorpusNames;

                            toast({
                              description: (
                                <>
                                  <p className="mb-1 line-clamp-6">
                                    Project was loaded, but corpus &ldquo;
                                    {firstCorpusName}&rdquo;{' '}
                                    {restCorpusNames.length > 0 && (
                                      <>
                                        and {restCorpusNames.length} other{' '}
                                        {restCorpusNames.length > 1
                                          ? 'corpora'
                                          : 'corpus'}{' '}
                                      </>
                                    )}
                                    {result.corpusSet !== '' && (
                                      <>
                                        from set &ldquo;{result.corpusSet}
                                        &rdquo;{' '}
                                      </>
                                    )}
                                    {restCorpusNames.length > 0
                                      ? 'are'
                                      : 'is'}{' '}
                                    missing.
                                  </p>

                                  <p>
                                    Make sure that all of the project's corpora
                                    are imported, then load the project again.
                                  </p>
                                </>
                              ),
                              duration: 15000,
                              title: 'Project partially loaded',
                              variant: 'warning',
                            });
                          }
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
                    defaultPath: await documentDir(),
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
