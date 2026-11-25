# Floop3 릴리스 설치 정책

## 대상 기기

Floop3는 SoftBank Air Terminal 6(SBA6D, RG620T-SBK / RUDOLF) 제조사 펌웨어용입니다. 설치기는 `/etc/knos-config/INPUT_BASE_MODULE=RG620TSBK`와 `INPUT_PROJECT=RUDOLF`로 기기 모델을 확인하고, ARM64 백엔드 실행을 위해 `uname -m=aarch64`인지 검사합니다.

KNOS 및 OpenWrt 릴리스·revision·target 버전은 진단 정보로 표시할 뿐, 고정된 허용 목록으로 설치를 막지 않습니다. 알려진 빌드의 메타데이터와 관찰 기록은 [펌웨어 참고 문서](FIRMWARE-COMPATIBILITY-KO.md)에 적혀 있습니다. 이 기록은 모든 펌웨어 버전에서 기능이 검증됐다는 뜻이 아닙니다. 다른 모델, 일반 upstream OpenWrt, aarch64가 아닌 기기에는 설치하지 않습니다.

## 설치 전 준비

1. 기기 모델, KNOS/OpenWrt 정보, 활성 슬롯, LAN 주소를 기록합니다. 버전은 사전 차단 조건이 아니라 설치 후 차이를 조사할 진단 자료입니다.
2. 새 SSH 세션과 LuCI 접속을 확인하고, 별도 복구 경로를 준비합니다.
3. 네트워크·방화벽 설정과 기존 앱·서비스·부팅 링크, 번역 파일, `/etc/sbair`를 보관합니다. 설치 전 체크섬과 설치기 `--check` 결과를 기록합니다.
4. `/overlay` 여유 공간이 최소 24 MiB인지 확인하고, 미적용 방화벽 변경이 있으면 먼저 검토합니다.
5. 기존 설치를 업그레이드할 때 기존 `sbair-netmode`의 소유권과 동작을 확인합니다. 확인되지 않은 기존 helper를 덮어쓰지 않습니다.

## 사후 확인

- 설치 직후: 새 SSH 세션, 순정 UI, LuCI 로그인, Floop3 메뉴와 `ubus call sbair overview` 응답을 확인합니다.
- 기능: 모뎀 상태 조회, 무선 대역·MLO 상태, LAN 주소·DHCP, 선택 언어의 전용 메뉴를 확인합니다. SIM 망 등록은 별도 결과로 기록합니다.
- 재부팅: 시험 기기에서 UART 로그를 최소 120초 관찰하고 SSH·LuCI·RPC 및 서비스 자동 시작을 확인합니다.
- 복구: 백업에서 이전 파일을 복원한 뒤 SSH, LuCI, LAN 동작을 확인합니다.

새 펌웨어 빌드는 기기 모델 검사를 통과할 수 있지만, vendor RPC·모뎀·Wi-Fi·부팅 구성 차이 때문에 기능이 달라질 수 있습니다. 새 빌드에 설치할 때는 복구 경로를 유지하고 주요 기능을 직접 확인한 뒤 결과를 문서에 추가합니다.
