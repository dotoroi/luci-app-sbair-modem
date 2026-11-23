[English](UNINSTALL-FLOOP3-EN.md) | [한국어](UNINSTALL-FLOOP3-KO.md) | [日本語](UNINSTALL-FLOOP3-JA.md)

# Floop3 제거 절차 (Air Terminal 6)

`tools/uninstall-floop3.sh`는 수동 설치한 Floop3 파일과 등록만 제거한다. OpenWrt, LuCI, `luci-app-air6-modem`, 네트워크·Wi-Fi·root 계정 설정은 제거 대상이 아니다. 재부팅은 하지 않는다.

## 실행

실기기에서 root SSH 또는 UART root 셸로 스크립트를 실행한다.

```sh
sh uninstall-floop3.sh
```

스크립트는 SoftBank Air 6 보드인지 확인한 뒤 현재 설정·대상 파일을 `/root/sbair-backups/floop3-removal-<UTC시각>/before-remove.tar.gz`로 보관한다. Floop3 서비스를 중지하고 비활성화한 다음 앱 파일, 시작 링크, LuCI 메뉴/RPC 등록, Floop3 전용 방화벽 include와 설치 때 추가된 영어·일본어 언어 선택을 제거한다. 한국어 선택은 기존에 있던 값이므로 유지한다.

`/etc/config/sbair`는 설치 전 백업에 없고, 설치 프로그램이 만든 기본값과 UCI 키·값 전체가 일치할 때만 삭제한다. 사용자 값이 추가되거나 달라졌으면 보존한다. `/etc/config/ql_ril_service` 역시 설치 프로그램의 로그 수준 기본값과 정확히 같을 때만 제거한다. 삭제 전 사본은 제거 백업 디렉터리에 남긴다.

## 완료 확인

다음 항목을 확인한다.

```sh
ubus list | grep -x sbair        # 출력이 없어야 함
ps w | grep -E 'sbair|5300'      # 앱 프로세스가 없어야 함
apk info -e luci-app-air6-modem  # 기본 Air6 메뉴 패키지가 남아야 함
ip -4 addr show br-lan           # 기존 LAN 주소가 유지되어야 함
```

제거 백업의 `before-remove.tar.gz`와 `paths.txt`는 검토·복구 자료다. 이를 통째로 `/`에 풀면 현재 설정을 덮어쓸 수 있으므로, 복구가 필요하면 개별 경로를 확인해 복원한다.
