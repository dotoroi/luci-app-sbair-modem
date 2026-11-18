# Install Floop3 without Codex

[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

This guide builds Floop3 from a regular Linux/macOS/WSL terminal and installs it on Air Terminal 6. Codex features and a remote repository account are not required.

## Requirements

- LuCI, rpcd, ubus, and uci must already work on the SoftBank Air 6.
- The host needs Git, Bash, Go 1.25+, Python 3, ssh, tar, and sha256sum.
- Root SSH access is required; key authentication is recommended.
- Installation restarts LuCI's rpcd but does not reboot the router. Back up configuration first.
- The installer stops rather than overwriting an unrecognized `/usr/sbin/sbair-netmode` implementation.

Floop3 is intended for vendor OpenWrt 21.02.7 when its vendor MT-WiFi integration is needed. Do not install it on current upstream OpenWrt by default.

If stock vendor OpenWrt 21.02.7 has no LuCI, first follow [the optional LuCI bootstrap guide](../extras/luci-bootstrap/README.md). It adds LuCI without modifying/replacing the MT-WiFi driver and preserves vendor ABI. Skip bootstrap if LuCI is already installed. Do not use its pinned package set on another release or SNAPSHOT.

## Build and install

Clone the official source and build it:

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
./tools/check-i18n.sh
```

`./build.sh` uses `po2lmo` when installed, otherwise the bundled Python 3 converter. Set `PO2LMO=/path/to/po2lmo` if needed. The output should include `out/sbair-modem` and Japanese/Korean `.lmo` catalogs. English uses source messages.

Deploy to the device's current LAN address:

```sh
bash tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

The deploy script checks root SSH, Air 6 model, LuCI, and free overlay space. It saves configuration and existing Floop3 paths under `/root/sbair-backups/floop3-preinstall-<UTC timestamp>/`, transfers required files over SSH, and runs `install.sh /`. The device needs no package-feed Internet connection and is not automatically rebooted.

For extra SSH options, use `~/.ssh/config` or set `AIR6_SSH_OPTS`:

```sh
AIR6_SSH_OPTS='-o ConnectTimeout=5' bash tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

After installation, open `http://<AIR6_LAN_IP>/cgi-bin/luci/`. The app is under **Services → SoftBank Air 6**. Choose English, 한국어, or 日本語 under **System → Language and Style**.

## Security and recovery

The installer does not create/change the root password or SSH authentication. Set a unique strong root password and prepare SSH keys. Do not expose SSH or the HTTP management interface directly to the public WAN; administer from a trusted local network.

Keep the backup path printed by the installer if an error occurs. `before-install.tar.gz` contains copies of existing settings and installation paths. Do not reset networking/firewall. Review and restore selected files using an available SSH/UART management path. Temporary diagnostic files may remain under `/tmp/floop3-deploy-*` after failure.

Run these scripts on WSL, Linux, or macOS. On Windows, use a WSL terminal and navigate to the project directory.

