# 오버레이 whiteout 재부팅 전후 기록

- 장비 라벨:
- KNOS 버전 / 부팅 슬롯:
- 단계: 재부팅 전 / 부팅 후
- KST 시각:
- 접속 경로: SSH / UART / 오프라인 이미지
- 스크립트 SHA-256:
- UART `rcS`/init 관련 로그 위치:
- SSH 복귀 시각 및 uptime:
- 판정: `PASS` / `FAIL` / `UNKNOWN` / `BLOCKED`

## 원시 출력

```text
[점검 스크립트 전체 출력]
```

## 핵심 파일 비교

| 경로 | `/rom` 파일 상태/종류 | `/overlay/upper` 항목·major/minor | 병합 경로 상태/종류 | 재부팅 전후 변화 |
|---|---|---|---|---|
| `/etc/rc.common` | | | | |
| `/etc/inittab` | | | | |
| `/etc/init.d/boot` | | | | |
| `/etc/init.d/network` | | | | |
| `/etc/init.d/knos_config` | | | | |

## 근거와 한계

- 관찰한 사실:
- 재현 조건:
- 재부팅 후 결과:
- 한계 또는 미확인 사항:

문자 장치 후보의 정확한 upper 경로와 major/minor를 빠짐없이 기록한다. 확인 전에 표식을 삭제하거나 overlay를 초기화하지 않는다.
