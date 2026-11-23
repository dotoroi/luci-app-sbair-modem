# Remove Floop3 (Air Terminal 6)

[English](UNINSTALL-FLOOP3-EN.md) | [한국어](UNINSTALL-FLOOP3-KO.md) | [日本語](UNINSTALL-FLOOP3-JA.md)

`tools/uninstall-floop3.sh` removes manually installed Floop3 files and registrations only. It does not remove OpenWrt, LuCI, `luci-app-air6-modem`, network/Wi-Fi settings, or root account settings. It does not reboot the device.

## Run

Run the script on the device from a root SSH session or UART root shell:

```sh
sh uninstall-floop3.sh
```

After confirming the SoftBank Air 6 board, the script saves current configuration and target files to `/root/sbair-backups/floop3-removal-<UTC timestamp>/before-remove.tar.gz`. It stops and disables Floop3 services, then removes app files, startup links, LuCI menu/RPC registrations, the Floop3-only firewall include, and English/Japanese language registrations added during installation. The Korean selection is retained because it pre-existed.

`/etc/config/sbair` is removed only if it was absent from the pre-install backup and every UCI key/value exactly matches installer defaults. It is preserved if user values were added or changed. `/etc/config/ql_ril_service` is removed only when its log-level default exactly matches the installer value. Copies remain in the removal backup.

## Verify

```sh
ubus list | grep -x sbair        # should print nothing
ps w | grep -E 'sbair|5300'      # no app process should remain
apk info -e luci-app-air6-modem  # the base Air6 menu package should remain
ip -4 addr show br-lan           # the existing LAN address should remain
```

`before-remove.tar.gz` and `paths.txt` are for review/recovery. Do not extract the whole archive over `/`, as it could overwrite current settings. Restore individual paths only after reviewing them.
