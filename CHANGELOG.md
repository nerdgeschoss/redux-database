# Changelog

All notable changes to this project will be documented in this file.

## [0.0.20] - 2020-05-14

### Added

- Tables have a new property `length` that returns the number of rows in them.
- **Truncating**: Tables can now be truncated with `truncate`. The same method exists on databases and truncates all tables instead.
- **Resetting**: Tables have a new method `reset` that rolls them back to their initial state (the state when `MutableDB` was created or in case of `DB` when the `reducer` was initialized). `DB`/`MutableDB` have a corresponding method that depending on the option resets settings, tables or everything.