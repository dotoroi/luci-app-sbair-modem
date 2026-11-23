[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

# Codex 없이 Floop3 설치하기

이 문서는 일반 Linux/macOS/WSL 터미널에서 Floop3를 빌드해 Air Terminal 6에 설치하는 절차입니다. Codex 기능이나 원격 저장소 계정은 필요하지 않습니다.

## 권장 작업 환경: UART 콘솔

장치에 처음 설치하거나 네트워크·방화벽 설정을 바꾸기 전에는 **UART 콘솔을 연결해 둘 것을 강력히 권장합니다.** Floop3 설치는 rpcd를 재시작하고 재부팅은 하지 않지만, LuCI나 SSH 연결이 끊기면 UART로 부팅·서비스 로그를 관찰하고 독립적으로 복구를 시도할 수 있습니다. 설치와 첫 접속 확인 중 UART 로그를 계속 저장하십시오.

권장 구성은 Windows 11 호스트 + WSL2 Ubuntu LTS입니다. 소스 checkout, Go 빌드, 번역 검사, SSH 배포는 WSL 터미널에서 하고 저장소는 `/mnt/c`가 아닌 WSL Linux 파일시스템(예: `~/src/floop3`)에 둡니다. USB-UART 어댑터는 Windows에 연결하고 PuTTY, Tera Term 등 Windows 시리얼 터미널에서 해당 COM 포트를 엽니다. 권장 직렬 설정은 115200 baud, 8N1, 흐름 제어 없음이며 원시 로그 캡처를 켭니다. Linux PC에서는 같은 작업을 native Ubuntu와 시리얼 터미널로 수행해도 됩니다.

현재 확보된 Air 6 UART 자료에는 1.8 V 로직 레벨 측정 보고가 있으나, 헤더의 TX/RX/GND 핀 순서는 확인되지 않았습니다. **1.8 V 호환 어댑터 또는 적절한 레벨 변환기를 사용하고, 장치별 자료와 계측으로 핀 배치·전압을 확인한 뒤 연결하십시오. 3.3 V 어댑터를 바로 연결하거나 UART VCC 핀에 전원을 넣지 마십시오.**

이 절차는 Air 6의 OpenWrt 펌웨어를 다시 빌드하거나 플래시하지 않습니다. 태그 릴리스에는 사전 빌드 Go 백엔드와 설치 파일 묶음을 첨부할 수 있습니다. 현재 확인한 대상은 호환성 표에 적힌 순정 SBA6D 버전으로 제한합니다. 다른 OpenWrt에는 설치하지 마십시오. 버전별 전체 기능 검증은 아직 완료되지 않았습니다.

## 대상과 준비물

- SoftBank Air 6에서 LuCI와 rpcd, ubus, uci가 이미 동작해야 합니다.
- PC에 Git, Bash, Go 1.25 이상, Python 3, ssh, tar, sha256sum이 필요합니다.
- root SSH 접속이 가능해야 합니다. 키 인증을 권장합니다.
- 설치는 재부팅하지 않지만 LuCI의 rpcd를 재시작합니다. 설정 백업을 만든 뒤 설치합니다.
- 설치기는 알 수 없는 /usr/sbin/sbair-netmode 구현을 발견하면 덮어쓰지 않고 중단합니다.

Floop3 앱은 vendor OpenWrt 21.02.7의 vendor MT-WiFi 연계 기능이 필요한 경우를 대상으로 합니다. 최신 OpenWrt에는 Floop3를 설치하지 않는 것을 기본으로 합니다.

순정 vendor OpenWrt 21.02.7에 LuCI가 없으면 Floop3 설치 전에 ../extras/luci-bootstrap/README.md의 bootstrap을 먼저 실행하십시오. bootstrap은 LuCI만 추가하며 MT-WiFi 드라이버를 수정·이식하지 않고 vendor ABI를 보존합니다. 대상 vendor 환경에 LuCI가 이미 있으면 bootstrap은 생략합니다. 최신 OpenWrt나 다른 release/SNAPSHOT에는 이 bootstrap의 고정 패키지 목록을 적용하지 마십시오.

## 사전 빌드 릴리스 설치

GitHub Releases에서 `floop3-<버전>-air6-linux-arm64.tar.gz`와 `.sha256`을 받습니다. 공유기 설정을 먼저 백업한 다음 WSL에서 체크섬을 확인하고 압축을 풉니다.

```sh
sha256sum -c floop3-<버전>-air6-linux-arm64.tar.gz.sha256
tar -xzf floop3-<버전>-air6-linux-arm64.tar.gz
cd floop3-<버전>-air6-linux-arm64
sha256sum -c SHA256SUMS
```

압축 파일을 공유기 `/tmp`로 복사하고 SSH로 접속합니다. `<AIR6_LAN_IP>`는 현재 공유기 주소로 바꾸십시오.

```sh
cd ..
scp -O floop3-<버전>-air6-linux-arm64.tar.gz root@<AIR6_LAN_IP>:/tmp/
ssh root@<AIR6_LAN_IP>
```

공유기 셸에서:

```sh
cd /tmp
tar -xzf floop3-<버전>-air6-linux-arm64.tar.gz
cd floop3-<버전>-air6-linux-arm64
sha256sum -c SHA256SUMS && sh ./install.sh --check && sh ./install.sh /
```

v0.1.1부터 번들에 Floop3용 한국어·일본어 카탈로그, 제거 도구 및 LuCI bootstrap이 들어 있습니다. LuCI가 없으면 동봉된 `extras/luci-bootstrap/README.ko.md`의 사전 검사부터 진행합니다. 호스트에서 OpenWrt 패키지를 내려받는 단계가 필요합니다.

설치기는 SBA6D 식별값, OpenWrt와 KNOS 버전, LuCI 의존성, 미적용 방화벽 변경 및 overlay 여유 공간을 검사합니다. 설치 중 rpcd가 재시작됩니다. Floop3의 기기 정보에서 설치된 릴리스 버전과 빌드 커밋을 확인할 수 있습니다. 제거할 때는 동봉된 `UNINSTALL-FLOOP3-KO.md`를 따릅니다.

## 소스에서 빌드하고 설치

릴리스 파일을 쓰지 않고 직접 빌드하려면 WSL에서:

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
```

`./build.sh`는 Go 백엔드만 빌드합니다. 다음 명령으로 설치 파일을 묶고 장치에 복사할 수 있습니다.

```sh
tar -czf floop3-source.tar.gz install.sh root htdocs tools/check-shell-lf.sh out/sbair-modem
scp floop3-source.tar.gz root@<AIR6_LAN_IP>:/tmp/
```

SSH로 접속한 장치에서 압축을 푼 뒤 `sh ./install.sh /`를 실행합니다. 이 설치 경로도 동일한 장치 사전 검사를 적용합니다.

설치 후 http://<AIR6_LAN_IP>/cgi-bin/luci/에 접속합니다. 전용 메뉴는 Services → SoftBank Air 6 아래에 표시되며, System → Language and Style에서 English·한국어·日本語를 선택할 수 있습니다.

## 접근 보안과 복구

설치기는 root 비밀번호나 SSH 인증을 만들거나 바꾸지 않습니다. 장치 관리 화면에서 고유하고 강한 root 비밀번호를 설정하고 SSH 공개키를 준비하십시오. SSH와 HTTP 관리 화면을 공인 WAN에 직접 노출하지 말고 신뢰할 수 있는 내부망에서만 관리합니다.

설치기는 자동 설정 백업을 만들지 않습니다. 설치 전에 LuCI의 백업 기능으로 설정을 저장하고 UART 또는 다른 관리 경로를 확보하십시오. 설치 실패 시 네트워크와 방화벽을 초기화하지 말고, SSH/UART에서 로그와 변경 파일을 확인합니다.

스크립트는 WSL/Linux/macOS에서 실행합니다. Windows에서는 WSL 터미널에서 프로젝트 디렉터리로 이동해 위 명령을 사용하면 됩니다.
