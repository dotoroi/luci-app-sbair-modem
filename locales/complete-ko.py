"""Complete Korean UI labels without changing RPC names or configuration values."""
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
translations = {
    'Gateway': '게이트웨이', 'Gateway: ': '게이트웨이: ', ' / Gateway ': ' / 게이트웨이 ',
    'Fallback': '대체 설정', 'Cellular': '모바일 회선', 'Cellular WAN': '모바일 WAN',
    'Fallback IP': '대체 IP 주소', 'Fallback Netmask': '대체 서브넷 마스크',
    'AP / Bridge': 'AP / 브리지',
    'Ethernet link rate / duplex': '이더넷 링크 속도 / 통신 방식',
    'USB Host network candidate': 'USB 호스트 네트워크 후보', 'USB bus speed': 'USB 버스 속도',
    'Historical throughput references': '기존 전송 속도 측정 참고값',
    'RTL8156 raw LAN — Air6 → NAS': 'RTL8156 LAN 직접 연결 — Air6 → NAS',
    'RTL8156 raw LAN — NAS → Air6': 'RTL8156 LAN 직접 연결 — NAS → Air6',
    '5GHz / 160 MHz client → NAS via Air6': '5GHz / 160MHz 단말 → Air6 경유 → NAS',
    'Bridge': '브리지', 'Bridge members': '브리지 구성 인터페이스',
    'Network devices': '네트워크 장치', 'USB Host network candidates': 'USB 호스트 네트워크 후보',
    'Cell ID': '셀 ID', 'Provisioning': '초기 설정',
    'Provenance': '출처 정보', 'USB speed': 'USB 속도', 'bcdUSB / device class': 'bcdUSB / 장치 클래스',
    'Preflight NG': '사전 점검 실패', 'Rollback required': '복원 필요', 'Preflight OK': '사전 점검 통과',
    'Bundle': '번들', 'Support level': '지원 수준', 'Kernel': '커널', 'Architecture': '아키텍처',
    'Driver SHA256': '드라이버 SHA256', 'Driver vermagic': '드라이버 커널 호환 정보',
    'License': '라이선스', 'Upstream revision': '원본 소스 리비전',
    'UDC state / speed': 'UDC 상태 / 속도', 'UDC binding': 'UDC 연결',
    'Loaded USB modules': '로드된 USB 모듈', 'Activation profile': '활성화 프로필',
    'Runtime': '현재 실행 상태', 'Management path': '관리 접속 경로', 'Preflight': '사전 점검',
    'USB Gadget（CDC-NCM NIC）': 'USB 가젯(CDC-NCM 네트워크 장치)',
    'USB bus / root hub': 'USB 버스 / 루트 허브', 'USB Host buses / root hubs': 'USB 호스트 버스 / 루트 허브',
    'OWE(Enhanced Open)': 'OWE(향상된 개방형 보안)',
    'Vendor persistent': '제조사 영구 설정', 'Radio / AP interface': '무선 장치 / AP 인터페이스',
    'Enabled': '활성화 여부', 'Protocol': '프로토콜', 'HTMode': '무선 동작 모드',
    'Channel': '채널', 'Bandwidth': '대역폭', 'Frequency (primary / center)': '주파수(주 채널 / 중심)',
    'Beacon / Tx power': '비콘 / 송신 출력', 'Association count': '연결 단말 수',
    'Band Steering': '밴드 스티어링', 'UCI hash changed?': 'UCI 해시 변경 여부',
    'Vendor persistent changed?': '제조사 영구 설정 변경 여부',
    'Runtime only changed?': '현재 실행 상태만 변경되었는지 여부',
    'Known-good profile': '정상 상태 기준 프로필', 'Vendor persistent metadata': '제조사 영구 설정 메타데이터',
    'DHCP packet guard': 'DHCP 패킷 보호', 'Safe Apply pending': '안전 적용 확인 대기',
    'LAN DHCPサーバー': 'LAN DHCP 서버',
    'Air 6からLANクライアントへのIP配布を管理します。': 'Air 6가 LAN 단말에 배포하는 IP 주소를 관리합니다.',
    'この設定はAir 6がLAN端末へIPを配る「LAN DHCPサーバー」です。': '이 설정은 Air 6가 LAN 단말에 IP 주소를 배포하는 LAN DHCP 서버 설정입니다.',
    'Air 6自身が親ルーターから管理IPを取得する「DHCPクライアント設定」には影響しません。': 'Air 6가 상위 공유기에서 관리 IP를 받는 DHCP 클라이언트 설정에는 영향을 주지 않습니다.',
    '接続モード（AP / Bridge）': '연결 모드(AP / 브리지)',
    'DHCPサーバーを無効化': 'DHCP 서버 비활성화',
    'LAN端末へのDHCPサーバーを無効化します。DHCPをAir 6に依存する端末はIPを更新できなくなる場合があります。続行しますか?': 'LAN 단말용 DHCP 서버를 비활성화합니다. Air 6에서 IP 주소를 받는 단말은 주소를 갱신하지 못할 수 있습니다. 계속하시겠습니까?',
    'DHCPサーバーを有効化': 'DHCP 서버 활성화',
    'LAN端末へのDHCPサーバーを有効化します。同一LAN上に別のDHCPサーバーがあると競合する場合があります。続行しますか?': 'LAN 단말용 DHCP 서버를 활성화합니다. 같은 LAN에 다른 DHCP 서버가 있으면 충돌할 수 있습니다. 계속하시겠습니까?',
    'EasyMeshが有効になっている場合、自動的にDHCPが有効に戻ることがあります。本機能ではEasyMeshの設定を自動変更しません。': 'EasyMesh가 활성화되어 있으면 DHCP가 자동으로 다시 켜질 수 있습니다. 이 기능은 EasyMesh 설정을 자동으로 변경하지 않습니다.',
    'AP / Bridgeとして運用する前に、必要に応じて純正WebUI側でEasyMeshの設定を手動で確認してください。': 'AP / 브리지 모드로 사용하기 전에 필요하면 순정 웹 관리 화면에서 EasyMesh 설정을 확인하십시오.',
    '再読み込み': '새로고침', ' (SQLite)。': ' (SQLite).',
}

# Match comments before strings so apostrophes in comments cannot hide UI strings.
tokens = re.compile(r'''//[^\n]*|/\*[\s\S]*?\*/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"''')
paths = [*root.glob('htdocs/luci-static/resources/view/sbair/*.js'),
         root/'htdocs/luci-static/resources/tools/sbair.js']
changes = 0
for path in paths:
    def replace(match):
        global changes
        token = match.group()
        if token.startswith('/'):
            return token
        text = token[1:-1]
        translated = translations.get(text)
        if translated is None:
            return token
        changes += 1
        quote = token[0]
        return quote + translated.replace('\\', '\\\\').replace(quote, '\\'+quote) + quote
    path.write_text(tokens.sub(replace, path.read_text(encoding='utf8')), encoding='utf8', newline='')
(root/'locales/ko-ui-additions.json').write_text(json.dumps(translations,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Updated UI strings:',changes)
