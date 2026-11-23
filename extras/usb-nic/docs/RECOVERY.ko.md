# USB NIC gadget 복구 안내

[English](RECOVERY.en.md) | [한국어](RECOVERY.ko.md) | [日本語](RECOVERY.md)

이 기능은 USB UDC/ConfigFS 소유권을 변경합니다. 별도의 LAN 또는 Wi-Fi 관리 경로가 없으면 활성화하지 마세요. USB 연결이 끊겼다는 사실만으로 실패를 단정하지 말고 독립 관리 경로에서 상태를 확인합니다.

## 먼저 확인할 항목

```sh
/usr/sbin/sbair-usb-nic status
/usr/sbin/sbair-usb-nic preflight
```

필요하면 별도 SSH/UART 연결에서 다음을 실행합니다.

```sh
/usr/sbin/sbair-usb-nic disable
```

Disable은 앱이 소유한 정확한 gadget topology만 unbind/정리합니다. 알 수 없는 ConfigFS 객체, vendor gadget 기능, 예상하지 못한 UDC 바인딩이 있으면 삭제하지 않고 `rollback-required` 상태로 중단합니다. 모듈을 강제로 제거하지 않습니다. 무조건 재부팅하거나 vendor USB 초기화 스크립트를 무작정 다시 실행하지 마세요.

## 수동 복구가 필요한 경우

독립 관리 경로에서 `status`가 안내하는 snapshot 경로를 보존합니다. 활성화 직전의 ConfigFS와 UDC 기준 상태가 root 전용 권한으로 저장되어 있습니다. 기준 상태를 정확히 복구할 수 없다면 UDC를 unbound 상태로 두고 vendor topology를 추측해 다시 만들지 마세요. vendor gadget 복구는 upstream [RECOVERY.md](https://github.com/Karin-Laboratory/sbat6-usb-nic/blob/main/docs/RECOVERY.md)와 해당 기기의 UART 절차를 따릅니다.

이 번들은 공장 초기화나 펌웨어 복구를 제공하지 않습니다. reset, `firstboot`, 펌웨어 쓰기는 이 기능의 자동 복구 방법이 아닙니다.
