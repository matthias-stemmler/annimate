import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let cleanExit = false;
let tauriDriver: ChildProcess | undefined;

export const config: WebdriverIO.Config = {
  hostname: '127.0.0.1',
  port: 4444,
  specs: ['./tests/**/*.ts'],
  maxInstances: 1,
  capabilities: [
    {
      'wdio:maxInstances': 1,
      'tauri:options': {
        application: '../../target/debug/Annimate',
      },
    },
  ],
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  onPrepare: () => {
    const desktopDir = path.resolve(__dirname, '..');

    // Pretend old version to test the update mechanism
    // Note that the version shown in the About dialog is still taken from `Cargo.toml` via annimate_core
    const configFile = path.resolve(
      desktopDir,
      'src-tauri',
      'tauri.conf.webdriver.json',
    );

    const tauriCli = createRequire(
      path.resolve(desktopDir, 'package.json'),
    ).resolve('@tauri-apps/cli/tauri.js');

    const result = spawnSync(
      process.execPath,
      [tauriCli, 'build', '--debug', '--no-bundle', '--config', configFile],
      {
        cwd: desktopDir,
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'inherit',
      },
    );
    if (result.status !== 0) {
      throw new Error(`tauri build failed with exit code ${result.status}`);
    }
  },

  beforeSession: () => {
    tauriDriver = spawn(
      path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
      [],
      { stdio: [null, process.stdout, process.stderr] },
    );

    tauriDriver.on('exit', (code) => {
      if (!cleanExit) {
        console.error('tauri-driver exited with code:', code);
        process.exit(1);
      }
    });
    tauriDriver.on('error', (error) => {
      console.error('tauri-driver error:', error);
      process.exit(1);
    });
  },

  afterSession: () => {
    closeTauriDriver();
  },
};

const closeTauriDriver = () => {
  cleanExit = true;
  tauriDriver?.kill();
};

const cleanup = () => {
  try {
    closeTauriDriver();
  } finally {
    process.exit();
  }
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);
process.on('SIGBREAK', cleanup);
