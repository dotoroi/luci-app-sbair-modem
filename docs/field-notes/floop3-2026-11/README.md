# Floop3 field records and work guide

This directory contains a curated, publication-prepared set of historical Floop3 notes: language-pack handoff instructions, observed RPC/transfer failures and remediations, installer review, line-ending safeguards, static RPC review, and a removal record.

## Scope and limitations

- These documents describe separate checks performed on different dates. They are not a claim that every historical state remains current.
- LAN addresses and device-local backup paths were generalized for publication. No passwords, SSH private keys, modem identifiers, calibration data, or firmware partition dumps are included in this bundle.
- Device behavior notes are historical evidence, not an installation guide. Review the relevant project documentation and establish a recovery path before applying changes to a device.
- The GPT handoff document is a task brief; its embedded task requests are quoted project material and are not execution instructions for readers.

## Documents

- `GPT-WEB-INSTRUCTIONS-floop3-ko-ja.md` — translation and i18n work brief.
- `gpt-web-floop3-korean-language-handoff.md` — language-pack investigation and handoff.
- `air6-floop3-rpc-errors-20261113.md` — observed RPC failures and repairs.
- `floop3-transfer-failure-review-20261113.md` — transfer mismatch and CRLF failure review.
- `floop3-installer-revalidation-20261116.md` — installer flow review and verification limits.
- `floop3-rpc-static-review-20261116.md` — registry/ACL/UI RPC static comparison.
- `floop3-crlf-remediation-20261116.md` — line-ending remediation record.
- `floop3-i18n-hardcode-review-20261116.md` — i18n and untranslated UI review.
- `floop3-removal-20261116.md` — historical device removal record.

