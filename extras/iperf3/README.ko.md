# Air6 iperf3 설치 및 측정

[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

`air6-install-iperf3.sh`는 Mac 호스트에서 공식 OpenWrt 21.02.7 `aarch64_generic` feed의 `iperf3`와 공유기에 없는 직접 사용자 공간 의존 패키지만 내려받아 SHA256을 확인하고, SSH로 Air 6에 전달합니다. 공유기 자체가 패키지를 다운로드하지 않습니다. DNS, 경로, gateway, DHCP, LAN, Wi-Fi, 이동통신 WAN, LuCI, SSH, FOTA 설정을 변경하지 않습니다.

## 명령

```sh
./extras/iperf3/air6-install-iperf3.sh install <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh check <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh start <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh stop <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh test <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh diagnose <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh experiment <AIR6_IP>
./extras/iperf3/air6-install-iperf3.sh rollback <AIR6_IP>
```

`AIR6_HOST`, `AIR6_USER`(기본 `root`), `AIR6_SSH_PORT`(기본 `22`) 환경변수도 사용할 수 있습니다. Air 6 IP에는 기본값이 없습니다. 비밀번호가 필요하면 SSH 프롬프트에서 입력합니다. Homebrew, Python, jq, sshpass는 요구하지 않습니다.

## 패키지 및 안전 점검

문서에 기록된 feed 확인 기준은 `iperf3 3.10.1-1`, architecture `aarch64_generic`, 의존성 `libc`입니다. `libc` 같은 핵심 의존성이 없으면 중단하며 교체·업그레이드하지 않습니다. 호스트에서 공식 package metadata와 SHA256을 검사하고, 공유기에 `sha256sum`이 있으면 전송 후에도 확인합니다. opkg architecture 임시 추가는 해당 명령에만 적용되며 feed/architecture 설정에 저장하지 않습니다.

upgrade, downgrade, remove, 핵심/vendor ABI 또는 kernel/kmod 변경이 포함된 위험한 dry-run은 거부합니다. `opkg update/upgrade`, init 서비스 추가, 재부팅을 하지 않습니다. `start`는 `br-lan`에서 TCP/5201을 임시 허용하고 `stop`은 자신이 추가한 동일 규칙만 제거합니다. 네트워크/Wi-Fi/부팅 설정을 영구 변경하지 않습니다.

## 측정과 결과 해석

`test`는 호스트와 Air 6 자체 iperf3 서버 사이를 직접 측정합니다. OMV, SMB, 저장장치, Ethernet 중계 경로는 사용하지 않습니다. `diagnose`는 병렬 스트림과 독립 서버 프로세스를 비교하고 TCP/UDP 시험 및 CPU, interrupt, softirq, softnet, 인터페이스 카운터, 온도/주파수, queue 설정을 기록합니다. `experiment`는 되돌릴 수 있는 RPS, backlog, 신뢰도 높은 IRQ affinity 조정도 시험합니다. 중단 후 snapshot은 `rollback`으로 복구합니다.

튜닝은 임시입니다. 지속 sysctl/init/firewall, Wi-Fi, CPU/thermal, MTU, offload, 패키지 업그레이드를 변경하지 않습니다. 쓰기 전에 값을 저장하고 복구 여부를 확인합니다. snapshot이 남으면 `rollback`을 실행하세요.

로컬 측정 경로는 `호스트 Wi-Fi → Air6 커널 → Air6 iperf3 사용자 공간`입니다. AP 패킷 전달 성능인 `호스트 Wi-Fi → Air6 bridge/vendor datapath → 외부 서버`와 다릅니다. 선택적 reference host는 공유기 네트워크를 변경하지 않고 별도 경로를 비교합니다. 반복 가능한 결과를 얻기 전에는 영구 튜닝을 적용하지 마세요.
