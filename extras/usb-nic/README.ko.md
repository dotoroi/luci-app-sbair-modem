# SBA6 USB NIC (CDC-NCM Gadget) — 실험용 선택 번들

[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

SoftBank Air 6 / SBA6D 자체를 USB CDC-NCM gadget으로 동작시키는 **실험적이며 위험도가 높은** 기능입니다. Air 6에 연결한 USB 이더넷 어댑터를 조회하는 **기기 → USB 기기** 목록과는 별개입니다. 일반 `install.sh`에는 포함되지 않으며 기본적으로 설치·로드·활성화되지 않습니다. `.ko` 모듈도 저장소에 포함하지 않습니다.

## 번들만 설치

Mac/Linux 호스트에서 실행합니다.

```sh
./extras/usb-nic/install.sh root@<Air6-관리IP>
```

호스트가 고정된 upstream revision에서 후보 바이너리를 내려받고 SHA256을 확인한 뒤 SSH로 전송합니다. Air 6 자체의 인터넷, DNS, 기본 경로는 필요하지 않습니다. 설치 과정에서 모듈 로드, ConfigFS/UDC/`usb0` 설정, LAN/WAN/브리지/방화벽/Wi-Fi 변경 또는 재부팅은 하지 않습니다.

상태만 확인하려면 다음을 실행합니다.

```sh
./extras/usb-nic/install.sh --check root@<Air6-관리IP>
```

## 활성화 전 조건

활성화는 별도 작업이며 **기기 → USB 기기 → USB NIC (CDC-NCM Gadget)**에서 명시적으로 진행해야 합니다. 먼저 upstream 실기기에서 검토한 값이 포함된 activation profile을 `--profile FILE`로 설치합니다. 값은 추측·자동 생성하거나 순정 gadget에서 자동 복사하지 않습니다.

```text
VID_HEX
PID_HEX
DEV_MAC
HOST_MAC
USB0_ADDR
PEER_IPV4
```

profile은 mode 600으로 저장하고 status/log에는 값이 표시되지 않습니다. profile이 없거나 잘못되면 Enable을 사용할 수 없습니다. USB를 `br-lan`에 브리지하거나 LAN/WAN/DHCP/Wi-Fi를 변경하지 않습니다. 진행 전에 독립된 LAN/Wi-Fi 관리 경로와 물리 복구 수단을 확보하세요. USB 호스트 연결이 끊기면 접근이 중단될 수 있습니다.

## 고정된 upstream 정보와 안전 동작

`driver.lock`은 upstream revision, artifact, SHA256, 커널, 아키텍처, vermagic, 라이선스 및 검증된 topology를 고정합니다. 후보 topology는 다음과 같습니다.

```text
gadget   = t6a_ncm_test
function = t6a_ncm.test0
config   = c.1
UDC      = 11201000.usb
network  = usb0
```

후보 v1은 upstream 실기기 검증 바이너리지만, 공개 소스와 바이너리의 대응은 provenance 기반 B2이며 upstream은 신규 사용을 권장하지 않습니다. 정식 지원 드라이버가 아니라 실험 기능으로 취급하세요. [Karin-Laboratory/sbat6-usb-nic](https://github.com/Karin-Laboratory/sbat6-usb-nic)과 안전 문서를 확인하세요.

초기 구현은 부팅 시 자동 시작을 추가하지 않으며 재부팅 후 UDC를 자동 점유하지 않습니다. 활성화 전 읽기 전용 사전 점검에서 profile, 모듈 hash, kernel/vermagic, ConfigFS 소유권, UDC, USB 속도, `usb0`, `br-lan` 관리 경로를 확인합니다. 실패 시 전용 gadget에 한정한 복구만 시도하며 알 수 없는 ConfigFS 객체와 vendor topology는 보존합니다. 강제 모듈 제거, vendor gadget 생성·삭제, UDC 드라이버 조작, 무조건 재부팅은 하지 않습니다.

시험 전에 [복구 안내](docs/RECOVERY.ko.md)를 읽으세요.

