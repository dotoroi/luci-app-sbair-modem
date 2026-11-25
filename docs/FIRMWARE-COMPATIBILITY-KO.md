# Air Terminal 6 호환성 및 펌웨어 참고

Floop3는 SoftBank Air 6(RG620T-SBK / RUDOLF / SBA6D) 제조사 펌웨어 환경용입니다. 일반 upstream OpenWrt용 범용 패키지가 아닙니다.

## 설치기가 확인하는 항목

설치기는 `/etc/knos-config/INPUT_BASE_MODULE=RG620TSBK`와 `INPUT_PROJECT=RUDOLF`로 기기를 식별하고, 동봉 백엔드 실행을 위해 `uname -m`이 `aarch64`인지 확인합니다. KNOS 및 OpenWrt 릴리스·revision·target·architecture 정보는 진단용으로 표시하며, 고정된 펌웨어 버전 허용 목록과 대조하지 않습니다.

아래 버전은 분석한 이미지에서 확인한 과거 관찰 기록입니다. 지원 버전 허용 목록이나 각 버전의 모든 기능을 검증했다는 뜻이 아닙니다.

| 관찰한 KNOS | 관찰한 OpenWrt 정보 | 근거 |
|---|---|---|
| 0.09.45 | 21.02.7, `gem6xxx/evb6990_cpe_mt7990_emmc`, ARM64 | 기존 A 슬롯 SquashFS; vendor SDK `RG620TSBK00AAR03A01G4G_OCPU_BETA20240204` |
| 1.00.22 | 21.02.7, 같은 target·architecture | 기존 B rootfs 추출본; SDK `...OCPU_BETA20240705` |
| 1.01.20 | 21.02.7, 같은 target·architecture | 두 기기 rootfs에서 5,293개 항목이 일치했다는 비교 기록; SDK `...QDM064-EA_01.001.01.002_V01` |
| 1.01.44 | 21.02.7, 같은 target·architecture | P26 분석용 rootfs; 같은 QDM064 SDK 식별자 |
| 1.01.52 | 21.02.7, 같은 target·architecture | P39 분석용 SquashFS; 같은 QDM064 SDK 식별자. 분석 이미지이며 플래시 대상이 아님 |

## 호환성의 한계

- Air 6 기기 식별값이 일치하면 위 관찰 기록에 없는 신규·미확인 펌웨어도 기기 검사를 통과합니다. 각 기능의 동작까지 보증하지는 않습니다.
- 동봉 백엔드는 `linux/arm64`, `CGO_ENABLED=0`입니다. 설치기는 `uname -m`을 확인하지만 vendor RPC, 셸 도구, 모뎀 서비스, Wi-Fi 연계, 설정 구조는 펌웨어 빌드에 따라 달라질 수 있습니다.
- 식별된 SoftBank Air 6 제조사 환경에서만 사용하세요. 다른 보드나 일반 upstream OpenWrt에 설치하지 마세요.
- 설정을 백업하고 독립된 복구 경로를 확보하세요. 사전 검사 출력을 확인하고 설치 후 LuCI, RPC, Wi-Fi, 네트워크 주요 기능을 점검하세요.
- 1.01.52 안정성 기록은 1.01.20에서 가져온 overlay를 섞은 시험이었고 WAPP SIGSEGV와 커널 예외 로그가 포함됩니다. 순정 1.01.52만의 원인으로 확인된 것도, 안정성 인증 자료도 아닙니다.

순정 펌웨어와 기기별 사용자 데이터는 릴리스 번들에 포함하지 않습니다.
