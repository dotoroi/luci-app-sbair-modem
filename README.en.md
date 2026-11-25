[English](README.en.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[User manuals](docs/MANUALS.md)
[Air 6 router mode / Air 6 ルーターモード / Air 6 라우터 모드](docs/ROUTER-MODE.en.md)

# luci-app-sbair-modem

A LuCI application for the SoftBank Air 6 (RG620T-SBK / RUDOLF), designed for its vendor-modified OpenWrt environment. It provides modem status and controls, SIM/eSIM management, APN and SMS functions, Wi-Fi and client management, AP/Bridge and wired WAN modes, USB device information, and OTA/FOTA maintenance.

> This project targets the SoftBank Air 6 board and its vendor-modified OpenWrt environment. The installer checks the device identity and ARM64 runtime, not a fixed KNOS/OpenWrt version list. It is not a general-purpose package for current upstream OpenWrt.

## Features

- Mobile modem status, radio details, SIM/eSIM, SIM lock, IMS, APN, SMS, and reset controls
- Wi-Fi settings and diagnostics
- Connected client list and network mode management
- Device and USB information, plus OTA/FOTA maintenance
- Restore saved LTE/NR band masks after modem initialization
- LAN-only SSH/firewall recovery watchdog for the documented Air 6 test network
- English, Japanese, and Korean LuCI translations
- Optional USB NIC support is experimental and hardware/configuration dependent

Sensitive identifiers are masked by default in the interface.

## Build and install

See the repository documentation for prerequisites, build steps, and installation guidance. In particular:

- [Build and installation guide](docs/INSTALL-NON-CODEX-EN.md)
- [Access and password guidance](docs/INSTALL-ACCESS-EN.md)
- [Firmware compatibility](docs/FIRMWARE-COMPATIBILITY-EN.md)
- [Overlay whiteout read-only audit (Korean)](docs/OVERLAY-WHITEOUT-AUDIT-KO.md)
- [API and UI reference](docs/API.md)

The translated LuCI catalogs are under `po/`. Build them with LuCI's `po2lmo` using `PO2LMO=/path/to/po2lmo ./tools/build-i18n.sh`, then stage them with `install.sh`.

## License

See [LICENSE](LICENSE).
