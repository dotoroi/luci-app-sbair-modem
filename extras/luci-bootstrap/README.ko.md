# SBA6 LuCI bootstrap (선택 기능)

[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

순정 SoftBank Air 6의 vendor OpenWrt 21.02.7에 LuCI가 없을 때 추가하는 보조 도구입니다. Floop3 앱과 별개이며 LuCI가 이미 동작하면 필요 없습니다. vendor MT-WiFi 드라이버와 ABI를 보존하며 드라이버를 설치·복구·교체하지 않습니다. 다른 release나 SNAPSHOT에는 사용하지 마세요.

## 설치

Mac/Linux 호스트에서 현재 기기 관리 IP를 지정합니다.

```sh
./extras/luci-bootstrap/install.sh root@<AIR6_IP>
```

호스트가 공식 OpenWrt archive에서 `packages.lock`에 고정된 패키지를 받아 SHA256을 확인한 뒤 SSH로 `/tmp/sba6-luci-bootstrap/`에 보냅니다. 공유기 자체의 인터넷, DNS, 기본 경로는 필요하지 않습니다. 설치 후 재부팅하지 않습니다. 표시된 현재 LAN 주소로 접속합니다.

```text
http://<current-LAN-IP>:8080/cgi-bin/luci/
```

재부팅 후에는 다음으로 확인합니다.

```sh
./extras/luci-bootstrap/install.sh --check root@<AIR6_IP>
```

## 실행 모드

```sh
./extras/luci-bootstrap/install.sh --dry-run root@<AIR6_IP> # 변경 전 점검
./extras/luci-bootstrap/install.sh --check root@<AIR6_IP>    # 읽기 전용 상태 확인
./extras/luci-bootstrap/install.sh --repair root@<AIR6_IP>   # 서비스/규칙/cache만 복구
```

패키지 캐시 경로는 `SBA6_LUCI_CACHE_DIR`로 지정할 수 있습니다. 기본값은 `/tmp/sba6-luci-bootstrap-cache`입니다.

## 안전 범위

OpenWrt 21.02.7, target `gem6xxx/evb6990_cpe_mt7990_emmc`, architecture `aarch64_cortex-a55_neon-vfpv4`만 허용합니다. opkg feed를 바꾸거나 `opkg update/upgrade`를 실행하지 않습니다. vendor `libnl-tiny.so.1`, `libiwinfo.so.20230701`은 보존하고 LuCI ABI 라이브러리를 공존시킵니다. 순정 lighttpd TCP/80은 유지하며 LuCI는 uhttpd TCP/8080을 사용합니다. 방화벽은 `br-lan`에서만 허용하고 WAN/5G에는 열지 않습니다. 설치 전 백업은 `/root/sba6-pre-luci-<timestamp>.<pid>/`에 저장합니다. LAN IP, DHCP, gateway, DNS, SSH, OTA, 순정 WebUI, 펌웨어는 변경하지 않습니다. 설정된 LAN IP와 runtime `br-lan` IP가 다르면 section을 추측하지 않고 중단합니다.

[문제 해결](docs/TROUBLESHOOTING.ko.md)과 [선택적 IP 변경 안내](docs/IP-MIGRATION.ko.md)를 참고하세요.
