# Air Terminal 6 오버레이 whiteout 읽기 전용 점검

이 안내는 Floop3 기능이 아니라 Air Terminal 6의 OverlayFS 상태를 진단하기 위한 장치 작업 지침이다. 사용자별 관리 IP, MAC, SSH 키, 비밀번호는 포함하지 않는다.

## 왜 확인하나

OverlayFS에서 하위 `/rom` 파일을 가리는 삭제 표식(whiteout)이 `/overlay/upper`에 남을 수 있다. SBA6D에서 관찰된 `rc.common` 장애는 `/overlay/upper/etc/rc.common`의 문자 장치 표식(`c---------`)과 병합 경로 `/etc/rc.common`의 부재가 함께 확인된 사례였다. 이 상태는 `rcS`에서 호출되는 시작 스크립트에 영향을 줄 수 있다.

Floop3 코드의 정적 검토에서는 `/overlay/upper`를 비우거나 `/etc/rc.common` 같은 부팅 핵심 파일을 삭제하는 처리를 찾지 못했다. 설치기는 구형 Floop3 화면인 `/www/luci-static/resources/view/sbair/adblock.js`와 `maintenance.js`를 업그레이드 때 제거하며, 제거기는 설치 기록에 허용된 앱 경로만 지운다. 이 두 화면 경로가 특정 펌웨어의 `/rom`에 실제 포함되어 있다면 OverlayFS가 해당 경로에 whiteout을 남길 수 있으므로, 장치별 upper와 `/rom` 대조는 여전히 유효하다. 이는 이번에 확인된 `/etc/rc.common` 장애와는 다른 경로다. 정적 검토만으로 모든 펌웨어 조합에서 원인이 없다고 보증하지는 않는다.

## 재부팅 전후 수집

재부팅 전과 부팅 후 SSH 또는 UART root 셸에서 동일한 점검을 실행하고, 출력·시각·펌웨어·슬롯을 각각 기록한다. SSH에서는 PC에서 릴리스 번들을 푼 뒤 스크립트를 stdin으로 보낼 수 있다.

```sh
ssh -T root@<장치 주소> 'sh -s' < tools/overlay-whiteout-audit.sh
```

UART에서는 번들에 포함된 스크립트를 임시 경로로 복사한 후 다음처럼 실행한다.

```sh
sh /tmp/overlay-whiteout-audit.sh
```

원시 출력은 별도로 보존한다. 특히 다음을 대조한다.

- `/etc/rc.common`, `/etc/inittab`, `/etc/init.d/boot`, `/etc/init.d/network`, `/etc/init.d/knos_config`
- `/rom`의 파일 존재 및 종류
- `/overlay/upper` 대응 경로와 문자 장치의 major/minor
- 병합된 경로의 존재·종류와 재부팅 후 변화
- UART `rcS`/init 로그와 SSH 복귀 시각

스크립트가 `*_exists`와 `rom_regular_file`에 출력하는 `0`은 조건 참(존재), `1`은 거짓(부재)이라는 셸 종료 상태다. `/rom`에는 파일이 있는데 병합된 경로가 없으면 대응 upper 항목과 부팅 로그를 함께 살핀다. 문자 장치 항목은 후보 표식이므로 경로와 major/minor를 기록해 상관관계를 확인한다.

## 안전 경계

- 이 스크립트는 읽기 전용이다. 장치 파일을 생성·삭제하거나 설정을 바꾸지 않는다.
- 후보 표식을 발견해도 확인 전에는 일괄 삭제하지 않는다.
- `/overlay/upper`를 비우거나 초기화하지 않는다.
- 재부팅 전후 출력은 장치별 작업 로그와 [기록 양식](OVERLAY-WHITEOUT-AUDIT-TEMPLATE-KO.md)에 남긴다.
- 이 점검만으로 원인이나 복구 성공을 판정하지 않는다. 장치 상태, UART 로그, 재부팅 후 동일 출력 등 독립 근거를 모은다.

## 오프라인 이미지 검사

추출해 둔 root 트리를 비교할 때만 `AIR6_AUDIT_ROOT`를 트리 루트로 지정한다. 이 모드에서 mount 정보는 실행 중인 PC/WSL 환경을 보여줄 뿐, 장치의 mount 상태를 나타내지 않는다.

```sh
AIR6_AUDIT_ROOT=/path/to/extracted-root sh tools/overlay-whiteout-audit.sh
```
