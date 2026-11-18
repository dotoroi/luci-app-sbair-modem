# Floop3 이전 기기 → 새 기기 이식 실패 검토

일자: 2026-11-13 (KST)

## 요약

이전 기기에서 성공한 작업을 그대로 옮긴 것으로 보기 어렵다. 11월 11일 성공 검증은 Floop3 commit `5a00fb83`의 staging tar를 사용했고, 해당 tar의 RPC shim과 네트워크 모드 셸 파일은 LF였다. 당시 검증도 로그인, 네트워크 진단 페이지/JS HTTP 200, `sbair` ubus 객체, `netmode_netdev_status` 한 메서드 JSON 응답에 한정됐다. 모든 메뉴와 모든 RPC를 검증한 기록은 없다.

현재 `REDACTED_LAN_IP`에는 수정된 로컬 포크의 파일들이 설치돼 있었다. 파일 개수/내용/줄바꿈 모두 이전 검증 tar와 같지 않았다. 저장소에는 11월 11일의 LF 정규화 staging 절차가 남아 있었지만 새 기기 배포에는 동일한 결과물 검증이 적용되지 않은 것으로 보인다. 실제 새 기기 배포 명령 기록은 없어 마지막 전송 경로 자체는 확정하지 않는다.

## 실패 원인 2건

1. **rpcd 진입점 줄바꿈 결함:** 장비 `/usr/libexec/rpcd/sbair`가 CRLF여서 rpcd가 `sbair` 객체를 등록하지 못했다. 이 때문에 고급 메뉴 전체의 RPC가 `Command failed: Not found`로 실패했다. 파일을 LF로 바꾸고 rpcd를 재시작한 뒤 객체와 메서드가 나타났다.
2. **네트워크 상태 헬퍼의 줄바꿈 결함:** `/usr/sbin/sbair-netmode` 및 `apply.sh`, `common.sh`, `state.sh`, `status.sh`가 CRLF였다. `netmode_status`는 파일이 존재하는데도 shebang 실행 불가로 `fork/exec ... no such file or directory`를 반환했다. CR 문자만 제거해 실행을 복구했다.

두 현상은 같은 결함 계열(CRLF 실행/소스 오류)이지만 별도 호출 경로라 독립적으로 발견됐다. 현재 저장소의 해당 네트워크 모듈 4개도 CRLF이며 `install.sh`는 파일을 단순 복사한다. 설치 전 LF 검사가 없으면 재발할 수 있다. rpcd shim은 현재 로컬 저장소에서는 LF지만 새 기기 초기 파일은 CRLF였다. 그 파일의 정확한 변환 경로는 기록되지 않았다.

## 실패 횟수 집계 — 이번 RPC 조사 세션

세는 단위에 따라 숫자가 다르므로 원인과 호출을 분리한다.

- **독립된 장비 결함:** 2건.
- **유효한 이름의 RPC 실패 호출:** 최소 17회 관찰됨. `sbair` 객체 부재로 발생한 8개 Wi-Fi 고급 상태 호출이 두 번(16회) `Not found`를 받았고, 객체 등록 후 `netmode_status`가 헬퍼 실행 오류 1회를 반환했다.
- **조사 도구에서 발생한 무효 호출:** 8회. PowerShell이 원격 셸 변수 `$m`을 먼저 확장해 빈 메서드명을 보냈다. 앱 동작 실패로 셀 수 없으며, 조사자 측 명령 구성 오류다.
- **잘못된 진단 명령/프로세스:** `sbair-modem rpcd call overview {}`를 잘못 호출해 종료되지 않는 진단 프로세스가 생겼고, `rpcd -h`는 도움말 옵션으로 종료할 거라 잘못 가정해 불필요한 rpcd 프로세스를 시작했다. 두 프로세스는 확인 후 종료했다. 이 과정은 추가 지연과 혼선을 만들었다.
- **해결 후 확인:** Wi-Fi 고급 8개와 관련 상태/진단 4개, 총 12개 읽기 전용 RPC가 모두 오류 없이 응답했다.

17회는 이번 세션에서 출력으로 확인된 이름 있는 RPC 실패의 하한이다. 사용자가 앞서 UI에서 본 오류 횟수와 과거 채팅에서 발생한 수는 로그가 없으므로 합산할 수 없다.

## 이전 성공물과 현재 설치물 비교

- 이전 설치 기록: `validation/installation-result.md`. 명시적으로 CRLF 정규화, staging tar 생성, 최소 검증을 수행했다.
- 보존된 이전 앱 tar `validation/artifacts/floop3-app.tar.gz`: `/usr/libexec/rpcd/sbair` 및 포함된 셸 파일은 LF다. 이전 tar의 helper/modules는 현재 포크의 helper/modules와 크기/해시가 다르다. 즉 현재 버전은 동일 바이너리/파일을 단순 재복사한 것이 아니다.
- 새 기기 초기 파일은 여러 실행/소스 파일이 CRLF였고, 일부 네트워크 모듈은 CR 문자를 제거한 뒤에도 현재 로컬 파일과 해시가 달랐다. 줄바꿈 결함과 코드 버전 불일치가 함께 존재했다.
- 새 기기 배포 로그/manifest에 최종 파일 해시가 남지 않아 어느 작업 트리/스테이징 산출물에서 각 파일이 왔는지 완전히 재구성할 수 없다.

## 추가 영향

오류 수정 후 `netmode_status`의 `show` 경로가 앱 기본 `/etc/config/sbair`를 생성했다. 현재 `managed=0`, `mode=sim`의 비관리 기본 상태다. 네트워크/Wi-Fi/firewall 적용과 재부팅은 하지 않았다. 원본 파일은 `/overlay/REDACTED_BACKUP_DIR/`에 백업돼 있다.

## 다음 배포부터 막을 조치

1. Windows 작업 트리에서 장비로 개별 스크립트를 바로 복사하지 않고 Linux/WSL staging tree에서 패키지를 만든다.
2. shebang 파일뿐 아니라 `/usr/libexec/rpcd/*` 실행 진입점과 `/usr/libexec/sbair/**/*.sh` 소스까지 CR 문자를 검사한다.
3. staging manifest에 파일별 SHA-256, 크기, 실행 권한을 기록하고, 설치 후 장비 해시와 대조한다.
4. 설치 후 첫 화면 열기 전에 `ubus list sbair`, `ubus -v list sbair`, read-only status RPC들을 시험한다. 성공은 UI 전체 검증이 아니라 해당 단계의 범위로만 기록한다.
5. 이전 장비에서 성공한 변경을 새 기기에 옮길 때 커밋/소스 트리/산출물 manifest가 같을 때만 “동일 이식”이라고 부른다.


