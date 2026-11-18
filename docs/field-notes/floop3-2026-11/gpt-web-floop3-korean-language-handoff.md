# GPT 웹 인계: Floop3 한국어·일본어 번역 누락 및 언어팩 연동

## 전달 목적

SoftBank Air Terminal 6의 Floop3 LuCI 전용 메뉴에서 한국어나 일본어를 선택했는데 영어가 다수 남는다. 원인이 언어팩 로딩인지 번역 누락인지, 코드에서 번역을 우회하는 하드코딩인지 분리해 조사했다. 이 문서를 GPT 웹에 붙이고 함께 제공된 CSV를 첨부해 두 언어의 번역 작업을 이어갈 수 있다.

## 확인 결과

- 장비: `REDACTED_LAN_IP`, 읽기 전용 SSH 조사
- 현재 선택 언어: `luci.main.lang='ko'`
- 언어 선택지 등록: `luci.languages.ko='한국어 (Korean)'`; `ja`, `en`도 등록됨
- Floop3 앱 카탈로그 설치 경로: `/usr/lib/lua/luci/i18n/luci-app-sbair-modem.ko.lmo`
- 장비 설치본 SHA-256: `e81a8ae9590d1e7c195ec028b4fd5582a23f9713f06ded50ee36592f932bbc66`
- 로컬 `out/i18n/luci-app-sbair-modem.ko.lmo`도 같은 SHA-256으로 빌드됨
- 로컬에서 추출한 JS의 gettext 키 772개 중, 681개는 `po/ko`의 `msgstr`가 `msgid`와 동일한 영어 원문이고, 91개만 한국어 등 다른 번역문을 가짐. 카탈로그에 키가 빠진 경우는 0개.
- 일본어도 비슷함: 같은 JS 키 772개 중 684개가 `po/ja`에서 영어 원문 그대로이고 88개만 일본어 등 다른 번역문을 가짐. 누락 키 0개, 장문 영어 설명·경고 기준 항목 166개.
- 기기의 일본어 LMO SHA-256은 `ebc1cd209c8ec206f259774f1e7655045d1f00bb754dc8eedc96b38287f7bf81`이며 로컬 빌드와 일치한다.
- 긴 설명/경고문 기준(7단어 이상)으로도 영어 원문 항목이 166개다. 문자열 길이 기준은 휴리스틱이며, 681개 전체에는 기술 약어와 짧은 라벨도 포함된다.
- 정적 탐색에서 gettext 함수 `_()`를 거치지 않고 표에 직접 넣은 영문 헤더도 확인됨: `interface`, `role`, `state / carrier`, `MAC / MTU`, `master`, `driver / bus`, `VID:PID`, `path`, `sha256`, `mtime`, `size`, `old`, `new`, `reported speed` 등. 이들은 PO만 번역해선 바뀌지 않고 JS 코드 수정이 필요하다.
- `Advanced settings`와 `Cellular` 메뉴 제목은 각각 `고급 설정`, `모바일 회선`으로 PO를 고치고 LMO를 재생성해 장비에 설치했다. 설치 해시는 빌드 결과와 일치한다. 브라우저 탭은 로그인 요구 화면이어서 로그인 후 전체 렌더링 검증은 미완료다.

## LuCI 언어팩 연동 경로

1. `/etc/config/luci`의 `luci.languages.*`는 Language and Style에 표시할 언어 목록이다. 이것만 등록한다고 번역이 설치되지는 않는다.
2. `/etc/config/luci`의 `luci.main.lang='ko'`가 선택된 언어다. 현재 장비 설정은 실제로 `ko`다.
3. Floop3 JS 화면은 `_('English message ID')`를 사용한다. 설치된 LuCI `/www/luci-static/resources/cbi.js`의 번역 함수는 `window.TR`에서 해시된 원문 키를 찾고, 없으면 원문(`s`)을 그대로 반환한다.
4. LuCI Lua i18n 모듈(`/usr/lib/lua/luci/i18n.lua`)은 언어 설정에 따라 `luci.i18n` 카탈로그를 로드하며, 앱 도메인 파일명은 `luci-app-sbair-modem.ko.lmo`다.
5. Floop3 `tools/build-i18n.sh`가 `po/ko/luci-app-sbair-modem.po`를 `po2lmo`로 LMO에 컴파일한다. `install.sh`는 LMO를 `/usr/lib/lua/luci/i18n/`에 복사한다.
6. 메뉴 JSON 제목도 `menu-bootstrap.js`에서 `_(children[i].title)`로 조회하므로 같은 도메인 카탈로그 번역이 적용돼야 한다.

