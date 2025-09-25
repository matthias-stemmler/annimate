<!-- next-header -->

## [Unreleased] - (release date)

### Added

- Added a progress indicator during search telling how many corpora were already searched.

### Changed

- Improved search performance for some queries due to an improvement in the underlying graphANNIS library.
- Improved export performance.

### Fixed

- The export no longer fails when a corpus was imported from a renamed `.graphml` file.

## [1.5.0] - 2025-08-05

### Added

- Added an icon next to the "Export to ..." button that shows whether the information needed to start the export is complete. If it isn't (so the button is disabled), a tooltip explains what is missing.

### Changed

- Improved performance of query validation: Checking whether a query is valid no longer needs to wait until all selected corpora are loaded.
- Improved performance of loading the options under "Annotation", "Meta annotation" and "Segmentation": These will now load much faster due to caching.
  - NOTE: For corpora that were already imported before the update, this improvement will only be visible from the _second time_ the options are loaded after installing the update.
- Moved the link to the data folder from the "About" dialog to the "Manage corpora" screen.

### Fixed

- When the currently selected corpus set is renamed, the selection used to switch to "All corpora". It now correctly remains the same as before the renaming, just showing the set under its new name.
- When the currently selected corpus set is deleted, the corpus selection under "All corpora" used to be ignored, i.e. Annimate used to behave as if no corpora were selected. It now correctly respects the selection under "All corpora".

## [1.4.0] - 2025-04-15

### Added

- It is now possible to save the current export configuration (query, selected corpora, columns, etc.) to a "project" file and load such a file back into Annimate via the corresponding items in the "File" menu. See the User Guide for details.

### Changed

- Dialogs for choosing files or folders now start in the "documents" folder (for export) respectively "downloads" folder (for import).
- When offline, there is no more error message during startup saying that the check for updates failed.

### Fixed

- Fixed a case of data corruption that could happen under rare circumstances when trying to import a corpus with the same name as an already existing corpus. This is now always rejected with an error message.

## [1.3.4] - 2025-03-05

### Changed

- Automatic updates on macOS now work even when they require administrator permissions.
- Minor UI changes to improve consistency.

## [1.3.3] - 2024-11-27

### Fixed

- Optional query nodes are now always excluded from the selection under "Match annotation" and "Match in context" since they never correspond to match nodes.

## [1.3.2] - 2024-11-25

### Fixed

- Segmentations with layers other than `default_ns` are now supported. This applies to the `tok_anno` and `tok_dipl` segmentations of ReM 2.x.

## [1.3.1] - 2024-11-17

### Added

- Added support for macOS.

## [1.3.0] - 2024-11-04

### Added

- Added link to User Guide in "Help" menu.

### Changed

- Decreased auto-scrolling acceleration when reordering columns.

### Fixed

- Fixed occasional flashing of dialogs during fade-out.

## [1.2.0] - 2024-10-19

### Added

- The window state (e.g. position and size) is now persisted across restarts.

### Changed

- Starting Annimate again when it is already running now focuses the previous instance instead of showing an error.
- Implemented new dialog for automatic updates.

## [1.1.4] - 2024-10-01

### Fixed

- Legacy meta queries with multiple alternatives no longer cause Annimate to crash.
- Nodes for queries with optional nodes in between are now listed correctly.

## [1.1.3] - 2024-09-22

### Fixed

- Queries with varying number of nodes per match no longer cause Annimate to crash.

## [1.1.2] - 2024-09-03

### Fixed

- Excel exports of queries with zero matches are no longer broken.

## [1.1.1] - 2024-07-20

### Fixed

- "Match in context" columns are now produced correctly even for corpora without any coverage components.

## [1.1.0] - 2024-07-13

### Added

- Matches can now be exported either to comma-separated values (.csv) or Excel (.xlsx) files.

### Changed

- Increased contrast of scrollbars on gray background.

### Fixed

- Queries are not corrupted anymore when copying and pasting from the ANNIS web UI.
- Toast notifications are now shown behind modal dialogs.

## [1.0.0] - 2024-06-18

### Added

Initial version

<!-- next-url -->
[Unreleased]: https://github.com/matthias-stemmler/annimate/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/matthias-stemmler/annimate/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/matthias-stemmler/annimate/compare/v1.3.4...v1.4.0
[1.3.4]: https://github.com/matthias-stemmler/annimate/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/matthias-stemmler/annimate/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/matthias-stemmler/annimate/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/matthias-stemmler/annimate/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/matthias-stemmler/annimate/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/matthias-stemmler/annimate/compare/v1.1.4...v1.2.0
[1.1.4]: https://github.com/matthias-stemmler/annimate/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/matthias-stemmler/annimate/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/matthias-stemmler/annimate/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/matthias-stemmler/annimate/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/matthias-stemmler/annimate/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/matthias-stemmler/annimate/tree/v1.0.0
