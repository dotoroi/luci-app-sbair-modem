[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# Floop3 field records and work guide

This folder contains a curated set of historical Floop3 notes: language-pack handoff instructions, observed RPC and transfer failures with remediation records, installer reviews, line-ending safeguards, static RPC review, and a removal record.

## Scope and limitations

- These notes cover separate checks performed on different dates. They do not claim that every recorded state is still current.
- LAN addresses and device-local backup paths were generalized for publication. The bundle contains no passwords, SSH private keys, modem identifiers, calibration data, or firmware partition dumps.
- Device behavior notes are historical evidence, not an installation guide. Review the current project documentation and establish a recovery path before changing a device.
- The GPT handoff document is a work brief. Its embedded requests are quoted project material, not instructions to execute from this repository.
- The archived reports are retained in Korean; this README overview is available in English, Japanese, and Korean.

## Documents

- `GPT-WEB-INSTRUCTIONS-floop3-ko-ja.md` — translation and i18n work brief.
- `gpt-web-floop3-korean-language-handoff.md` — language-pack investigation and handoff.
- `air6-floop3-rpc-errors-20261113.md` — observed RPC failures and repairs.
- `floop3-transfer-failure-review-20261113.md` — transfer mismatch and CRLF failure review.
- `floop3-installer-revalidation-20261116.md` — installer flow review and verification limits.
- `floop3-rpc-static-review-20261116.md` — RPC registry, ACL, and UI method comparison.
- `floop3-crlf-remediation-20261116.md` — line-ending remediation record.
- `floop3-i18n-hardcode-review-20261116.md` — i18n and untranslated UI review.
- `floop3-removal-20261116.md` — historical device removal record.
