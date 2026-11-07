# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-07

### Added

- The tropical storms and hurricanes of the US National Hurricane Center: Atlantic, Eastern
  Pacific and Central Pacific basins, read without an account.
- One device per followed basin: active systems, strongest system, its Saffir-Simpson category
  and sustained wind, formation chances within 48 hours and 7 days.
- A "Nearest hurricane" device: storm, category, sustained wind, distance and direction from the
  home, movement.
- Scene triggers: new named storm, storm within the radius, category raised (hurricane, major
  hurricane), new coastal watch or warning.
- Scene action "read the current storms" (one sentence, number, highest category) and
  configuration action "Show the current storms".
- Dashboard widget: active storms with their advisory and forecast cone, formation outlook.
- Imperial or metric units; texts in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-nhc/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-nhc/releases/tag/v1.0.0
