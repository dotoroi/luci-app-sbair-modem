# Optional IP migration notes

[English](IP-MIGRATION.en.md) | [한국어](IP-MIGRATION.ko.md) | [日本語](IP-MIGRATION.md)

The bootstrap does not change LAN IP, DHCP, gateway, or DNS. If `network.lan.ipaddr` differs from runtime `br-lan`, it stops instead of guessing which numbered section to delete.

## Inspect current state

```sh
uci show network.lan
uci show network | grep -B3 -A10 "name='br-lan'"
ip -4 addr show br-lan
```

Only if the configured and runtime IPs differ, secure a recovery path such as UART first. Never assume a section number such as `network.@device[3]` is the same across devices.

## Remove an obsolete device IP

Identify the exact section from the displayed configuration and save a backup first:

```sh
cp -p /etc/config/network /root/network.before-ipfix
uci -q delete network.<verified-section>.proto
uci -q delete network.<verified-section>.ipaddr
uci -q delete network.<verified-section>.netmask
uci commit network
/etc/init.d/network restart
```

Then verify runtime state:

```sh
ip -4 addr show br-lan
```

## Gateway/DNS on another subnet

Only when Air 6 is `<AIR6_IP>` and the parent router is `<UPSTREAM_ROUTER_IP>`, configure as needed. This is unnecessary if Internet access works with the stock `192.168.3.1` setup.

```sh
uci set network.lan.gateway='<UPSTREAM_ROUTER_IP>'
uci -q delete network.lan.dns
uci add_list network.lan.dns='<UPSTREAM_ROUTER_IP>'
uci add_list network.lan.dns='1.1.1.1'
uci add_list network.lan.dns='8.8.8.8'
uci commit network
```

This is an optional network migration procedure. LuCI bootstrap never applies it automatically, even if it detects an IP mismatch.

