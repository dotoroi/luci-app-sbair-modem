# Air 6 Router Mode Guide

[English](ROUTER-MODE.en.md) | [한국어](ROUTER-MODE.ko.md) | [日本語](ROUTER-MODE.ja.md)

This guide describes the router configurations implemented under Floop3 **Network → Connection Mode**. The target is vendor-modified OpenWrt 21.02.7. If you want wired Internet while preserving the cellular configuration, this guide recommends **Air 6 Ethernet WAN (VLAN 3)** as the preferred mode. The two wired WAN configurations use different port paths.

## Available modes

| LuCI label | Uplink | Behavior |
|---|---|---|
| **Stock cellular router (SIM / ccmni)** | Built-in cellular modem | Restores the saved SIM-router profile and keeps the private LAN and LAN DHCP. |
| **Air 6 Ethernet WAN (VLAN 3) — Recommended** | `eth0.3` on switch VLAN 3 | Adds a DHCP uplink on VLAN 3 while preserving the cellular `network.wan` configuration. |
| **Floop3 wired WAN router (eth1)** | Dedicated logical interface `eth1` | Gets an address from the upstream device by DHCP and assigns `network.wan` to eth1. Replaces the cellular uplink. |

Both wired modes retain the private LAN address and DHCP pool, and reuse the existing LAN→WAN forwarding and masquerade (NAT) policy. Before applying, the code checks for a WAN firewall zone with DROP/REJECT input, masquerading, and LAN→WAN forwarding. It refuses to proceed if those prerequisites are absent. This does not imply hardware NAT or performance acceleration is enabled.

### eth1 wired WAN

This mode changes `network.wan` to DHCP on `eth1`. If `wan6` exists, IPv6 WAN is also assigned to eth1. It **does not provide dual-WAN or automatic failover with cellular**: the Ethernet interface replaces the cellular uplink as the routed WAN. The modem is not explicitly disabled by this configuration.

`eth1` is a logical interface name detected by software. The repository does not establish which labeled physical jack on the case maps to it. Check **Network → Diagnostics** for candidates/link state, inspect device port labels, and identify the jack with a controlled physical link test. Connecting an upstream network to a LAN jack can cause competing DHCP servers.

### Recommended option: VLAN 3 Ethernet WAN

This mode applies the switch layout recorded by the implementation: external switch port 1 is removed from VLAN 1 and added untagged to VLAN 3; CPU port 5 is tagged in VLAN 3, creating `eth0.3`. A separate DHCP client, `network.ethernetwan`, is added to the WAN firewall/NAT zone. The existing cellular `network.wan` remains configured.

This is the recommended wired WAN profile when you want to retain the cellular configuration. “Recommended” refers to the mode choice; this implementation does not set route metrics. Cellular and Ethernet may both advertise a default route, and the code does not set route preference or automatic failover, so check the active default route in status or with `ip route`. Do not infer the case jack label from the switch port number. A failed switch/VLAN change can cut off remote management; keep UART recovery available.

## Before switching

1. Confirm the device runs the supported vendor OpenWrt 21.02.7 firmware.
2. Back up settings and prepare an independent recovery method, preferably UART. Keep a working LuCI management path over LAN/Wi-Fi.
3. Use **Network → Diagnostics** to inspect links and WAN candidates. Do not connect the upstream cable until you have identified the physical WAN jack.
4. Confirm the upstream router/modem offers an IPv4 address by DHCP. These ethwan/VLAN WAN profiles do not configure PPPoE credentials.
5. The LAN needs a valid static private IPv4 address/netmask, an enabled LAN DHCP server, LAN→WAN forwarding, and WAN masquerading. eth1 cannot be selected directly from AP mode; first return to the SIM router mode.

## Switch in LuCI

1. Open **Network → Connection Mode**. Review the current mode, management IP, default route, DHCP state, and WAN address/link status.
2. If currently in AP/Bridge, first switch back to **Stock cellular router (SIM / ccmni)**. Direct AP-to-wired-WAN transitions are rejected.
3. Select **Floop3 wired WAN router (eth1)** or **Air 6 Ethernet WAN (VLAN 3)**. Review the on-screen description and candidate link, then click **Apply changes**.
4. Connect the upstream cable to the verified WAN jack and keep the management PC on LAN/Wi-Fi. Confirm that upstream DHCP grants a lease and a default route appears.
5. Confirm only when the displayed mode, WAN address/link, default route, and LAN DHCP state are correct. Click **Check these settings/Confirm** while the transaction is pending. If uncertain or management access is unstable, choose **Rollback** or let the 120-second timer expire.

Wired mode changes have a Safe Apply confirmation window of up to 120 seconds. It restores the saved configuration snapshot, but cannot guarantee recovery from every kernel, switch, or network failure. Do not test VLAN mode remotely without UART.

## Verify and return

In **Network → Connection Mode**, inspect the link, DHCP address, and default route for `eth1` or `eth0.3`. If shell access is available, these read-only checks can help:

```sh
ip -4 addr show br-lan
ip route
ifstatus wan
ifstatus ethernetwan
```

For `ethwan`, `wan` should have a DHCP address and default route. For VLAN WAN, inspect `ethernetwan` and verify which default route is active. If Internet access fails, do not disable the firewall or add the WAN directly to the LAN bridge.

To return to cellular routing, choose **Stock cellular router (SIM / ccmni)** in Connection Mode, apply it, and confirm. ethwan restores the saved original WAN configuration. VLAN WAN restores the saved VLAN baseline and removes the separate Ethernet WAN interface. AP/Bridge is not the direct rollback target; return to SIM router mode first.

## Two different DHCP settings

- **Management IP DHCP client**: the Air 6 itself obtains a management address from an upstream router. This is for AP/Bridge management and is separate from WAN DHCP.
- **LAN DHCP server**: the Air 6 assigns addresses to local clients. It must remain enabled in router mode. It is managed under **Network → LAN Services**; the Connection Mode screen does not arbitrarily toggle WAN/LAN DHCP.

## `sbair.errorText is not a function` in Connection Mode

This JavaScript error can occur when the browser mixes an older cached `tools/sbair.js` with a newer `netmode.js`. It does not indicate that WAN settings or the connection mode were changed. Do not click **Apply changes** to dismiss it.

1. In desktop Chrome, press `Ctrl+Shift+R` for a hard reload. On mobile, close and reopen the LuCI tab, or check in a private tab first.
2. If it persists, clear the site cache for the router address `192.168.3.1` and sign in again.
3. If it still recurs, reinstall the complete release bundle and reload the page. Do not copy only `netmode.js`.

The current view falls back to displaying the original error if the shared error helper is unavailable. If the error continues, report the LuCI release version, source commit, and browser console message.

## Personal note: logs in `/tmp`

Logs and temporary files stored under `/tmp` on the Air 6 consume memory. Leaving verbose/debug logging enabled or accumulating large logs for a long time can exhaust memory and make LuCI, network services, or app functions unstable or unavailable. Collect only the diagnostic logs you need for a short period. For long-term retention, copy them to a PC and then clear the device's temporary logs.
