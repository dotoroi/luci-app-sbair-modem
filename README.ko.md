# SoftBank Air 6용 Floop3

[English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Floop3는 **SoftBank Air 6(RG620T-SBK / RUDOLF / SBA6D)**용 LuCI 앱입니다. 모뎀, SIM/eSIM, SMS, Wi-Fi, 연결 기기, 네트워크 설정을 관리합니다.

## 설치 전에

- 대상은 제조사 펌웨어 **OpenWrt 21.02.7**, target `gem6xxx/evb6990_cpe_mt7990_emmc`, ARM64입니다. 일반 upstream OpenWrt용 패키지가 아닙니다.
- [펌웨어 호환성 안내](docs/FIRMWARE-COMPATIBILITY-KO.md)를 확인하세요. 메타데이터가 맞아도 모든 기능이 검증됐다는 뜻은 아닙니다.
- 공유기 설정을 백업하고 SSH 또는 UART 복구 경로를 확보하세요. 설치기는 `rpcd`를 재시작하지만 공유기를 재부팅하지 않습니다.
- 릴리즈 체크섬과 `install.sh --check`를 확인하세요. 모델·기존 파일 소유권·미적용 방화벽 변경·여유 공간 검사를 우회하지 마세요.

## 처음 시작하기

1. 장치와 소스 버전에 맞는 태그 릴리즈를 선택합니다.
2. [설치 안내](docs/INSTALL-NON-CODEX-KO.md)와 [접근 설정 안내](docs/INSTALL-ACCESS-KO.md)를 따릅니다.
3. Wi-Fi, 네트워크 모드, USB NIC, 복구 절차는 [사용자 매뉴얼 목록](docs/MANUALS.ko.md)을 참고하세요.

USB NIC 기능은 실험적이며 어댑터와 펌웨어에 따라 동작이 다릅니다. SSH와 LuCI는 신뢰할 수 있는 내부망에서만 사용하고 공인 인터넷에 직접 노출하지 마세요.
