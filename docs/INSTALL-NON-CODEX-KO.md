[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

# Codex 없이 Floop3 설치하기

이 문서는 일반 Linux/macOS/WSL 터미널에서 Floop3를 빌드해 Air Terminal 6에 설치하는 절차입니다. Codex 기능이나 원격 저장소 계정은 필요하지 않습니다.

## 권장 작업 환경: UART 콘솔

장치에 처음 설치하거나 네트워크·방화벽 설정을 바꾸기 전에는 **UART 콘솔을 연결해 둘 것을 강력히 권장합니다.** Floop3 설치는 rpcd를 재시작하고 재부팅은 하지 않지만, LuCI나 SSH 연결이 끊기면 UART로 부팅·서비스 로그를 관찰하고 독립적으로 복구를 시도할 수 있습니다. 설치와 첫 접속 확인 중 UART 로그를 계속 저장하십시오.

권장 구성은 Windows 11 호스트 + WSL2 Ubuntu LTS입니다. 소스 checkout, Go 빌드, 번역 검사, SSH 배포는 WSL 터미널에서 하고 저장소는 `/mnt/c`가 아닌 WSL Linux 파일시스템(예: `~/src/floop3`)에 둡니다. USB-UART 어댑터는 Windows에 연결하고 PuTTY, Tera Term 등 Windows 시리얼 터미널에서 해당 COM 포트를 엽니다. 권장 직렬 설정은 115200 baud, 8N1, 흐름 제어 없음이며 원시 로그 캡처를 켭니다. Linux PC에서는 같은 작업을 native Ubuntu와 시리얼 터미널로 수행해도 됩니다.

현재 확보된 Air 6 UART 자료에는 1.8 V 로직 레벨 측정 보고가 있으나, 헤더의 TX/RX/GND 핀 순서는 확인되지 않았습니다. **1.8 V 호환 어댑터 또는 적절한 레벨 변환기를 사용하고, 장치별 자료와 계측으로 핀 배치·전압을 확인한 뒤 연결하십시오. 3.3 V 어댑터를 바로 연결하거나 UART VCC 핀에 전원을 넣지 마십시오.**

이 절차는 Air 6 펌웨어를 다시 빌드하거나 플래시하지 않습니다. 태그 릴리스에는 사전 빌드 Go 백엔드와 설치 파일 묶음을 첨부할 수 있습니다. 설치기는 SoftBank Air 6 모델과 ARM64 실행 환경을 확인하며 KNOS/OpenWrt 버전 목록으로 제한하지 않습니다. 일반 upstream OpenWrt에는 설치하지 마십시오. 펌웨어별 전체 기능 검증은 완료되지 않았습니다.

## 대상과 준비물

- SoftBank Air 6에서 LuCI와 rpcd, ubus, uci가 이미 동작해야 합니다.
- PC에 Git, Bash, Go 1.25.5 이상, Python 3, ssh, tar, sha256sum이 필요합니다.
- root SSH 접속이 가능해야 합니다. 키 인증을 권장합니다.
- 설치는 재부팅하지 않지만 LuCI의 rpcd를 재시작합니다. 설정 백업을 만든 뒤 설치합니다.
- 설치기는 알 수 없는 /usr/sbin/sbair-netmode 구현을 발견하면 덮어쓰지 않고 중단합니다.

Floop3 앱은 SoftBank Air 6 제조사 펌웨어의 vendor MT-WiFi 연계 기능을 사용합니다. 일반 upstream OpenWrt용 패키지가 아닙니다.

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

릴리즈 번들에는 Floop3용 한국어·일본어 카탈로그, 제거 도구 및 LuCI bootstrap이 들어 있습니다. 장치의 `release-manifest.json`에서 버전과 소스 커밋을 확인하고, 지정 브랜치 소스와 일치하지 않는 이전 태그 바이너리를 섞지 마세요. LuCI가 없으면 동봉된 `extras/luci-bootstrap/README.ko.md`의 사전 검사부터 진행합니다. 호스트에서 OpenWrt 패키지를 내려받는 단계가 필요합니다.

설치기는 SoftBank Air 6 보드 식별값과 `aarch64` 실행 환경, LuCI 의존성, 미적용 방화벽 변경 및 overlay 여유 공간을 검사합니다. KNOS/OpenWrt 버전은 진단 정보로 표시하며 고정 허용 목록으로 제한하지 않습니다. `/overlay` 여유 공간이 24 MiB보다 적거나 검사를 통과하지 못하면 우회하지 말고 원인을 해결하세요. 설치 중 rpcd가 재시작됩니다. Floop3의 기기 정보에서 설치된 릴리즈 버전과 빌드 커밋을 확인할 수 있습니다. 제거할 때는 `docs/UNINSTALL-FLOOP3-KO.md`를 따릅니다.

## 소스에서 빌드하고 설치

릴리스 파일을 쓰지 않고 직접 빌드하려면 WSL에서:

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
```

`./build.sh`는 Go 백엔드와 일본어·한국어 LuCI 카탈로그를 만듭니다. 영어는 소스의 문구를 사용합니다.

### WSL 없는 Windows 네이티브 빌드

[go.dev/dl](https://go.dev/dl/)에서 Go 1.25.5 이상을 설치하고 `go/bin` 디렉터리를 `PATH`에 추가합니다. [Git for Windows](https://git-scm.com/download/win)도 설치하십시오. 프로젝트 스크립트는 POSIX 호환 셸과 도구를 사용하므로 **Git Bash**에서 실행합니다. Python 3도 설치해 Git Bash에서 `python3` 또는 `python` 명령을 쓸 수 있게 합니다. 패키징은 기본적으로 `python3`을 사용하며, Python 명령이 `python`이라면 `PYTHON3=python`을 지정합니다.

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
./tools/package-release.sh vX.Y.Z
```

Python 명령이 `python`이라면 `PYTHON3=python ./tools/package-release.sh vX.Y.Z`를 사용합니다. 패키징 명령은 백엔드를 다시 빌드하고 `out/release/floop3-vX.Y.Z-air6-linux-arm64.tar.gz`와 `.sha256`을 만듭니다. `vX.Y.Z`는 실제 릴리스 태그로 바꾸십시오. Git Bash에서 먼저 `go version`, 사용할 Python 명령의 `--version`, `git status --short`를 확인합니다. PowerShell만으로는 스크립트가 요구하는 POSIX 셸 명령을 제공하지 않습니다.

```sh
./tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

배포 도구는 장치 식별·여유 공간을 검사하고 설치 전 설정과 파일을 백업합니다. Go 바이너리만 다른 소스 버전에서 가져와 교체하지 마세요.

설치 후 http://<AIR6_LAN_IP>/cgi-bin/luci/에 접속합니다. 전용 메뉴는 Services → SoftBank Air 6 아래에 표시되며, System → Language and Style에서 English·한국어·日本語를 선택할 수 있습니다.

## 접근 보안과 복구

설치기는 root 비밀번호나 SSH 인증을 만들거나 바꾸지 않습니다. 장치 관리 화면에서 고유하고 강한 root 비밀번호를 설정하고 SSH 공개키를 준비하십시오. SSH와 HTTP 관리 화면을 공인 WAN에 직접 노출하지 말고 신뢰할 수 있는 내부망에서만 관리합니다.

설치기는 자동 설정 백업을 만들지 않습니다. 설치 전에 LuCI의 백업 기능으로 설정을 저장하고 UART 또는 다른 관리 경로를 확보하십시오. 설치 실패 시 네트워크와 방화벽을 초기화하지 말고, SSH/UART에서 로그와 변경 파일을 확인합니다.

스크립트는 Windows의 Git Bash 또는 Linux/macOS 터미널에서 실행합니다. Windows에 Go와 Git Bash를 준비하면 WSL은 필수가 아닙니다.
