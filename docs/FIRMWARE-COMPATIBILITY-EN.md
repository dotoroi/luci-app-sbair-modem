# Air Terminal 6 compatibility and firmware notes

Floop3 is for the SoftBank Air 6 (RG620T-SBK / RUDOLF / SBA6D) vendor firmware environment. It is not a general-purpose package for upstream OpenWrt.

## Installer checks

The installer identifies the device using `/etc/knos-config/INPUT_BASE_MODULE=RG620TSBK` and `INPUT_PROJECT=RUDOLF`, and checks that the runtime machine is `aarch64` for the bundled backend. KNOS and OpenWrt release, revision, target, and architecture metadata are displayed for diagnostics; they are not compared against a fixed firmware-version allowlist.

The version values below are historical observations from analyzed images. They are not a support whitelist or a claim that every feature has been tested on every version.

| KNOS observed | OpenWrt metadata observed | Evidence |
|---|---|---|
| 0.09.45 | 21.02.7, `gem6xxx/evb6990_cpe_mt7990_emmc`, ARM64 | Existing A-slot SquashFS; vendor SDK `RG620TSBK00AAR03A01G4G_OCPU_BETA20240204` |
| 1.00.22 | 21.02.7, same target and architecture | Existing B-rootfs extraction; SDK `...OCPU_BETA20240705` |
| 1.01.20 | 21.02.7, same target and architecture | Recorded comparison found 5,293 matching rootfs entries across two devices; SDK `...QDM064-EA_01.001.01.002_V01` |
| 1.01.44 | 21.02.7, same target and architecture | P26 analysis rootfs; same QDM064 SDK identifier |
| 1.01.52 | 21.02.7, same target and architecture | P39 analysis SquashFS; same QDM064 SDK identifier; analysis image, not a flash target |

## Compatibility limits

- A matching Air 6 identity allows the installer to proceed past its model check even when the firmware version is new or absent from the observations above. It does not certify feature behavior on that version.
- The bundled backend is `linux/arm64`, `CGO_ENABLED=0`. The installer checks `uname -m`; vendor RPC methods, shell utilities, modem services, Wi-Fi integration, and configuration can still differ across firmware builds.
- Use only on the identified SoftBank Air 6 vendor environment. Do not install on a different board or generic upstream OpenWrt.
- Back up configuration and keep an independent recovery path. Review the preflight output and test essential LuCI, RPC, Wi-Fi, and network functions after installation.
- The 1.01.52 stability record involved an overlay taken from 1.01.20 and included WAPP SIGSEGV and kernel exception logs. It does not prove that stock 1.01.52 alone caused those events and is not a stability certification.

No stock firmware or device-specific user data is included in the release bundle.
