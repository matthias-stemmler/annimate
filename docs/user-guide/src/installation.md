# Installation

Since Annimate is a desktop-based application (as opposed to a website), you need to install it on your local system before you can use it.

The exact procedure depends on the operating system you are using. Annimate is currently available for both Windows and Linux.

> **Note:** MacOS is currently not supported. [Let us know](https://github.com/matthias-stemmler/annimate/issues/new/choose) if you are interested in MacOS support.

## Windows

On Windows, Annimate comes with an installer that takes care of the installation process for you and can update your installation automatically whenever a new version of Annimate becomes available.

> **Note:** Installing Annimate on Windows does _not_ require administrator permissions. However, Annimate will only be installed for the current user, not system-wide.

In order to install Annimate, go through the following steps:

1. Download the installer `.exe` file from GitHub: [Annimate_1.2.0_x64-setup.exe][1]
2. Run the downloaded `.exe` file and follow the instructions of the installation wizard
3. Afterwards, you can run Annimate through the Windows start menu entry and/or the link on your desktop, depending on the options you chose in the installation wizard

### Automatic updates

Every time Annimate is started, it automatically checks for updates in the background. If there is an update, you are presented with a dialog telling you that an update is available and listing the most important changes. You can then choose to either

- apply the update, or
- skip the update for now.

If you choose to apply the update, the application will restart itself when the installation is completed. If you choose to skip the update, you will be reminded again the next time you start the application.

> **Note:** We strongly recommend that you install updates in order to keep up with new features and bugfixes.

## Linux

On Linux, Annimate comes in two different formats that you can choose from: an [AppImage](https://appimage.org/) and a [Debian package](<https://en.wikipedia.org/wiki/Deb_(file_format)>).

### AppImage

The Annimate AppImage is a self-contained application bundle that includes all of its dependencies pre-bundled and runs on all common Linux distributions such as Ubuntu, Debian, openSUSE, RHEL, CentOS and Fedora without requiring a dedicated installation step. It can update itself automatically whenever a new version of Annimate becomes available.

In order to use the AppImage, go through the following steps:

1. Download the `.AppImage` file from GitHub: [Annimate_1.2.0_amd64.AppImage][2]
2. Make it executable:
   ```shell
   chmod a+x Annimate*.AppImage
   ```
3. Afterwards, you can run Annimate by running the `.AppImage` file:
   ```shell
    ./Annimate*.AppImage
   ```

#### Automatic updates

Every time Annimate is started, it automatically checks for updates in the background. If there is an update, you are presented with a dialog telling you that an update is available and listing the most important changes. You can then choose to either

- apply the update, or
- skip the update for now.

If you choose to apply the update, the application will restart itself afterwards. If you choose to skip the update, you will be reminded again the next time you start the application.

> **Note:** We strongly recommend that you install updates in order to keep up with new features and bugfixes.

Since there is no dedicated installation step, updating in this case just means that the `.AppImage` file is replaced with a newly downloaded one. Note that the name of the `.AppImage` file (which includes a version number) stays the same, even though it now contains a newer version. If you want to avoid this, consider renaming the file to give it a version-independent name.

### Debian Package

On Debian and its derivatives (such as Ubuntu), you can alternatively install Annimate from a Debian package. Note that this requires `sudo` privileges and does _not_ support automatic updates.

In order to install the Debian package, go through the following steps:

1. Download the `.deb` file from GitHub: [Annimate_1.2.0_amd64.deb][3]
2. Install it:
   ```shell
   sudo dpkg -i ./Annimate_*_amd64.deb
   ```
3. Start Annimate:
   ```shell
   Annimate
   ```

## Obtaining Older Versions

For reference, you can find the most recent and all previous releases of Annimate on the [Releases](https://github.com/matthias-stemmler/annimate/releases) page on GitHub.

[1]: https://github.com/matthias-stemmler/annimate/releases/download/v1.2.0/Annimate_1.2.0_x64-setup.exe
[2]: https://github.com/matthias-stemmler/annimate/releases/download/v1.2.0/Annimate_1.2.0_amd64.AppImage
[3]: https://github.com/matthias-stemmler/annimate/releases/download/v1.2.0/Annimate_1.2.0_amd64.deb

## What's Next?

After you have successfully installed Annimate, you can proceed with [Importing Corpus Data](import.md).