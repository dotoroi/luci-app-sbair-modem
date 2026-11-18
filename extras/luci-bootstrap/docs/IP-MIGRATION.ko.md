# 선택적 IP 변경 안내

[English](IP-MIGRATION.en.md) | [한국어](IP-MIGRATION.ko.md) | [日本語](IP-MIGRATION.md)

bootstrap은 LAN IP, DHCP, gateway, DNS를 변경하지 않습니다. `network.lan.ipaddr`와 runtime `br-lan` IP가 다르면 어느 section을 지울지 추측하지 않고 중단합니다.

## 현재 상태 확인

```sh
uci show network.lan
uci show network | grep -B3 -A10 "name='br-lan'"
ip -4 addr show br-lan
```

설정 IP와 runtime IP가 다른 경우에만 UART 같은 복구 경로를 확보한 뒤 진행합니다. `network.@device[3]`처럼 section 번호가 기기마다 같다고 가정하지 마세요.

## 오래된 device IP 삭제

출력 결과에서 해당 section을 정확히 확인하고 먼저 백업합니다.

```sh
cp -p /etc/config/network /root/network.before-ipfix
uci -q delete network.<verified-section>.proto
uci -q delete network.<verified-section>.ipaddr
uci -q delete network.<verified-section>.netmask
uci commit network
/etc/init.d/network restart
```

이후 runtime 주소를 확인합니다.

```sh
ip -4 addr show br-lan
```

## 다른 서브넷의 gateway/DNS

Air 6 주소가 `<AIR6_IP>`, 상위 라우터가 `<UPSTREAM_ROUTER_IP>`인 경우에만 필요에 따라 설정합니다. 순정 `192.168.3.1` 구성으로 인터넷이 되면 필요하지 않습니다.

```sh
uci set network.lan.gateway='<UPSTREAM_ROUTER_IP>'
uci -q delete network.lan.dns
uci add_list network.lan.dns='<UPSTREAM_ROUTER_IP>'
uci add_list network.lan.dns='1.1.1.1'
uci add_list network.lan.dns='8.8.8.8'
uci commit network
```

이 절차는 선택적 네트워크 이전 안내입니다. IP 불일치가 감지되어도 LuCI bootstrap이 자동 적용하지 않습니다.

