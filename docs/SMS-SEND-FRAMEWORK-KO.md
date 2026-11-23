# SMS 송수신 구현 사례와 Floop3 발신 골격

## 확인 결과

OpenWrt에는 SMS 송수신을 구현한 LuCI 사례가 있다.

- [`luci-app-sms-tool-js`](https://github.com/4IceG/luci-app-sms-tool-js)는 `sms_tool`을 호출해 송수신·USSD·AT 명령을 제공하는 LuCI 프런트엔드 사례다.
- [`luci-app-sms-tool`](https://github.com/rchris494/luci-app-sms-tool)는 LuCI 화면과 rpcd/ubus 백엔드를 분리하고, PDU 모드 발신 및 수신 확인을 묶은 사례다.
- [OpenWrt SMS 보내기 문서](https://openwrt.org/docs/guide-user/advanced/howto.send.sms)는 `AT+CMGS`를 이용하는 기본 대화 흐름(발신 명령, `>` 프롬프트, 본문, Ctrl+Z, `+CMGS`/오류 응답)을 설명한다.

이 프로젝트에 그대로 넣을 수 있는 코드는 아니다. 일반적인 `sms_tool` 구현은 TTY/시리얼 모뎀을 전제로 하는 반면 Air Terminal 6은 `/dev/adb_atci_socket`의 `atcid`를 사용한다. Floop3의 `ATChannel`이 이미 모뎀 전체 접근을 직렬화하므로, 별도 도구나 별도 AT 연결을 추가하면 동시 연결로 기존 세션을 끊을 위험이 있다.

Quectel 자료는 RG620T-SBK 제품 사양에 SMS 기능을 표시한다. 이는 모듈 기능의 근거일 뿐, SBA6D 펌웨어에서 발신이 활성화되어 있거나 KT 망에서 성공한다는 증거는 아니다. 관련 AT 명령 동작은 [Quectel RG620T-SBK 제품 자료](https://www.quectel.com/content/uploads/2025/01/Quectel_Product_Brochure_V8.2.pdf) 및 해당 펌웨어의 실제 질의 결과로 별도 확인해야 한다.

## 현재 Floop3 상태

- `src/sbair-modem/sms.go`: `AT+CMGF=0`, `AT+CMGL=4`로 SMS를 읽고 PDU를 파싱·재조립한다.
- `src/sbair-modem/smsdb.go`: 수신 메시지를 로컬 SQLite 저장소에 가져오고 중복을 관리한다.
- `src/sbair-modem/pdu.go`: SMS-DELIVER PDU 디코더가 있다. SMS-SUBMIT 인코더는 없다.
- `htdocs/luci-static/resources/view/sbair/sms.js`: 수신·삭제 화면이며 발신은 지원하지 않는다.
- `rpcd.go`의 SMS RPC 목록에도 발신 메서드는 없다.
- `ATChannel.Command()`은 최종 `OK`/오류까지 읽는 단일 명령 API다. `AT+CMGS`처럼 명령 중간의 `>` 프롬프트에서 본문을 이어 보내야 하는 흐름을 처리하지 못한다.
- `AT+CMGL=4`는 모뎀의 미확인 SMS를 읽음으로 바꿀 수 있다. 기존 수신 동작의 이 부작용은 발신과 별개로 UI에 계속 고지해야 한다.

## 추가한 코드 골격의 범위

`src/sbair-modem/sms_submit.go`는 발신 요청/결과 타입, 입력 검증 지점, 이후 구현이 따라야 할 transport 인터페이스만 정의한다. RPC 등록, ACL 권한, UI 버튼, PDU 생성, AT 송신은 추가하지 않았다. 따라서 설치해도 발신 기능은 생기지 않으며, SMS도 전송되지 않는다.

## 구현 시 권장 흐름

1. 입력 검증: 국제 전화번호 형식, UTF-8 유효성, 빈 본문·크기 제한을 확인한다. 목적지 문자열에는 AT 명령 구분자나 제어문자를 허용하지 않는다.
2. 인코딩: SMS-SUBMIT TPDU를 GSM-7/UCS-2로 인코딩하고, GSM-7 확장 문자와 UCS-2 surrogate pair를 고려해 분할·UDH를 만든다. 기본 인코딩의 문자 수만으로 분할하면 안 된다.
3. 채널: 항상 기존 `ATChannel`과 프로세스 간 잠금을 사용한다. 대화형 프롬프트를 처리하도록 제한시간·취소·최종 응답 처리를 추가하되 명령 재전송은 자동으로 하지 않는다.
4. 전송 상태: `>` 확인 후 PDU를 보내고 Ctrl+Z를 보낸 뒤 `+CMGS: <mr>`와 최종 `OK`를 확인한다. `+CMS ERROR` 또는 불완전 응답은 실패/불명 상태로 기록하고 중복 발송 위험 때문에 자동 재시도하지 않는다.
5. UI/RPC: 이후 별도의 쓰기 권한 RPC와 명시적 확인 UI를 추가한다. 보낸 번호, 시각, 모뎀 결과, 참조 번호를 저장하되 본문 보관 정책은 수신 DB와 분리해 결정한다.
6. 사전 조건: 실제 발신 승인 전에 모뎀의 명령 지원, SIM/망 상태, SMS 서비스 등록을 읽기 전용으로 확인한다. IMS SMS 상태는 `AT+CIREG?` 및 서비스 비트와 함께 확인하되 `config_on` 값만으로 등록을 단정하지 않는다.

## 검증 경계

현재 확보된 근거는 OpenWrt의 공개 구현 사례, 모듈 제품 사양, 그리고 Floop3 소스 구조다. SBA6D 순정/Floop3에서의 실제 발신 성공, 사업자별 과금·제한, `atcid`가 `>` 프롬프트를 어떤 형태로 전달하는지는 아직 검증되지 않았다. 실제 SMS 발송은 외부 수신자에게 메시지를 보내고 과금될 수 있으므로, 구현 후 별도 사용자 승인과 지정된 시험 수신자가 필요하다.
