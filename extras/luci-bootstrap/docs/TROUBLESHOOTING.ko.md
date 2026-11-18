# 문제 해결

[English](TROUBLESHOOTING.en.md) | [한국어](TROUBLESHOOTING.ko.md) | [日本語](TROUBLESHOOTING.md)

## SSH 접속 불가

호스트 보조 설치에는 Air 6 자체의 인터넷 연결이 필요하지 않습니다. 먼저 호스트에서 SSH를 확인합니다.

```sh
ssh root@<current-LAN-IP> 'cat /etc/openwrt_release; ip -4 addr show br-lan'
```

AP/Bridge 모드에서는 호스트가 공유기와 같은 L2에 있는지, ARP가 해석되는지 확인합니다. `install.sh`는 IP를 추측하거나 변경하지 않습니다.

## 사전 점검에서 플랫폼 거부

이 bootstrap은 다음 조합만 허용합니다.

```text
DISTRIB_RELEASE=21.02.7
DISTRIB_TARGET=gem6xxx/evb6990_cpe_mt7990_emmc
DISTRIB_ARCH=aarch64_cortex-a55_neon-vfpv4
```

다른 vendor 펌웨어나 OpenWrt release에 강제로 적용하지 마세요. 다른 플랫폼은 별도 패키지 manifest를 검증한 뒤 지원해야 합니다.

## `--check`에서 TCP/8080만 실패

Air 6에서 LuCI가 localhost로 동작하는지 먼저 확인합니다.

```sh
ps w | grep '[u]httpd'
netstat -lntp 2>/dev/null | grep ':8080 '
curl -i http://127.0.0.1:8080/cgi-bin/luci/
```

로그인 전 `403 Forbidden`은 정상입니다. localhost는 성공하지만 LAN 접속만 안 되면 방화벽을 확인합니다.

```sh
iptables -C INPUT -i br-lan -p tcp --dport 8080 -j ACCEPT
uci show firewall.sba6_user_include
grep -n 'LUCI-LAN-SBA6' /etc/firewall.user
```

`--repair`는 패키지를 재설치하지 않습니다.

```sh
./extras/luci-bootstrap/install.sh --repair root@<current-LAN-IP>
```

## 재부팅 후에만 접속 불가

uhttpd 자동 시작과 named firewall include가 유지되는지 확인합니다.

```sh
/etc/init.d/uhttpd enabled
uci show firewall.sba6_user_include
iptables -C INPUT -i br-lan -p tcp --dport 8080 -j ACCEPT
```

uhttpd는 listen하지만 방화벽 규칙만 사라졌다면 `--repair`로 uhttpd 설정, `firewall.user`, named include, rpcd cache를 복구할 수 있습니다.

## 패키지 dry-run 중단

`target.sh`는 downgrade/remove, vendor ABI 변경(`libc`, kernel, kmod, libubus/libuci/libubox/libjson/liblua/libnl), vendor `libiwinfo20230701` 변경을 포함한 계획을 중단합니다. `/root/sba6-pre-luci-*/opkg.before.txt`와 호스트 로그를 보관한 뒤 플랫폼과 vendor 패키지 상태를 확인하세요. 먼저 `opkg upgrade`를 실행해 강제로 맞추지 마세요.

## `libnl-tiny.so` ABI 검사 실패

공식 21.02.7 `libnl-tiny1`은 opkg로 설치하지 않고 `data.tar.gz`에서 임시 추출합니다. 실패해도 vendor `/usr/lib/libnl-tiny.so.1`은 변경하지 않습니다. 재시도 전 패키지 상태와 여유 공간을 확인하세요.

