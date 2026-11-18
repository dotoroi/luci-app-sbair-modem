# SBA6 USB NIC (CDC-NCM Gadget) — experimental optional bundle

[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

This is an **experimental, high-risk** feature that turns the SoftBank Air 6 / SBA6D itself into a USB CDC-NCM gadget. It is separate from the **Device → USB devices** inventory, which examines USB Ethernet adapters connected to the Air 6. This bundle is not included in the normal `install.sh`; it is not installed, loaded, or enabled by default. The `.ko` module is not included.

## Install the bundle only

Run from a Mac/Linux host:

```sh
./extras/usb-nic/install.sh root@<Air6-management-IP>
```

The host downloads a candidate binary from a pinned upstream revision, verifies SHA256, and transfers it over SSH. The Air 6 does not need Internet, DNS, or a default route. Installation does not load the module, configure ConfigFS/UDC/`usb0`, change LAN/WAN/bridge/firewall/Wi-Fi, or reboot.

To check status only:

```sh
./extras/usb-nic/install.sh --check root@<Air6-management-IP>
```

## Requirements before enabling

Enabling is a separate, explicit operation available only in **Device → USB devices → USB NIC (CDC-NCM Gadget)**. First install an activation profile containing values reviewed on upstream hardware with `--profile FILE`. Values are never guessed, generated, or copied automatically from the vendor gadget:

```text
VID_HEX
PID_HEX
DEV_MAC
HOST_MAC
USB0_ADDR
PEER_IPV4
```

The profile is stored mode 600 and its values are omitted from status/logs. Enable remains unavailable if it is missing or invalid. This feature does not bridge USB into `br-lan` or change LAN/WAN/DHCP/Wi-Fi. Ensure an independent LAN/Wi-Fi management path and physical recovery method before proceeding; USB host disconnection can interrupt access.

## Pinned upstream and safety

`driver.lock` pins the upstream revision, artifact, SHA256, kernel, architecture, vermagic, license, and validated topology. Candidate topology:

```text
gadget   = t6a_ncm_test
function = t6a_ncm.test0
config   = c.1
UDC      = 11201000.usb
network  = usb0
```

Candidate v1 is an upstream live-validated binary, but its source/binary match has provenance-based B2 status and upstream discourages new use. Treat this as experimental, not a supported product driver. Review [Karin-Laboratory/sbat6-usb-nic](https://github.com/Karin-Laboratory/sbat6-usb-nic) and its safety docs.

The initial implementation does not add cold-boot autostart and will not claim the UDC automatically after reboot. Before enabling, read-only preflight checks the profile, module hash, kernel/vermagic, ConfigFS ownership, UDC, USB speed, `usb0`, and `br-lan` management path. Failure triggers only a limited rollback for the dedicated gadget. Unknown ConfigFS objects and vendor topology are preserved. It will not force-unload modules, recreate/remove vendor gadgets, manipulate the UDC driver, or blindly reboot.

See [recovery guidance](docs/RECOVERY.en.md) before testing.

