# Floop3 for SoftBank Air 6

[English guide](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Floop3 is a LuCI app for modem, SIM/eSIM, SMS, Wi-Fi, connected clients, and network management on the **SoftBank Air 6 (RG620T-SBK / RUDOLF / SBA6D)**.

## Before installing

- This project targets the vendor firmware **OpenWrt 21.02.7**, target `gem6xxx/evb6990_cpe_mt7990_emmc`, ARM64. It is not a package for generic upstream OpenWrt.
- Check the [firmware compatibility notes](docs/FIRMWARE-COMPATIBILITY-EN.md). Matching metadata is not a guarantee that every feature is validated.
- Back up router configuration and retain a working SSH or UART recovery path. The installer restarts `rpcd`; it does not reboot the router.
- Run the release bundle's checksum check and `install.sh --check`. Do not bypass a failed model, ownership, pending-firewall, or free-space check.

## Start here

1. Choose a tagged release whose manifest matches your device and source version.
2. Follow the [installation guide](docs/INSTALL-NON-CODEX-EN.md) and [access guidance](docs/INSTALL-ACCESS-EN.md).
3. Use the [manual index](docs/MANUALS.md) for Wi-Fi, network modes, USB NIC, and recovery guidance.

Optional USB NIC support is experimental and depends on the adapter and firmware. Keep SSH and LuCI on a trusted LAN; do not expose them directly to the public internet.
