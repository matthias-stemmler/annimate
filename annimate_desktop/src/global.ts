export {};

declare global {
  interface Window {
    __ANNIMATE__: {
      updateEnabled: boolean;
      versionInfo: {
        annimateVersion: string;
        graphannisVersion: string;
      };
    };
  }
}
