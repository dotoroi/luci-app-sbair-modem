# Troubleshooting

[English](TROUBLESHOOTING.en.md) | [한국어](TROUBLESHOOTING.ko.md) | [日本語](TROUBLESHOOTING.md)

## SSH is unreachable

The Air 6 does not need Internet for host-assisted installation. First test SSH from the host:

```sh
ssh root@<current-LAN-IP> 'cat /etc/openwrt_release; ip -4 addr show br-lan'
```

In AP/Bridge mode, confirm the host is on the same Layer 2 network or can resolve the router with ARP. `install.sh` never guesses or changes the IP.

## Preflight rejects the platform

This bootstrap accepts only:

```text
DISTRIB_RELEASE=21.02.7
DISTRIB_TARGET=gem6xxx/evb6990_cpe_mt7990_emmc
DISTRIB_ARCH=aarch64_cortex-a55_neon-vfpv4
```

Do not force it onto other vendor firmware or OpenWrt releases. Validate a separate package manifest before supporting another platform.

## `--check` reports TCP/8080 only as failed

On the Air 6, check local LuCI first:

```sh
ps w | grep '[u]httpd'
netstat -lntp 2>/dev/null | grep ':8080 '
curl -i http://127.0.0.1:8080/cgi-bin/luci/
```

`403 Forbidden` before login is normal. If localhost works but LAN access fails, inspect firewall:

```sh
iptables -C INPUT -i br-lan -p tcp --dport 8080 -j ACCEPT
uci show firewall.sba6_user_include
grep -n 'LUCI-LAN-SBA6' /etc/firewall.user
```

Repair does not reinstall packages:

```sh
./extras/luci-bootstrap/install.sh --repair root@<current-LAN-IP>
```

## Access fails only after reboot

Check that uhttpd autostart and named firewall include persist:

```sh
/etc/init.d/uhttpd enabled
uci show firewall.sba6_user_include
iptables -C INPUT -i br-lan -p tcp --dport 8080 -j ACCEPT
```

If uhttpd listens but firewall rules disappeared, `--repair` can rebuild uhttpd settings, `firewall.user`, the named include, and rpcd cache.

## Package dry-run aborts

`target.sh` aborts plans involving downgrades/removals, vendor ABI changes (`libc`, kernel, kmod, libubus/libuci/libubox/libjson/liblua/libnl), or changes to vendor `libiwinfo20230701`. Preserve `/root/sba6-pre-luci-*/opkg.before.txt` and host logs, then inspect platform and vendor package status. Do not run `opkg upgrade` to force consistency.

## `libnl-tiny.so` ABI test fails

Official 21.02.7 `libnl-tiny1` is extracted temporarily from `data.tar.gz`, not installed with opkg. On failure, vendor `/usr/lib/libnl-tiny.so.1` remains unchanged. Check package state and free space before retrying.

