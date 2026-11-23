# SBA6 LuCI bootstrap (optional)

[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

Optional helper for stock SoftBank Air 6 vendor OpenWrt 21.02.7 when LuCI is not installed. It is independent of the Floop3 app. Skip it if LuCI already works. It preserves the vendor MT-WiFi driver and ABI; it does not install, repair, or replace that driver. Do not use it on another release or SNAPSHOT.

## Install

From a Mac/Linux host, use the device's current management IP:

```sh
./extras/luci-bootstrap/install.sh root@<AIR6_IP>
```

The host downloads packages pinned in `packages.lock` from the official OpenWrt archive, verifies SHA256, and transfers them to `/tmp/sba6-luci-bootstrap/` over SSH. The router itself needs no Internet, DNS, or default route. Installation does not reboot. Open the displayed current LAN address:

```text
http://<current-LAN-IP>:8080/cgi-bin/luci/
```

After reboot, verify with:

```sh
./extras/luci-bootstrap/install.sh --check root@<AIR6_IP>
```

## Modes

```sh
./extras/luci-bootstrap/install.sh --dry-run root@<AIR6_IP> # checks only
./extras/luci-bootstrap/install.sh --check root@<AIR6_IP>    # read-only status
./extras/luci-bootstrap/install.sh --repair root@<AIR6_IP>   # repair services/rules/cache only
```

Packages can be cached with `SBA6_LUCI_CACHE_DIR` (default `/tmp/sba6-luci-bootstrap-cache`).

## Safety boundaries

Only OpenWrt 21.02.7, target `gem6xxx/evb6990_cpe_mt7990_emmc`, architecture `aarch64_cortex-a55_neon-vfpv4` is accepted. It does not change opkg feeds or run `opkg update/upgrade`. Vendor `libnl-tiny.so.1` and `libiwinfo.so.20230701` are preserved alongside required LuCI ABI libraries. Stock lighttpd TCP/80 remains; LuCI uses uhttpd TCP/8080, allowed from `br-lan` only, never WAN/5G. A pre-install backup is saved under `/root/sba6-pre-luci-<timestamp>.<pid>/`. LAN IP, DHCP, gateway, DNS, SSH, OTA, stock WebUI, and firmware are not changed. If configured LAN IP differs from runtime `br-lan`, the script stops instead of guessing which section to remove.

See [troubleshooting](docs/TROUBLESHOOTING.en.md) and [optional IP migration notes](docs/IP-MIGRATION.en.md).
