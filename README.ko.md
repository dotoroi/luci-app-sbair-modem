[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[User manuals / 사용자 안내서 / ユーザーマニュアル](docs/MANUALS.md)

# luci-app-sbair-modem

SoftBank Air 6 (RG620T-SBK / RUDOLF)의 벤더 수정 OpenWrt 21.02.7 펌웨어를 위한 LuCI 앱입니다. 모뎀 상태와 제어, SIM/eSIM 관리, APN 및 SMS, Wi-Fi와 연결 기기 관리, AP/브리지 및 유선 WAN 모드, USB 기기 정보, OTA/FOTA 유지보수 기능을 제공합니다.

> 이 프로젝트는 기기 제조사 OpenWrt 21.02.7 환경을 대상으로 합니다. 최신 upstream OpenWrt용 범용 패키지가 아닙니다.

## 기능

- 이동통신 모뎀 상태, 무선 상세 정보, SIM/eSIM, SIM 잠금, IMS, APN, SMS, 재설정
- Wi-Fi 설정과 진단
- 연결 기기 목록과 네트워크 모드 관리
- 기기 및 USB 정보, OTA/FOTA 유지보수
- LuCI 영어·일본어·한국어 번역
- 선택형 USB 네트워크 어댑터 기능은 실험적이며 하드웨어와 설정에 따라 달라집니다.

화면에서는 민감한 식별 정보를 기본적으로 가려 표시합니다.

## 빌드 및 설치

필요 조건과 빌드·설치 절차는 저장소 문서를 참고하세요.

- [빌드 및 설치 안내](docs/INSTALL-NON-CODEX-KO.md)
- [접속 및 비밀번호 안내](docs/INSTALL-ACCESS-KO.md)
- [API 및 화면 참고](docs/API.md)

번역 카탈로그는 `po/`에 있습니다. LuCI의 `po2lmo`를 지정해 `PO2LMO=/path/to/po2lmo ./tools/build-i18n.sh`로 빌드한 뒤 `install.sh`로 설치 대상 rootfs에 반영합니다.

## 라이선스

[LICENSE](LICENSE)를 참고하세요.


