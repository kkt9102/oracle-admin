# 백엔드 API 계약

## 서버 리스닝 포트 조회

`GET /api/system/ports`

- 인증: 관리자 세션 쿠키 필수
- 캐시: 사용하지 않음
- 실행 환경: Node.js Runtime이 설치된 Linux 서버

성공 응답 (`200`):

```json
{
  "generatedAt": "2026-07-04T00:00:00.000Z",
  "available": true,
  "source": "ss",
  "message": "현재 서버에서 연결을 기다리는 TCP·UDP 포트입니다.",
  "ports": [
    {
      "protocol": "tcp",
      "port": 3000,
      "address": "0.0.0.0",
      "binding": "all",
      "service": "Next.js",
      "processName": "node",
      "processId": 1234
    }
  ]
}
```

`binding` 값은 `all`, `loopback`, `interface` 중 하나다. `available`이 `false`이면 `ports`는 빈 배열이며, `message`에 사용자용 안내를 제공한다.

인증 실패 응답 (`401`):

```json
{
  "message": "로그인이 필요합니다."
}
```

이 API는 운영체제에서 실제로 리스닝 중인 포트를 반환한다. OCI Security List 또는 NSG에서 외부 접근을 허용했는지는 나타내지 않는다.
