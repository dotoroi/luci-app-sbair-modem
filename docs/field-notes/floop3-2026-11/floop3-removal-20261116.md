# Floop3 removal record — 2026-11-16

## Target and method

- Target verified over root SSH at `REDACTED_LAN_IP`; board reports `SoftBank Air 6 (A775)`, OpenWrt SNAPSHOT `r0+38236-4be422cd68`, kernel `6.18.60`.
- Boot slot remained B (`bootslot=b`). No slot operation or reboot was performed.
- Before removal, Floop3's `sbair` ubus object, portal process, adblock helper and its separate DNS process were present. The installed app had added English/Japanese LuCI language entries, `firewall.sbair_dhcp_guard`, and app startup links.
- A removal archive was created on the device at `/root/REDACTED_BACKUP_DIR/before-remove.tar.gz` (5.1 MiB), with a path manifest and board identity.

## Changes made

- Stopped and disabled only `sbair-{portal,adblock,wifidrift,netfix,apn}` services and removed their startup links.
- Removed the Floop3 binary, rpcd backend, LuCI menu/ACL/views, helper scripts, translations, protocol JavaScript, firewall include, and adblock runtime config.
- Removed `firewall.sbair_dhcp_guard`, and the `en`/`ja` LuCI language entries. The pre-existing Korean language entry remains.
- Removed `/etc/config/ql_ril_service` after matching it to the app-created default and `/etc/config/sbair` after confirming all 12 UCI records exactly matched the app-generated default. Both were saved in the removal archive.
- Cleared LuCI caches and restarted `rpcd`; no reboot.

## Verification

- Floop3 paths sweep under `/etc`, `/usr/bin`, `/usr/sbin`, `/usr/libexec`, `/usr/share`, LuCI i18n, web resources, and upgrade keep files returned no `*sbair*` paths.
- `ubus list` no longer contains `sbair`; Floop3 services/listeners were absent.
- `luci-app-air6-modem` remains installed.
- `network.lan` remains `br-lan`, static `REDACTED_LAN_IP/24`; runtime bridge address is still `REDACTED_LAN_IP/24`.
- Root SSH remained usable during verification. No password, SSH keys, network/Wi-Fi configuration, firmware, or boot slot was changed by the removal.

## Reusable procedure

The target-side script is `Floop3 repository/tools/uninstall-floop3.sh`; Korean instructions are in that project's `docs/UNINSTALL-FLOOP3-KO.md`. The script checks board identity, saves a pre-removal archive, removes only known app paths and registrations, and retains modified app configs rather than deleting them.


