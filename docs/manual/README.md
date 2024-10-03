# Taking Screenshots

- In `tauri.conf.json`, set window size to 1024x768
- In `main.rs`, comment the restoration of the window state
- In `index.html`, uncomment the `<script>` element for highlighting
- Configure window decorations appropriately
  - E.g. in KDE use `Breeze` with `Small` shadows of strength `50%`, otherwise keep the defaults
- Start the application and navigate to the state of which you want to take a screenshot
- Highlight important elements (see below)
- Take a screenshot of the window

## Highlighting elements

- Highlight an element by Ctrl-clicking on it
- Unhighlight a highlighted element by Ctrl-clicking on it again
- Alternatively, toggle highlighting of an element by selecting it in the devtools and then typing `h($1)` in the console
- Increase/decrease padding of the highlight border using Ctrl+ArrowUp resp. Ctrl+ArrowDown
- Press Ctrl+u to undo highlighting/unhighlighting
