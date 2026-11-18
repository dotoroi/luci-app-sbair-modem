[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

# Codex 없이 Floop3 설치하기

이 문서는 일반 Linux/macOS/WSL 터미널에서 Floop3를 빌드해 Air Terminal 6에 설치하는 절차입니다. Codex 기능이나 원격 저장소 계정은 필요하지 않습니다.

## 대상과 준비물

- SoftBank Air 6에서 LuCI와 rpcd, ubus, uci가 이미 동작해야 합니다.
- PC에 Git, Bash, Go 1.25 이상, Python 3, ssh, tar, sha256sum이 필요합니다.
- root SSH 접속이 가능해야 합니다. 키 인증을 권장합니다.
- 설치는 재부팅하지 않지만 LuCI의 rpcd를 재시작합니다. 설정 백업을 만든 뒤 설치합니다.
- 설치기는 알 수 없는 /usr/sbin/sbair-netmode 구현을 발견하면 덮어쓰지 않고 중단합니다.

Floop3 앱은 vendor OpenWrt 21.02.7의 vendor MT-WiFi 연계 기능이 필요한 경우를 대상으로 합니다. 최신 OpenWrt에는 Floop3를 설치하지 않는 것을 기본으로 합니다.

순정 vendor OpenWrt 21.02.7에 LuCI가 없으면 Floop3 설치 전에 ../extras/luci-bootstrap/README.md의 bootstrap을 먼저 실행하십시오. bootstrap은 LuCI만 추가하며 MT-WiFi 드라이버를 수정·이식하지 않고 vendor ABI를 보존합니다. 대상 vendor 환경에 LuCI가 이미 있으면 bootstrap은 생략합니다. 최신 OpenWrt나 다른 release/SNAPSHOT에는 이 bootstrap의 고정 패키지 목록을 적용하지 마십시오.

## 빌드와 설치

공식 저장소에서 소스를 내려받아 빌드합니다.

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
./tools/check-i18n.sh
```

./build.sh는 po2lmo가 설치되어 있으면 이를 쓰고, 없으면 포함된 Python 3 변환기를 사용합니다. 필요하면 PO2LMO=/path/to/po2lmo를 지정할 수 있습니다. 빌드가 끝나면 out/sbair-modem과 일본어·한국어 .lmo 카탈로그가 있어야 합니다. 영어는 원문 메시지를 사용합니다.

장치의 현재 LAN 주소를 넣어 배포합니다.

```sh
bash tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

배포기는 root SSH, Air 6 모델, LuCI, overlay 여유 공간을 확인합니다. 설정과 기존 Floop3 경로를 /root/sbair-backups/floop3-preinstall-<UTC시각>/에 보관하고, 필요한 파일을 SSH로 전송해 install.sh /를 실행합니다. 장치의 패키지 저장소 연결은 필요하지 않고 자동 재부팅도 하지 않습니다.

추가 SSH 옵션이 필요한 경우 ~/.ssh/config를 쓰거나 AIR6_SSH_OPTS를 지정합니다.

```sh
AIR6_SSH_OPTS='-o ConnectTimeout=5' bash tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

설치 후 http://<AIR6_LAN_IP>/cgi-bin/luci/에 접속합니다. 전용 메뉴는 Services → SoftBank Air 6 아래에 표시되며, System → Language and Style에서 English·한국어·日本語를 선택할 수 있습니다.

## 접근 보안과 복구

설치기는 root 비밀번호나 SSH 인증을 만들거나 바꾸지 않습니다. 장치 관리 화면에서 고유하고 강한 root 비밀번호를 설정하고 SSH 공개키를 준비하십시오. SSH와 HTTP 관리 화면을 공인 WAN에 직접 노출하지 말고 신뢰할 수 있는 내부망에서만 관리합니다.

오류가 나면 출력된 /root/sbair-backups/floop3-preinstall-<UTC시각>/ 경로를 보존하십시오. 이 디렉터리의 before-install.tar.gz에는 기존 설정과 설치 경로 사본이 있습니다. 네트워크나 방화벽을 초기화하지 말고, SSH/UART 중 동작하는 관리 경로에서 백업 내용을 검토한 뒤 복원합니다. 설치 도중 실패하면 임시 파일은 진단을 위해 /tmp/floop3-deploy-*에 남을 수 있습니다.

스크립트는 WSL/Linux/macOS에서 실행합니다. Windows에서는 WSL 터미널에서 프로젝트 디렉터리로 이동해 위 명령을 사용하면 됩니다.



