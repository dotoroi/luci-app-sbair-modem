# Floop3 제거

v0.1.1부터 설치기가 기록한 파일 목록을 기준으로 제거할 수 있습니다. LuCI, 순정 UI, 네트워크 설정, APN·SMS 데이터와 기본 언어팩은 보존합니다.

공유기의 관리자 SSH 세션에서 배포 번들의 디렉터리로 이동해 실행합니다.

```sh
sh tools/uninstall-floop3.sh --check
sh tools/uninstall-floop3.sh
```

Floop3에서 네트워크를 관리 중이라면 먼저 순정 모드로 복귀하고 관리 해제를 확인합니다. 미적용 방화벽 변경이나 진행 중인 네트워크 전환이 있으면 제거를 보류합니다.

제거기는 대상 파일과 방화벽 설정을 `/root/sbair-backups/floop3-removal.*/before-remove.tar.gz`에 저장합니다. 이전 설치로 되돌리려면 제거 백업과 별도로 만들어 둔 설치 전 백업을 사용합니다. 설치 기록이 없는 버전은 설치 전 백업의 파일 목록을 기준으로 복원합니다.
