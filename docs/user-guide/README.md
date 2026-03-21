# Annimate User Guide Authoring

## Running the User Guide Locally

Run

```shell
mdbook serve --open
```

## Taking Screenshots

- In `tauri.conf.json`, set the window size to `1088x768`
- In `main.rs`, comment out the restoration of the window state
- Start the application and navigate to the state of which you want to take a screenshot
- Take a screenshot of the window with the GNOME builtin screenshot tool (Alt+PrintScreen)
- If the screenshot should include a native dialog, take a separate screenshot of the dialog and overlay the two images using [GIMP](https://www.gimp.org/)
- Add annotations using [ksnip](https://github.com/ksnip/ksnip) if needed
  - In ksnip, set Options > Settings > Annotator > Canvas Color to transparent
