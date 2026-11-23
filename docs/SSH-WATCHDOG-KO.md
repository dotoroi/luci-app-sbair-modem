# Air6 SSH 감시·모뎀 밴드 복원 안내

## SSH 감시 서비스

`air6-ssh-watchdog`는 기존 제조사 Dropbear 복구 스크립트를 유지하면서 관리 LAN의 SSH 경로만 감시합니다.

- 15초마다 `br-lan` IPv4, TCP/22 listener, `input_lan_drop_rule`을 확인합니다.
- 현재 구현의 허용 PC는 `192.168.3.240/32`이고 장비 주소는 `br-lan`의 `192.168.3.x/32`입니다.
- 필요한 경우에만 해당 PC→장비 주소의 TCP/22 예외를 체인 첫 규칙으로 복구합니다.
- listener가 없을 때 `/etc/init.d/zzzz_air6_dropbear start`를 호출합니다.
- WAN 전체, 다른 PC, 비밀번호 인증을 설정하거나 허용하지 않습니다.

### 설치 확인·실행

`install.sh /`는 서비스 파일과 `S99` 부팅 링크를 설치하지만, 실행 중인 프로세스를 자동 시작하지 않습니다. 현재 부팅에서 활성화하려면 기존 관리 SSH를 유지한 채 다음을 실행합니다.

```sh
/etc/init.d/zzzzz_air6_ssh_watchdog start
/usr/bin/air6-ssh-watchdog --check
/etc/init.d/zzzzz_air6_ssh_watchdog status
```

기존의 `br-lan`, source IP, 방화벽 chain 또는 Dropbear 복구 스크립트가 다르면 시작하기 전에 코드를 조정해야 합니다. watchdog이 없는 firewall chain을 새로 만들거나 WAN에 규칙을 추가하지는 않습니다.

### 롤백

```sh
/etc/init.d/zzzzz_air6_ssh_watchdog stop
/etc/init.d/zzzzz_air6_ssh_watchdog disable
rm -f /etc/rc.d/S99zzzzz_air6_ssh_watchdog /etc/rc.d/K01zzzzz_air6_ssh_watchdog
rm -f /etc/init.d/zzzzz_air6_ssh_watchdog /usr/bin/air6-ssh-watchdog
```

제조사 `/etc/init.d/zzzz_air6_dropbear`와 그 부팅 링크는 제거하지 않습니다.

## 밴드 저장값 복원

`AT+EPBSEH=`의 LTE/NR 밴드 마스크는 모뎀 재시작이나 늦은 초기화 후 기본값으로 돌아갈 수 있습니다. `sbair.band.lte` 및 `sbair.band.nr`가 저장되어 있으면 `S95sbair-apn`의 시작 처리 후 `air6-band-restore`가 해당 값만 다시 적용합니다. GSM/UMTS 마스크는 현재 모뎀 값을 보존합니다. APN·SIM 잠금·IMS·SMS 알림을 함께 처리하는 전체 `sbair-modem boot` 경로와 분리했습니다.

모뎀 AT 준비를 기다린 다음 밴드 상태를 최대 120초 감시하고, 저장 마스크가 45초 유지되면 끝납니다. 상태 메시지는 `logread`에서 `air6-band-restore` tag로 확인합니다.

```sh
uci show sbair.band
/usr/sbin/air6-band-restore
/usr/bin/sbair-modem at -t 5 -r 'AT+EPBSEH?'
```

이 명령은 셀룰러 망 재탐색을 유발해 데이터 연결이 잠시 끊길 수 있습니다. 적용된 밴드 마스크는 셀 등록이나 데이터 연결 성공을 보장하지 않습니다. 부팅 후 자동 실행 여부는 실제 대상 펌웨어에서 `S95sbair-apn`, 프로세스 로그, `AT+EPBSEH?`를 확인해야 합니다.
