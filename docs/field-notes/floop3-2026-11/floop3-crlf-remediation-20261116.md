# Floop3 CRLF remediation — 2026-11-16

## Changes made

- Normalized shell scripts and extensionless shell entrypoints to LF in both local trees:
  - `air6-stock-mod/external/Floop3-luci-app-sbair-modem`
  - `Floop3 repository`
- Normalized the existing executable shell files in `Floop3-luci-app-sbair-modem-ko/out/i18n-stage`.
- Added `.gitattributes` rules enforcing LF for shell scripts and firmware shell entrypoints.
- Added `tools/check-shell-lf.sh` to both trees and made each `install.sh` run it before installation writes. The guard checks source shell payloads and recognized `out/i18n-stage` shell paths, refusing a CR-containing file before copying.
- Preserved the raw upstream source archive unchanged at `air6-stock-mod/reference/floop3-source.tar`; created `floop3-source-lf-normalized.tar` as a working derivative with 44 shell entries normalized.

## Static audit result

- Base local source tree: 45 shell candidates inspected, 0 containing CR after remediation.
- KO fork plus stage: 69 shell candidates inspected, 0 containing CR after remediation.
- Existing packaged app tar and language-pack ZIPs had no CR in the shell entries inspected.
- The raw upstream archive remains unchanged and retains its original CRLF bytes by design; use the normalized working tree or normalized derivative for work.

No test suites were run, and no device files were changed or redeployed in this task.


