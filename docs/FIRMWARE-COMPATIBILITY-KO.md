# Air Terminal 6 펌웨어 호환성 및 사전 빌드 바이너리 범위

기준일: 2026-11-23

## 확인한 펌웨어 메타데이터

| KNOS | OpenWrt | 타깃 | 아키텍처 | 근거 및 한계 |
|---|---|---|---|---|
| 0.09.45 | 21.02.7 `r16847-f8282da11e` | `gem6xxx/evb6990_cpe_mt7990_emmc` | `aarch64_cortex-a55_neon-vfpv4` | 기존 A 슬롯 SquashFS에서 읽음; SDK `RG620TSBK00AAR03A01G4G_OCPU_BETA20240204` |
| 1.00.22 | 21.02.7 `r16847-f8282da11e` | 동일 | 동일 | 기존 B rootfs 추출본; SDK `...OCPU_BETA20240705` |
| 1.01.20 | 21.02.7 `r16847-f8282da11e` | 동일 | 동일 | 두 기기 rootfs의 5,293개 항목이 일치했다는 비교 기록; SDK `...QDM064-EA_01.001.01.002_V01` |
| 1.01.44 | 21.02.7 `r16847-f8282da11e` | 동일 | 동일 | P26 분석용 rootfs에서 확인; 같은 QDM064 SDK 식별자 |
| 1.01.52 | 21.02.7 `r16847-f8282da11e` | 동일 | 동일 | P39 분석용 SquashFS에서 확인; 같은 QDM064 SDK 식별자. 분석용 이미지이므로 플래시 대상이 아님 |

따라서 현재 Go 산출물(`linux/arm64`, `CGO_ENABLED=0`)은 이 다섯 순정 KNOS 이미지의 **CPU/기본 OpenWrt ABI 계열과 일치할 가능성이 높습니다.** 하지만 이것만으로 전체 앱의 기능 호환성을 확정할 수 없습니다. Go 바이너리 외에도 `rpcd`/ubus, 셸 유틸리티, vendor 서비스·설정 파일, 무선·모뎀 드라이버를 함께 사용합니다. 현재 기록에는 각 버전에서 Floop3 전체 기능을 동일 조건으로 시험한 결과가 없습니다.

## 버전별 운용 판단

- **사전 빌드 경로 허용 후보:** 위 다섯 KNOS 버전, 정확한 OpenWrt revision/target/architecture와 `SBA6D` 보드 식별까지 모두 맞는 순정 계열 장치.
- **기능 보증 상태:** `UNVERIFIED` — 메타데이터/소스 구조 비교이지 버전별 전체 기능 시험은 아님.
- **1.01.52 주의:** 기록된 약 53분 런타임은 1.01.20에서 가져온 overlay와 섞은 시험 상태였고 WAPP SIGSEGV 및 커널 예외 기록이 있다. 이를 순정 1.01.52 단독의 원인으로 단정할 수 없지만 안정성 보증 근거로도 사용할 수 없다.
- **거부 대상:** 다른 OpenWrt 릴리스·revision, 다른 target/CPU, 확인되지 않은 KNOS 버전, 비-SBA6 보드, 분석용/재구성 rootfs 이미지.
- 이 앱은 임의의 upstream OpenWrt를 위한 범용 패키지가 아니다. 현재 검사 통과는 설치 적합성의 일부 조건이며, 안전성·기능 보증이 아니다.

## 릴리스 설치기의 필수 사전 검사

배포 스크립트는 장치에 쓰기 전에 다음을 확인하고 결과를 보여줘야 한다.

1. root 권한 SSH, `SBA6D` 보드, LuCI/rpcd/ubus/uci 존재.
2. `DISTRIB_RELEASE`, `DISTRIB_REVISION`, `DISTRIB_TARGET`, `DISTRIB_ARCH`의 정확한 허용값.
3. `/etc/knos-config/INPUT_VERSION`이 허용 목록 중 하나인지 확인.
4. `/overlay` 여유 공간, 설치 묶음 체크섬, manifest의 버전·아키텍처.
5. 검사를 통과해도 자동 재부팅하지 않고, 변경 전 백업과 설치 후 readback을 남김.

이 체크아웃에는 위 검사를 수행하는 호스트 설치/배포기가 아직 없다. 따라서 현재 생성하는 릴리스 묶음은 **검토용 초안**이며, 자동 원격 설치를 지원한다고 광고하면 안 된다.

## 근거 자료

작업 PC의 로컬 증거 파일:

- `air6-account-evidence/slot-ab-version-comparison-20261113.md`
- `air6-account-evidence/current-device-101/1.01.20-cross-device-text-diff.md`
- `air6-account-evidence/current-device-3.1-20261118-0.09.45/comparison-to-legacy-0.09.45.md`
- `air6-account-evidence/current-device-3.1-20261117/a-slot-1.01.52-runtime-stability-20261118.md`
- `air6-account-evidence/sanitized-P25-P26-inspect-20261118/p26-1.01.44/`
- `SBA6D-stock-firmware-sanitized-20261116/SANITIZATION-REPORT.md` 및 P39 분석 이미지의 SquashFS 메타데이터

원본 eMMC/펌웨어 이미지는 GitHub 릴리스에 포함하지 않는다. 라이선스와 장치별 민감정보 문제가 있기 때문이다.
