# Air Terminal 6 firmware compatibility

Floop3 targets the SoftBank Air 6 (RG620T-SBK / RUDOLF / SBA6D) vendor firmware. It is not a general-purpose package for upstream OpenWrt.

## Firmware metadata observed

| KNOS | OpenWrt | Target | Architecture | Evidence and limitation |
|---|---|---|---|---|
| 0.09.45 | 21.02.7 `r16847-f8282da11e` | `gem6xxx/evb6990_cpe_mt7990_emmc` | `aarch64_cortex-a55_neon-vfpv4` | Read from an existing A-slot SquashFS; vendor SDK `RG620TSBK00AAR03A01G4G_OCPU_BETA20240204` |
| 1.00.22 | same | same | same | Read from an existing B-rootfs extraction; SDK `...OCPU_BETA20240705` |
| 1.01.20 | same | same | same | A recorded comparison found 5,293 matching rootfs entries across two devices; SDK `...QDM064-EA_01.001.01.002_V01` |
| 1.01.44 | same | same | same | Read from a P26 analysis rootfs; same QDM064 SDK identifier |
| 1.01.52 | same | same | same | Read from a P39 analysis SquashFS; same QDM064 SDK identifier. This was an analysis image, not a flash target. |

The prebuilt Go binary is `linux/arm64`, `CGO_ENABLED=0`; the metadata indicates a likely CPU and base ABI match for these images. This is **not** proof that every feature works on each version. Floop3 also depends on `rpcd`/ubus, shell tools, vendor services/configuration, and modem/Wi-Fi drivers.

## Installation scope

- The release installer permits only the exact OpenWrt release, revision, target, architecture, SBA6D board identifiers, and KNOS versions listed in its preflight.
- A matching version is an installation eligibility check, not a functional certification.
- Do not install on a different OpenWrt release, target, CPU architecture, unrecognized KNOS version, non-SBA6 board, or reconstructed/analysis rootfs.
- The 1.01.52 stability record involved an overlay taken from 1.01.20 and included WAPP SIGSEGV and kernel exception logs. It does not prove that stock 1.01.52 alone caused those events, and it is not a stability certification.

Back up the configuration and retain a recovery path before installation. Use a tagged bundle whose `release-manifest.json` source commit matches the release you intend to install. Do not bypass failed preflight checks.
