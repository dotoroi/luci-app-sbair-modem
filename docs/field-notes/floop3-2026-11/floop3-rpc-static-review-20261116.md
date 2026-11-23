# Floop3 RPC 재점검 — 2026-11-16

## 결론

현재 작업 트리의 RPC 정의 정합성은 정적 비교상 양호하다. Go RPC registry 93개와 rpcd ACL 93개가 읽기/쓰기 분류까지 일치했고, LuCI JavaScript에서 선언한 81개 메서드가 모두 registry에 존재한다. 과거 고급 메뉴 RPC 오류의 직접 원인은 CRLF였으며, 장비에서 LF로 고친 뒤 12개 읽기 전용 호출이 성공했다는 기록이 있다. 다만 해당 기록은 2026-11-13 당시 장비 상태다. 현재 장비의 실제 설치물·브라우저 세션은 이번에 접속해 확인하지 않았으므로, 현재 실기기 오류가 없다고 단정할 수 없다.

## 점검 근거

- `Floop3 repository/src/sbair-modem/rpcd.go`: RPC registry와 디스패치.
- `.../root/usr/share/rpcd/acl.d/luci-app-sbair-modem.json`: LuCI rpcd ACL.
- `.../htdocs/luci-static/resources/view/sbair/*.js`: 화면의 `rpc.declare()` 메서드.
- 정적 비교 결과: registry 93, ACL 93 (36 read / 57 write), 미등록·불필요·읽기/쓰기 중복 0, JS 메서드 81 중 registry 누락 0.
- `src/sbair-modem/rpc_registry_test.go`에는 registry/ACL/디스패치 정합성 테스트가 있다. 이번에는 테스트를 실행하지 않았다.
- `reports/air6-floop3-rpc-errors-20261113.md` 및 `reports/floop3-transfer-failure-review-20261113.md`에는 당시 CRLF로 rpcd `sbair` 객체 전체가 등록되지 않았고, 네트워크 모드 helper가 실행되지 않았던 실기기 증거와 조치가 기록돼 있다.

## 확인된 과거 RPC 오류와 현재 상태

1. `/usr/libexec/rpcd/sbair`의 CRLF 때문에 shebang 및 `list` verb가 실패해 `sbair` ubus 객체가 사라졌던 문제: 과거 장비에서 LF 정규화 및 rpcd 재시작 후 객체 등록이 복구됐다고 기록돼 있다.
2. `sbair-netmode`와 4개 모듈 스크립트의 CRLF 때문에 `netmode_status`가 helper 실행 오류를 낸 문제: 과거 장비에서 CR 제거 후 복구됐다고 기록돼 있다.
3. `wifi_advanced.js` 8개 상태 RPC와 연관 상태·진단 4개가 복구 후 성공했다는 기록이 있다. 실제 화면에서 에러 토스트가 사라졌는지는 당시 로그인 화면이 떠 있어 미확인이었다.

## 이번 점검에서 보완한 설치 문제

병합된 `install.sh`는 줄바꿈 검사기를 `-x`일 때만 실행하고 없으면 조용히 건너뛰었다. Windows/ZIP 추출 과정에서 실행 권한이 보존되지 않으면 CRLF 재발 검사가 무력화될 수 있어, 파일이 없으면 설치를 중단하고 있으면 `sh`로 명시 실행하도록 바꿨다. 이 검사는 현재 작업 트리의 셸 파일을 검사한다. 설치 결과 파일 해시를 장비에서 대조하는 절차는 아직 자동화되어 있지 않다.

## 남은 위험과 미확인 사항

- 이번 ZIP에는 `out/sbair-modem` Go 실행 파일이 없었다. 현재 로컬 트리에는 기존 실행 파일이 남아 있고 `install.sh`는 이를 그대로 설치한다. 파일은 2026-11-13 시각으로 남아 있지만, 이번 ZIP의 최신 Go 소스와 같은 소스에서 빌드됐다는 manifest/hash가 없어 **현재 바이너리와 소스 일치 여부는 미확인**이다. 장비에 설치하기 전에 `build.sh`로 다시 빌드하고 결과 해시를 기록해야 한다.
- 현재 기기의 `/usr/libexec/rpcd/sbair`, `/usr/bin/sbair-modem`, ACL 파일 해시 및 `ubus list` 결과를 수집하지 않았다. 이전 장비의 11월 13일 결과를 새 기기 또는 현재 상태에 일반화하면 안 된다.
- 브라우저의 실제 로그인 세션에서 각 메뉴를 열고 RPC 응답을 확인하지 않았다.
- Wi-Fi, netmode, eSIM, SMS, reboot 등 변경성 RPC는 실행하지 않았다.
- 정적 분석은 RPC 구현 각 함수의 장치별 전제 조건, knsh 명령 호환성, 오류 처리 분기 전체를 동적으로 검증하지 않는다.

## 실기기 점검 시 안전한 순서

1. 소스의 셸 LF 검사 및 RPC registry 테스트를 빌드 환경에서 실행한다.
2. `build.sh`로 Go 바이너리를 다시 만들고 SHA-256 manifest를 기록한다.
3. 장비에서는 설치 파일/해시, `ubus -v list sbair`, 읽기 전용 상태 메서드만 확인한다.
4. 브라우저에서 로그인 후 고급 Wi-Fi·네트워크 진단·USB·장치 메뉴를 새로고침하고 콘솔/네트워크 RPC 오류를 기록한다.
5. 설정 변경·재부팅 RPC는 별도 승인과 복구 준비 뒤에만 실행한다.


