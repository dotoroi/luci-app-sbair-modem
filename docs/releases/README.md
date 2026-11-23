# Localized release notes

Each tagged release needs one file named after its version without the leading `v`, for example `docs/releases/1.2.3.md` for tag `v1.2.3`. The GitHub release workflow publishes this file as the release body; it does not substitute English-only generated notes.

Start from [TEMPLATE.md](TEMPLATE.md). Keep the language links at the top and provide matching `## English`, `## 日本語`, and `## 한국어` sections. English is the default section shown first. The workflow rejects a release if its notes file or any of the three sections is missing.

The matching versioned file is also included in its downloadable bundle as `docs/RELEASE-NOTES-<version>.md` when present.
