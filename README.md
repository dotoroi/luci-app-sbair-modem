[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[User manuals / 사용자 안내서 / ユーザーマニュアル](docs/MANUALS.md)
[Air 6 router mode / Air 6 ルーターモード / Air 6 라우터 모드](docs/ROUTER-MODE.en.md)

# luci-app-sbair-modem

A LuCI application for the SoftBank Air 6 (RG620T-SBK / RUDOLF), designed for the vendor-modified OpenWrt 21.02.7 firmware. It provides modem status and controls, SIM/eSIM management, APN and SMS functions, Wi-Fi and client management, AP/Bridge and wired WAN modes, USB device information, and OTA/FOTA maintenance.

> This project targets the device vendor's OpenWrt 21.02.7 environment. It is not a general-purpose package for current upstream OpenWrt.

## Features

- Mobile modem status, radio details, SIM/eSIM, SIM lock, IMS, APN, SMS, and reset controls
- Wi-Fi settings and diagnostics
- Connected client list and network mode management
- Device and USB information, plus OTA/FOTA maintenance
- English, Japanese, and Korean LuCI translations
- Optional USB NIC support is experimental and hardware/configuration dependent

Sensitive identifiers are masked by default in the interface.

## Build and install

See the repository documentation for prerequisites, build steps, and installation guidance. In particular:

- [Build and installation guide](docs/INSTALL-NON-CODEX-KO.md)
- [Access and password guidance](docs/INSTALL-ACCESS-KO.md)
- [API and UI reference](docs/API.md)

The translated LuCI catalogs are under `po/`. Build them with LuCI's `po2lmo` using `PO2LMO=/path/to/po2lmo ./tools/build-i18n.sh`, then stage them with `install.sh`.

## License

See [LICENSE](LICENSE).