따라서 현재 관측값은 언어 선택·도메인 파일 설치·파일 해시가 일치하며, 나머지 영어 대다수는 빈 카탈로그 문제가 아니라 영어 원문을 `msgstr`에 그대로 복사해 둔 번역 누락으로 설명된다. 번역되지 않은 `msgstr`도 비어 있지 않으므로 LuCI는 fallback 이전에 영어 문자열을 반환한다.

## 검사 체계의 놓친 결함

`tools/check-i18n.sh`는 `msgattrib --untranslated`와 `--only-fuzzy`만 검사한다. `msgstr`가 비어 있는 경우는 검사하지만 `msgstr == msgid`인 영어 잔존은 미번역으로 세지 않는다. 그래서 현재의 681개 영어 잔존 항목도 “i18n checks passed”를 통과할 수 있다. 단순히 “영어와 같은 값”을 전부 실패로 만들면 APN, MTU, SIM, Wi-Fi 등 그대로 둘 기술 용어까지 오탐할 수 있으므로, 번역 제외 허용 목록/주석을 설계한 뒤 실제 사용자 문장과 라벨에만 적용하는 개선이 필요하다.

문서 불일치도 있다. `KOREAN.md`는 724개 메시지 ID라고 설명하지만 현재 각 PO 파일에는 929개 msgid가 있고, JS에서 추출한 현재 gettext 키는 772개다. 문서·템플릿·카탈로그 생성 기준을 함께 정리해야 한다.

## 부속 목록

- `floop3-ko-untranslated-strings.csv`: 영어 원문으로 남은 JS gettext 항목 681개, 화면 소스 파일·행, 간단 분류
- `floop3-ko-untranslated-strings.md`: 집계와 페이지별 분포

집계: `sim.js` 141, `netmode.js` 133, `signal.js` 103, `wifi_advanced.js` 72, `usb.js` 70, `wifi_drift.js` 66, `network_diagnostics.js` 48, `sms.js` 47, `clients.js` 36, `wifi.js` 27, `sbair.js` 21, `lan_services.js` 17, `update.js` 12, `device.js` 10, `ql_datacall.js` 3.

## GPT 웹에 요청할 작업

1. CSV 681개를 전부 훑어 기술 약어/고유 명칭과 실제 번역 대상 UI 문구를 구분한다.
2. 모든 사용자 노출 문구에 대해 한국어와 일본어 `msgstr`를 각각 제안한다. `msgid`는 바꾸지 않는다. AT 명령, 인터페이스명, 파일 경로, 코드 토큰, `%s`/`%d`/`{}` 같은 포맷 치환자는 그대로 보존한다.
3. 페이지별로 권장 한국어·일본어 번역을 제공하고, 오류/경고·설정 설명·확인 대화상자를 우선한다. 두 언어에서 번역하지 않을 기술 약어·고유 용어는 별도 허용 목록으로 제안한다.
4. 나열한 하드코딩 표 헤더와 CSV에 잡히지 않은 gettext 미사용 문자열을 코드 위치 기준으로 조사해 `_()` 적용 변경안을 제시한다.
5. `check-i18n.sh`가 빈 번역뿐 아니라 영어 원문 잔존도 감지하도록 개선안을 내되, 기술 고유어 허용 방법을 포함한다.
6. PO 갱신 후 `po2lmo` 재빌드, 기존 LMO 백업/롤백, 설치 검증과 브라우저 렌더링 검증 순서를 제시한다. 장비 변경은 별도 요청이 있기 전까지 수행하지 않는다.

## 재현 기준

저장소: `Floop3 repository`

- 카탈로그: `po/ko/luci-app-sbair-modem.po`
- 추출·검증: `tools/check-i18n.sh`
- 빌드: `tools/build-i18n.sh` (`PO2LMO` 필요)
- 설치: `install.sh`
- 사용자 화면: `htdocs/luci-static/resources/view/sbair/*.js`, 공유 문자열은 `htdocs/luci-static/resources/tools/sbair.js`
- 메뉴명: `root/usr/share/luci/menu.d/luci-app-sbair-modem.json`


