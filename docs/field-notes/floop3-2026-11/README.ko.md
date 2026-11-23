[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# Floop3 조사 기록 및 안내

이 폴더에는 Floop3 관련 과거 기록을 모았습니다. 언어팩 인계 자료, 확인된 RPC·전송 오류와 수정 기록, 설치기 검토, 줄바꿈 재발 방지, RPC 정적 검토, 제거 기록이 포함되어 있습니다.

## 범위와 유의사항

- 각 문서는 서로 다른 날짜에 수행한 점검을 기록합니다. 기록된 모든 상태가 현재도 유효하다는 뜻은 아닙니다.
- 공개를 위해 LAN 주소와 기기 내부 백업 경로를 일반화했습니다. 비밀번호, SSH 개인 키, 모뎀 식별정보, 보정 데이터, 펌웨어 파티션 덤프는 이 자료에 포함하지 않았습니다.
- 기기 동작 기록은 과거 조사 근거이며 설치 안내서가 아닙니다. 기기를 변경하기 전에 최신 프로젝트 문서를 확인하고 복구 경로를 마련하세요.
- 보관된 조사 보고서 본문은 한국어입니다. 이 README 안내는 영어·일본어·한국어 중 선택할 수 있습니다.

## 문서 목록

- `air6-floop3-rpc-errors-20261113.md` — 확인된 RPC 오류와 수정 기록.
- `floop3-transfer-failure-review-20261113.md` — 전송 불일치 및 CRLF 오류 검토.
- `floop3-installer-revalidation-20261116.md` — 설치 흐름 재검토와 검증 범위.
- `floop3-rpc-static-review-20261116.md` — RPC 레지스트리·ACL·UI 메서드 비교.
- `floop3-crlf-remediation-20261116.md` — 줄바꿈 문제 수정 기록.
- `floop3-i18n-hardcode-review-20261116.md` — i18n 및 미번역 UI 검토.
- `floop3-removal-20261116.md` — 과거 기기에서 제거한 기록.
