# Air 6 라우터 모드 안내

[English](ROUTER-MODE.en.md) | [한국어](ROUTER-MODE.ko.md) | [日本語](ROUTER-MODE.ja.md)

이 안내서는 Floop3의 **Network → Connection Mode(네트워크 → 접속 모드)**에 구현된 라우터 구성을 설명합니다. 대상은 벤더 수정 OpenWrt 21.02.7입니다. 유선 인터넷을 사용하면서 셀룰러 설정도 보존하려면 이 안내서는 **Air 6 Ethernet WAN (VLAN 3)**을 우선 선택지로 권장합니다. 유선 WAN 구성은 두 가지이며 서로 다른 포트 경로를 사용합니다.

## 모드 선택

| LuCI 표시 | 업링크 | 동작 |
|---|---|---|
| **Stock cellular router (SIM / ccmni)** | Air 6 내장 이동통신 모뎀 | 저장된 SIM 라우터 구성을 복원합니다. 사설 LAN과 LAN DHCP를 유지합니다. |
| **Air 6 Ethernet WAN (VLAN 3) — 권장** | 스위치 VLAN 3의 `eth0.3` | 포트 VLAN 3으로 DHCP 업링크를 추가하면서 셀룰러 `network.wan` 설정을 보존합니다. |
| **Floop3 wired WAN router (eth1)** | 전용 논리 인터페이스 `eth1` | 상위 장치에서 DHCP로 주소를 받고, `network.wan`을 eth1에 연결합니다. 기존 셀룰러 WAN을 대체합니다. |

두 유선 WAN 모드는 LAN의 사설 주소와 DHCP 범위를 유지하고, 기존 LAN→WAN 방화벽 전달과 masquerade(NAT)를 재사용합니다. 적용 전 해당 WAN 방화벽 영역의 입력 정책이 DROP/REJECT이고 NAT 및 LAN→WAN 전달이 있는지 검사합니다. 요구 조건이 맞지 않으면 설정을 강행하지 않고 중단합니다. 성능 가속이나 하드웨어 NAT 활성화를 뜻하지는 않습니다.

### eth1 유선 WAN

이 모드는 `network.wan`의 DHCP 장치를 `eth1`로 바꾸고, 장치가 `wan6`을 제공하는 경우 IPv6 WAN도 eth1로 연결합니다. 따라서 **셀룰러와 이더넷을 동시에 쓰는 듀얼 WAN/자동 장애조치는 구성하지 않습니다.** 모뎀 자체를 끄는 설정도 아니지만 기본 업링크는 eth1이 됩니다.

`eth1`은 소프트웨어에서 식별한 논리 인터페이스 이름입니다. 저장소 문서만으로 케이스의 특정 잭 위치를 확정할 수 없습니다. Network → Diagnostics에서 후보·링크 상태를 확인하고, 장치의 포트 표시를 확인해 어느 잭이 eth1인지 실물 링크 테스트로 식별하세요. LAN 잭에 상위 네트워크를 연결하면 DHCP 서버가 충돌할 수 있습니다.

### 권장 선택지: VLAN 3 이더넷 WAN

이 모드는 구현에 기록된 스위치 구성을 사용합니다. 외부 스위치 포트 1을 VLAN 1에서 빼 VLAN 3에 untagged로 넣고, CPU 포트 5를 VLAN 3에 tagged로 두어 `eth0.3`을 만듭니다. 별도 `network.ethernetwan` DHCP 클라이언트를 WAN 방화벽/NAT 영역에 추가합니다. 기존 셀룰러 `network.wan`은 남습니다.

따라서 셀룰러 설정을 보존하려는 유선 WAN의 권장 구성입니다. 단, “권장”은 모드 선택에 대한 안내이며 이 구현이 라우팅 metric을 설정한다는 뜻은 아닙니다. 셀룰러와 이더넷이 각각 기본 경로를 광고할 수 있고 코드가 경로 우선순위나 자동 장애조치를 정하지 않으므로, 실제 기본 경로는 상태 화면이나 `ip route`로 확인해야 합니다. 소스의 포트 번호만으로 기기 외부의 잭 이름을 추정하지 마세요. 스위치/VLAN 변경 실패는 원격 관리 연결을 끊을 수 있어 UART 복구 경로가 필요합니다.

## 적용 전 준비

1. 펌웨어가 지원 대상인 vendor OpenWrt 21.02.7인지 확인합니다.
2. 설정 백업과 독립된 복구 수단(가능하면 UART)을 준비합니다. LuCI가 접속 중인 LAN/Wi-Fi 관리 경로를 유지하세요.
3. Network → Diagnostics에서 링크와 WAN 후보를 읽기 전용으로 확인합니다. 유선 모드에서는 WAN에 연결할 실제 잭을 확인하기 전 케이블을 꽂지 마세요.
4. 선택한 상위 라우터/모뎀이 DHCP로 IPv4 주소를 제공하는지 확인합니다. 이 구현은 ethwan/VLAN WAN의 PPPoE 계정 설정을 제공하지 않습니다.
5. LAN은 유효한 고정 사설 IPv4 주소/넷마스크, LAN DHCP 서버, LAN→WAN forwarding, WAN masquerade가 있어야 합니다. eth1 모드는 AP 모드에서 바로 전환할 수 없습니다. 먼저 SIM 라우터 모드로 돌아가야 합니다.

