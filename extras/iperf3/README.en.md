# Air6 iperf3 installer

[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

`air6-install-iperf3.sh` downloads `iperf3` and only its missing direct userspace dependencies from the official OpenWrt 21.02.7 `aarch64_generic` feed on a Mac host, verifies SHA256, and transfers local IPK files to the Air 6 over SSH. The router itself does not download packages. DNS, routes, gateway, DHCP, LAN, Wi-Fi, cellular WAN, LuCI, SSH, and FOTA settings are not changed.

## Commands

```sh
./extras/iperf3/air6-install-iperf3.sh install <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh check <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh start <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh stop <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh test <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh diagnose <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh experiment <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh rollback <AIR6_IP>
```

You may set `AIR6_HOST`, `AIR6_USER` (default `root`), and `AIR6_SSH_PORT` (default `22`) instead. The Air 6 address has no default. Password prompts use SSH; Homebrew, Python, jq, and sshpass are not required.

## Package and safety checks

The documented feed check found `iperf3 3.10.1-1`, architecture `aarch64_generic`, depending on `libc`. If a core dependency such as `libc` is missing, the script stops; it will not replace or upgrade it. It verifies the official package metadata and SHA256 on the host and, when available, again on the router. Temporary opkg architecture additions apply only to the command and do not alter persistent feed/architecture configuration.

The installer refuses unsafe dry-run plans involving upgrade, downgrade, removal, core/vendor ABI changes, kernel/kmod changes, or vendor packages. It never runs `opkg update/upgrade`, adds an init service, or reboots. `start` opens TCP/5201 temporarily from `br-lan` only; `stop` removes only the exact rule it added. No persistent firewall, network, Wi-Fi, or boot settings are written.

## Tests and interpretation

`test` measures directly between the host and the Air 6's local iperf3 server, not through OMV, SMB, storage, or an Ethernet relay. `diagnose` compares one server with parallel streams and independent server processes, performs TCP/UDP tests, and records CPU, interrupts, softirqs, softnet, interface counters, temperature/frequency, and queue settings. `experiment` additionally tests reversible RPS, backlog, and high-confidence IRQ affinity tuning; `rollback` restores a saved snapshot after interruption.

Tuning is temporary. The script avoids persistent sysctl/init/firewall changes, Wi-Fi configuration, CPU/thermal settings, MTU, offload settings, and package upgrades. It snapshots tunables before writing and verifies restoration. If a snapshot remains, run `rollback`.

A local test measures `host Wi-Fi → Air6 kernel → Air6 iperf3 userspace`. It is not the same as AP forwarding (`host Wi-Fi → Air6 bridge/vendor datapath → external server`). An optional reference host can compare another path without changing router networking. Keep results separate and do not make permanent tuning changes until measurements are repeatable.

