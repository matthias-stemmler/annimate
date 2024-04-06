export {};

declare global {
  interface Window {
    __ANNIMATE__: {
      versionInfo: {
        annimateVersion: string;
        graphannisVersion: string;
      };
    };
  }
}
