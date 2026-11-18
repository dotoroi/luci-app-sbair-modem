# Floop3 Korean UI fork

This local fork adds a Korean translation to the LuCI interface of Floop3's `luci-app-sbair-modem`.

- Upstream: https://github.com/Floop3/luci-app-sbair-modem
- Base commit: `5a00fb8` (`Test throughput labels and historical references`)
- Branch: `codex/korean-ui`
- Scope: the 13 LuCI view scripts, the shared `sbair.js` UI helper, and the LuCI menu titles.
- The modem backend, init scripts, firewall, UCI configuration, and optional daemons are unchanged.
- Translation source map: `locales/ko-translations.json`.

The Korean strings were generated from the Japanese source and should be reviewed before upstream publication. Some backend-provided diagnostic text may remain Japanese.

## Device deployment

The device UI files were compared against the upstream base before deployment. Installation backs up the current UI files under `/root/sbair-backups/ko-ui-*`, then replaces only the matching LuCI UI/menu files. No Floop3 installer or service activation is run. Rollback is to restore the `before.tar.gz` archive from the corresponding backup directory and clear `/tmp/luci-indexcache` and `/tmp/luci-modulecache`.

## Korean completion, 2026-11-11

87 additional English and missed Japanese UI labels were translated. Source string parsing now skips JavaScript comments. No Japanese kana remain in static UI string literals. Backend RPC errors, warnings, and raw diagnostics can still contain the original language.

Official `luci-i18n-base-ko` version `git-23.090.62029-650e6d2` was installed from the OpenWrt 21.02.7 feed after verifying SHA256 `8cef0b0b0c8dc2d8905d7b3094622cdbc54b9bc483e3a2ea0b201e1c824c591d`. `luci.languages.ko` is registered as `한국어 (Korean)`; the user's `auto` language setting is retained for selection through System → System → Language and Style. Lua translation lookup returned Korean for Save & Apply and Language and Style.

Backup: `/root/sbair-backups/ko-language-20261111/` contains `ui.before.tar.gz` and `luci.before`. Rollback the UI by extracting the archive at `/`; uninstall `luci-i18n-base-ko` and restore `/etc/config/luci` from `luci.before` to roll back the language pack. Clear LuCI index/module caches after restoration.

All 15 deployed UI file hashes match local files. All view scripts pass Node syntax checks. Authenticated HTTP requests to the system and LAN services pages returned 200. Browser rendering and changing language through the form have not been exercised.

## Gettext conversion, 2026-11-13

All static Korean UI literals in the 13 dedicated view scripts were moved to English gettext message IDs. The shared UI helper, LAN DHCP strings, menu titles, and fixed Wi-Fi / networking backend error messages use the same catalogs. `po/en`, `po/ja`, and `po/ko` contain 724 message IDs each; `po/templates/luci-app-sbair-modem.pot` is the translator template. English, Japanese, and Korean are registered in LuCI Language and Style. Run `tools/build-i18n.sh` with LuCI's `po2lmo`, then `install.sh` to stage the catalogs. No router was changed as part of this source update.

Raw values supplied by the stock modem firmware or operating system may still arrive in their original language; those are runtime diagnostics rather than static app strings.