## LuCI에서 전환

1. **Network → Connection Mode**를 엽니다. 현재 모드, 관리 IP, 기본 경로, DHCP, WAN 주소/링크 상태를 확인합니다.
2. 먼저 **Stock cellular router (SIM / ccmni)**로 전환해야 하는 상태인지 확인합니다. AP/Bridge에서 ethwan 또는 VLAN WAN으로 바로 넘어가는 요청은 거부됩니다.
3. **Floop3 wired WAN router (eth1)** 또는 **Air 6 Ethernet WAN (VLAN 3)**을 선택합니다. 화면이 보여 주는 모드 설명과 유선 링크 후보를 다시 확인하고 **Apply changes**를 누릅니다.
4. WAN 케이블은 확인한 WAN 잭에, 관리 PC는 LAN/Wi-Fi에 연결합니다. 상위 DHCP가 임대 주소를 주고 기본 경로가 생겼는지 확인합니다.
5. 화면의 새 모드·WAN 주소·링크·기본 경로·LAN DHCP 상태가 의도와 맞을 때만 대기 중인 변경에서 **Check these settings/Confirm**을 누릅니다. 확신이 없거나 관리 연결이 불안정하면 **Rollback**을 누르거나 120초 만료를 기다립니다.

유선 모드 변경은 최대 120초의 Safe Apply 확인 시간을 둡니다. 이 기능은 설정 스냅샷을 되돌리지만 모든 커널/스위치/네트워크 장애에서 복구를 보장하지 않습니다. 특히 VLAN 모드는 UART 없이 원격으로 시험하지 마세요.

## 확인과 원복

Network → Connection Mode의 현재 상태에서 `eth1` 또는 `eth0.3`의 링크, DHCP 주소, 기본 경로를 확인합니다. 셸을 쓸 수 있으면 다음도 읽기 전용으로 확인할 수 있습니다.

```sh
ip -4 addr show br-lan
ip route
ifstatus wan
ifstatus ethernetwan
```

`ethwan`에서는 `wan`이 DHCP 주소와 기본 경로를 가져야 합니다. VLAN 모드에서는 `ethernetwan`을 확인하고, 기본 경로 선택은 별도로 확인합니다. 인터넷이 안 된다고 방화벽을 비활성화하거나 WAN을 LAN 브리지에 직접 넣지 마세요.

셀룰러 라우터로 돌아가려면 Connection Mode에서 **Stock cellular router (SIM / ccmni)**를 선택해 적용하고 확인합니다. ethwan은 저장해 둔 원래 WAN 구성을 복원하도록 구현되어 있습니다. VLAN WAN은 저장한 VLAN 기준 구성을 복원하고 별도 Ethernet WAN 인터페이스를 제거합니다. AP/Bridge는 유선 라우터 모드의 원복 경로가 아니며, 먼저 SIM 라우터 모드로 돌아갑니다.

## 구분할 두 DHCP 설정

- **관리 IP DHCP 클라이언트**: Air 6 자체가 상위 라우터에서 관리 주소를 받는 설정입니다. AP/Bridge 관리용 설정이며, 유선 WAN의 DHCP와 다릅니다.
- **LAN DHCP 서버**: Air 6가 내부 단말에 주소를 나눠 줍니다. 라우터 모드에서는 켜져 있어야 합니다. LuCI의 **Network → LAN Services**에서 제어하며, Connection Mode 화면은 직접 WAN/LAN DHCP를 임의로 토글하지 않습니다.

## 네트워크 연결 모드의 `sbair.errorText is not a function` 오류

이 JavaScript 오류는 브라우저에 남은 이전 `tools/sbair.js`와 새 `netmode.js`가 섞여 로드될 때 발생할 수 있습니다. 오류 자체가 WAN 설정 변경이나 연결 모드 적용을 뜻하지는 않습니다. 오류를 지우려고 **Apply changes**를 누르지 마세요.

1. 데스크톱 Chrome에서는 `Ctrl+Shift+R`로 강력 새로고침합니다. 모바일에서는 LuCI 탭을 닫고 다시 열거나 시크릿 탭에서 먼저 확인합니다.
2. 계속되면 브라우저에서 공유기의 LuCI 주소에 대한 사이트 캐시를 지우고 다시 로그인합니다.
3. 그래도 반복되면 릴리스 전체 번들을 다시 설치하고 페이지를 새로고침합니다. `netmode.js`만 따로 복사하지 마세요.

최신 화면은 공용 오류 도우미를 사용할 수 없을 때 원래 오류 문장을 보여 주도록 처리합니다. 반복되면 LuCI 화면의 릴리스 버전과 소스 커밋, 브라우저 콘솔 오류를 기록해 이슈를 보고하세요.

## 개인 주의사항: `/tmp` 로그

Air 6의 `/tmp`에 저장한 로그와 임시 파일은 메모리를 사용합니다. 디버그 로그를 계속 켜 두거나 많은 로그를 장시간 쌓아 두면 메모리가 부족해져 LuCI, 네트워크 서비스 또는 앱 기능이 불안정해지거나 멈출 수 있습니다. 필요한 진단 로그만 짧게 수집하고, 장기 보관이 필요하면 PC로 복사한 뒤 기기의 임시 로그를 정리하세요.
