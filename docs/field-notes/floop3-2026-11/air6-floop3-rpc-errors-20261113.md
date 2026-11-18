# Air6 Floop3 RPC 오류 조사 및 조치

일자: 2026-11-13 (KST)  
대상: `REDACTED_LAN_IP`, SBA6D / Floop3 LuCI

## 결과

고급 메뉴의 RPC 실패를 일으키던 두 줄바꿈 결함을 수정했다. rpcd `sbair` 객체가 등록됐고, Wi-Fi 고급 설정 및 네트워크 진단의 읽기 전용 상태 RPC 12개가 모두 성공 응답했다. 네트워크 설정 적용, Wi-Fi 변경, 재부팅 명령은 실행하지 않았다.

브라우저 탭은 인증 화면이어서 실제 메뉴에서 토스트/오류 문구가 사라졌는지는 아직 화면으로 검증하지 못했다. 브라우저에서 다시 로그인해 고급 설정과 연결 모드/네트워크 진단 페이지를 새로고침할 필요가 있다.

## 발견·수정한 오류

| 상태 | 경로/메서드 | 원인 | 증거와 조치 |
|---|---|---|---|
| 해결 | `/usr/libexec/rpcd/sbair` → ubus 객체 `sbair` 전체 | 장비 스크립트가 CRLF였다. 실행 시 shebang이 `/bin/sh\r`로 해석되어 직접 실행은 `not found`; 셸로 실행해도 마지막 RPC verb에 CR이 붙어 `unknown verb "list\r"` 발생. | 수정 전 ubus에 `sbair` 객체가 없었고 모든 `ubus call sbair ...`가 `Command failed: Not found`. 스크립트를 LF로 정규화하고 rpcd를 재시작했다. Go 바이너리 `sbair-modem rpcd list` 자체는 수정 전에도 정상 동작했다. |
| 해결 | `/usr/sbin/sbair-netmode` → `netmode_status` | 실행 스크립트 및 `apply.sh`, `common.sh`, `state.sh`, `status.sh`가 CRLF였다. `exec`는 존재하는 스크립트도 `fork/exec ... no such file or directory`로 실패했고, `sh` 실행에서도 `PATH\r` 오류가 확인됐다. `usb-lan.sh`는 LF라 수정하지 않았다. | 다섯 파일에서 CR 문자만 제거해 기존 내용을 보존했다. `sbair-netmode version` 직접 실행 및 `netmode_status`가 정상 응답하는 것을 확인했다. |

두 결함의 원본은 다음 overlay 경로에 백업했다.

- rpcd shim: `/overlay/REDACTED_BACKUP_DIR/sbair.before`
- 네트워크 모드 파일: `/overlay/REDACTED_BACKUP_DIR/netmode.before/`

새 rpcd shim SHA-256: `f6b2426856da73632ebc41a3cacd5efa05c193443f3e0666595728017c6646a5`  
정규화된 네트워크 모드 파일의 내용은 각 원본에서 CR 문자만 제거했다. `sbair-netmode` LF 해시는 `48f82c2fa72c298122a8237929f6412559a25c4b8f9d00f266396ad72525c794`.

## 검증 결과

수정 후 `ubus list`에 `sbair`가 한 개 등록됐다. 다음 상태 호출은 모두 JSON 오류 필드 없이 성공했다.

- Wi-Fi 고급: `wifi_enabled_status`, `bandsteering_status`, `mlo_status`, `mesh_status`, `isolation_status`, `wifi_11r_status`, `macfilter_status`, `wps_status`
- 관련 상태/진단: `wifi_status`, `netmode_status`, `netmode_netdev_status`, `usb_status`

프런트엔드 `wifi_advanced.js`가 선언하는 23개 메서드는 저장소 ACL에 모두 존재한다. 변경 요청 계열의 RPC는 실제 설정을 바꿀 수 있어 실행하지 않았다.

## 상태 초기화 영향

`/etc/config/sbair`는 최초 조회 전 존재하지 않았다. `netmode_status`의 `show` 경로는 `ensure_config`를 호출해 앱 기본 상태를 생성하므로, 조회 결과로 다음 설정이 새로 생성됐다: `mode=sim`, `managed=0`, 관리 프로토콜 DHCP, 기본 fallback 값. 현재 응답은 `mode=unmanaged`, `managed=false`다. 이 초기화 함수는 `network`, `wireless`, `firewall`을 수정하거나 네트워크를 재시작하지 않는다. 장비 재부팅은 하지 않았다.

## 남은 확인 / 오류 목록

1. **실제 LuCI 화면 확인 — 미완료:** 브라우저가 로그인 화면이라 로그인 세션 안에서 두 페이지를 재확인하지 못했다. 서버 측 객체와 상태 RPC는 정상이다.
2. **쓰기 RPC — 의도적으로 미실행:** 밴드 스티어링/MLO/메시/필터 변경은 실제 무선 설정을 바꾸므로 검증하지 않았다.
3. **영구 설치 경로의 줄바꿈 재발 방지 — 점검 필요:** 이번 수정은 실기기 파일을 복구했다. 이후 Windows에서 배포/압축 해제하는 절차가 다시 CRLF로 바꾸지 않는지 빌드·전송 절차에 LF 검사(예: shebang 및 shellcheck/CR 검사)를 추가해야 한다.

이 시점에서 확인된 RPC 메서드 등록/호출 오류는 해결됐다. 1번은 UI 표시 검증 상태이며, 현재 확인된 서버 측 RPC 실패는 없다.


