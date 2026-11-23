# Floop3 설치 흐름 재검증 — 2026-11-16

## 범위

KO/JA Floop3 앱 설치기와 `extras/luci-bootstrap`을 소스 기준으로 점검했다. 실제 공유기에는 연결하거나 파일을 설치하지 않았다.

## 설치 흐름

적용 기준을 분리한다. Floop3 앱은 vendor OpenWrt 21.02.7의 vendor MT-WiFi 연계 기능이 필요한 경우를 위한 것이며, 최신 OpenWrt에는 설치하지 않는 것이 기본이다. LuCI bootstrap은 이 vendor 환경에서 LuCI가 없는 경우에만 Floop3보다 먼저 실행하는 보조 단계다. 이미 LuCI가 있는 vendor 환경에서는 bootstrap만 생략한다. 다른 release/SNAPSHOT에는 bootstrap의 고정 manifest를 적용하지 않는다. Bootstrap 자체는 MT-WiFi 드라이버를 수정하지 않는다.

### 1. LuCI bootstrap

1. 호스트 설치기가 SBA6 대상/버전·아키텍처를 확인하고, 고정 `packages.lock`의 공식 패키지를 다운로드해 SHA-256을 검증한다.
2. target은 플랫폼, LAN 주소 일치, staging package 존재, 기존 vendor libnl을 검사한다.
3. `opkg --noaction` 계획에서 제거·다운그레이드·보호된 vendor ABI 업데이트를 거부한다.
4. 설치 전에 package 목록과 설정 백업을 남기고, 고정 패키지를 설치한다.
5. OpenWrt libnl은 vendor `libnl-tiny.so.1`을 교체하지 않고 별도 추출·ABI 확인 후 배치한다.
6. LuCI는 8080에 구성하고 firewall은 `br-lan`에서 TCP/8080만 허용한다. 재부팅은 하지 않는다.
7. `--check`는 런타임 LuCI, 포트, 방화벽, LAN IP 및 KO/JA 기본 카탈로그를 확인한다.

### 2. Floop3 앱 설치기

1. 셸 LF 검사를 실행하고 빌드 산출물/KO·JA LMO 존재를 확인한다.
2. 대상 `sbair-netmode`가 현재/명시된 이전 앱 버전인지 검사하고, 모르는 소유자의 helper는 덮어쓰지 않는다.
3. Go 바이너리, RPC shim·ACL, LuCI 페이지, helper, 언어 카탈로그를 복사하고 mode를 설정한다.
4. 서비스 symlink, sysupgrade keep-list, 기본 vendor 설정을 설치한다.
5. 실기기 설치는 `en/ja/ko` 선택지를 보존 방식으로 등록하고, LMO 설치 상태·rpcd 재시작·`ubus` sbair 객체 등록을 확인한다.
6. 네트워크 모드 적용이나 재부팅은 하지 않는다.

## 이번에 고친 점

- bootstrap 백업이 실패해도 진행하던 동작을 막았다. 백업 경로는 0700, 백업 파일은 0600으로 보호하며 package 목록, 존재하는 설정 경로, tar archive 무결성 및 기존 libnl 백업을 확인한다. 백업 실패 시 package 설치 전에 중단한다.
- `packages.lock`을 LF로 고정하고 공통 LF 검사기에 추가했다. 이 파일의 CRLF는 마지막 필드에 CR을 붙여 `special-libnl` 역할을 못 알아보게 할 수 있으므로 검사 대상이어야 한다.
- Floop3 실기기 설치는 `uci`/`ubus` 누락, locale 등록·저장 실패, 앱 카탈로그 누락, rpcd 재시작 실패, `sbair` 객체 미등록 시 완료로 보고하지 않도록 했다.
- 설치 fixture가 더 이상 UI 번역 문장을 JavaScript에 직접 하드코딩하길 기대하지 않도록 고쳤다. 기존 부모 revision helper를 무조건 앱 소유로 간주하던 fixture도 exact-hash fail-closed 정책에 맞췄다.

## 검증 결과

- `bash -n`: 앱 설치기와 bootstrap target/check 스크립트 통과.
- `tools/check-shell-lf.sh`: 통과.
- `tests/install-fixture.sh`: 통과 (`install-fixture-ok`).
- `tools/check-i18n.sh`: 전체 JS/protocol/menu gettext 및 KO/JA 카탈로그 검사 통과.
- `git diff --check`: 통과.
- bootstrap KO/JA `.ipk` 파일 해시는 OpenWrt 21.02.7 공식 파일과 일치 확인.

## 남은 위험 / 미실행

1. **자동 롤백은 없다.** Floop3는 설치 중간 실패 시 이미 복사한 파일과 설정을 자동 복원하지 않는다. bootstrap은 백업을 만들지만 opkg 설치 후 libnl/서비스 설정이 실패해도 전체 package/config 자동 복원을 하지 않는다. 백업은 수동 복구 자료다.
2. Floop3 설치기는 rpcd 객체를 검사하지만 브라우저 실제 화면, HTTP 메뉴 로딩, 개별 읽기 전용 RPC까지 모두 확인하지 않는다. bootstrap `--check`는 LuCI HTTP를 확인하지만 Floop3 메뉴 검증은 별도다.
3. Floop3 바이너리의 architecture·source commit/hash는 설치기에서 검사하지 않는다. 설치 전에 Go 바이너리를 다시 빌드하고 manifest를 남겨야 한다.
4. Floop3의 일부 보조 init 서비스 enable/start 호출은 best-effort로 오류를 무시한다. rpcd 핵심 등록 실패는 이제 잡지만 보조 서비스 상태는 설치 완료 후 별도 확인이 필요하다.
5. `opkg` dependency dry-run은 장비의 실제 package database 기준이므로 이번에는 실행하지 않았다. 실제 설치 전 `--dry-run`을 반드시 수행해야 한다.

## 권장 배포 순서

1. 대상 IP로 bootstrap `--dry-run` 실행 후 opkg 계획과 백업 여유 공간 검토.
2. 승인된 실제 bootstrap 설치와 `--check`.
3. Floop3 Go 바이너리를 현재 소스에서 재빌드, 해시 기록, LF/i18n 검사.
4. Floop3 설치 후 `ubus list sbair`, 읽기 전용 상태 RPC, 8080 페이지, Language and Style의 `en/ko/ja` 및 Floop3 전용 페이지를 확인.
5. MLO나 라우터 모드 같은 변경 기능은 별도 단계에서 복구 경로를 준비해 시험.


