<!-- next-header -->

## [Unreleased] - (release date)

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
[Unreleased]: https://github.com/matthias-stemmler/annimate/compare/v1.4.0...HEAD
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
