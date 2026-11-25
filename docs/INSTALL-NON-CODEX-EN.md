# Install Floop3 without Codex

[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

This guide builds Floop3 from a regular Linux/macOS/WSL terminal and installs it on Air Terminal 6. Codex features and a remote repository account are not required.

## Recommended work setup: UART console

Before the first install or any network/firewall change, **we strongly recommend keeping a UART console connected**. Floop3 installation restarts rpcd but does not reboot the router. If LuCI or SSH becomes unavailable, UART provides an independent way to observe boot/service logs and attempt recovery. Keep capturing the UART log during installation and the first access check.

Recommended setup: a Windows 11 host with WSL2 Ubuntu LTS. Use the WSL terminal for source checkout, Go builds, translation checks, and SSH deployment; keep the repository in the WSL Linux filesystem (for example, `~/src/floop3`), not under `/mnt/c`. Connect the USB-UART adapter to Windows and open its COM port in a Windows serial terminal such as PuTTY or Tera Term. Use 115200 baud, 8N1, no flow control, and enable raw log capture. A native Ubuntu PC with a serial terminal is also suitable.

The Air 6 UART material currently includes a user-reported 1.8 V logic measurement, but the header's TX/RX/GND pin order has not been confirmed. **Use a 1.8 V-compatible adapter or a proper level shifter, and verify the pinout and voltage from device-specific information and measurements before connecting. Do not connect a 3.3 V adapter directly or apply power to the UART VCC pin.**

This procedure does not rebuild or flash Air 6 firmware. Tagged releases can include a prebuilt Go backend and installation bundle. The installer checks the SoftBank Air 6 board identity and an `aarch64` runtime, but does not restrict KNOS or OpenWrt version numbers. Feature behavior has not been validated on every firmware build.

## Requirements

- LuCI, rpcd, ubus, and uci must already work on the SoftBank Air 6.
- The host needs Git, Bash, Go 1.25.5 or later, Python 3, ssh, tar, and sha256sum.
- Root SSH access is required; key authentication is recommended.
- Installation restarts LuCI's rpcd but does not reboot the router. Back up configuration first.
- The installer stops rather than overwriting an unrecognized `/usr/sbin/sbair-netmode` implementation.

Floop3 targets the SoftBank Air 6 vendor firmware environment and relies on vendor MT-WiFi integration. The installer identifies the Air 6 board and ARM64 runtime rather than enforcing a fixed firmware version. Do not install it on generic upstream OpenWrt.

If stock vendor OpenWrt 21.02.7 has no LuCI, first follow [the optional LuCI bootstrap guide](../extras/luci-bootstrap/README.md). It adds LuCI without modifying/replacing the MT-WiFi driver and preserves vendor ABI. Skip bootstrap if LuCI is already installed. Do not use its pinned package set on another release or SNAPSHOT.

## Build and install

Clone the official source and build it:

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
```

`./build.sh` builds the Go backend (`out/sbair-modem`) and the Japanese and Korean LuCI catalogs. English uses the source strings.

### Native Windows build (without WSL)

Install Go 1.25.5 or later from [go.dev/dl](https://go.dev/dl/) and ensure its `go/bin` directory is on `PATH`. Install Git for Windows from [git-scm.com](https://git-scm.com/download/win). Use **Git Bash** for the project scripts; it supplies the POSIX-compatible shell and tools they need. Install Python 3 and make `python3` or `python` available in Git Bash. Packaging defaults to `python3`; set `PYTHON3=python` if that is the command your Python installation provides.

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
./tools/package-release.sh vX.Y.Z
```

If the Python command is named `python` rather than `python3`, use `PYTHON3=python ./tools/package-release.sh vX.Y.Z`. The package command rebuilds the backend and creates `out/release/floop3-vX.Y.Z-air6-linux-arm64.tar.gz` plus its `.sha256` file. Replace `vX.Y.Z` with the release tag. Confirm `go version`, the available Python command's `--version`, and `git status --short` in Git Bash first. PowerShell alone does not provide the POSIX shell commands used by these scripts.

For a prebuilt bundle, download the `.tar.gz` and its `.sha256` file from the tagged GitHub release. On the host, verify and inspect the archive:

```sh
sha256sum -c floop3-<version>-air6-linux-arm64.tar.gz.sha256
tar -xzf floop3-<version>-air6-linux-arm64.tar.gz
cd floop3-<version>-air6-linux-arm64
sha256sum -c SHA256SUMS
```

Check that `release-manifest.json` names the release version and source commit you intend to install. Then copy the archive to the router and run its own preflight before installation:

```sh
cd ..
scp -O floop3-<version>-air6-linux-arm64.tar.gz root@<AIR6_LAN_IP>:/tmp/
ssh root@<AIR6_LAN_IP>
cd /tmp
tar -xzf floop3-<version>-air6-linux-arm64.tar.gz
cd floop3-<version>-air6-linux-arm64
sha256sum -c SHA256SUMS
sh ./install.sh --check
sh ./install.sh /
```

The installer refuses a non-Air-6 board identity, a non-`aarch64` runtime, pending firewall changes, unknown network-helper ownership, or less than 24 MiB free on `/overlay`. KNOS and OpenWrt version values are shown for diagnostics and are not allowlisted. Resolve any failed check before installing.

For a source build, use Go 1.25.5 or later, run `./build.sh`, then use `tools/deploy-floop3.sh` for its checked installation flow. Do not copy only the Go binary when the UI and catalogs come from a different source revision.

After installation, open `http://<AIR6_LAN_IP>/cgi-bin/luci/`. The app is under **Services → SoftBank Air 6**. Choose English, 한국어, or 日本語 under **System → Language and Style**.

## Security and recovery

The installer does not create/change the root password or SSH authentication. Set a unique strong root password and prepare SSH keys. Do not expose SSH or the HTTP management interface directly to the public WAN; administer from a trusted local network.

The installer does not create a configuration backup. Save a LuCI configuration backup and keep UART or another management path available before installing. If installation fails, do not reset networking/firewall; inspect logs and changed files over SSH/UART.

Run these scripts in Git Bash on Windows, or in a terminal on Linux/macOS. WSL is optional when using native Windows Go with Git Bash.
