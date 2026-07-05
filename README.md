# Oracle Admin

개인 Oracle Cloud Free Tier 서버 상태를 확인하기 위한 Next.js 관리자 화면입니다.
현재는 단일 관리자 로그인과 OCI 설정 상태 확인 화면이 구현되어 있고, 실제 Compute,
Security List/NSG, Monitoring, PostgreSQL 연동은 이후 단계에서 붙입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## Oracle Cloud 최소 용량 배포

이 앱은 로그인 세션, 서버 환경변수, 이후 OCI API/DB 호출이 필요하므로 static export가 아니라
Node.js 서버로 배포합니다. 가장 단순한 방식은 Oracle Cloud 인스턴스에서 저장소를 pull 받고
`npm install`, `npm run build`, `npm start`를 실행하는 것입니다. 다만 이 방식은 소스 전체,
개발 의존성, 빌드 캐시가 서버에 남아 용량이 커집니다.

용량을 줄이려면 Next.js standalone output을 사용합니다. 이 저장소는 `next.config.ts`에
`output: "standalone"`을 설정해 두었습니다.

빌드 서버 또는 로컬에서:

```bash
npm ci
npm run build
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/
tar -czf oracle-admin-standalone.tar.gz -C .next/standalone .
```

Oracle Cloud 인스턴스에 업로드:

```bash
scp oracle-admin-standalone.tar.gz <SSH_USER>@<SERVER_PUBLIC_IP>:/home/projects/
```

SSH 접속 시 비밀번호를 입력하는 서버라면 `scp`도 같은 비밀번호를 물어봅니다. 예를 들어
SSH 사용자가 `opc`이고 서버 IP가 `1.2.3.4`라면:

```bash
scp oracle-admin-standalone.tar.gz opc@1.2.3.4:/home/projects/
```

SSH 키 파일도 필요한 서버라면 `-i` 옵션으로 로컬 키 파일 경로를 지정합니다.

```bash
chmod 600 ~/.ssh/oracle-cloud.pem
scp -i ~/.ssh/oracle-cloud.pem oracle-admin-standalone.tar.gz <SSH_USER>@<SERVER_PUBLIC_IP>:/home/projects/
ssh -i ~/.ssh/oracle-cloud.pem <SSH_USER>@<SERVER_PUBLIC_IP>
```

예:

```bash
scp -i ~/.ssh/oracle-cloud.pem oracle-admin-standalone.tar.gz opc@1.2.3.4:/home/projects/
ssh -i ~/.ssh/oracle-cloud.pem opc@1.2.3.4
```

키 파일을 쓰면서 추가로 비밀번호를 물어본다면, 그 비밀번호는 보통 SSH key passphrase이거나
서버 계정 비밀번호입니다. 키 파일은 로컬 PC에만 두고 서버나 저장소에 업로드하지 않습니다.

Oracle Cloud 인스턴스에서:

```bash
mkdir -p /home/projects/oracle-admin
tar -xzf /home/projects/oracle-admin-standalone.tar.gz -C /home/projects/oracle-admin
cd /home/projects/oracle-admin
PORT=3000 node server.js
```

여기서 배포 경로는 `/home/projects/oracle-admin`입니다. 업로드 파일은 `/home/projects`에 두고,
압축을 푼 실행 파일은 `/home/projects/oracle-admin` 아래에 둡니다. 이 값은 Next.js 설정값이
아니라 서버에서 정하는 운영 디렉터리입니다. 다른 위치를 쓰고 싶으면 위 명령의 경로만 원하는
경로로 바꾸면 됩니다.

`scp: dest open "/home/projects/": Failure`가 뜨면 서버의 `/home/projects` 디렉터리가 없거나
현재 SSH 사용자에게 쓰기 권한이 없는 상태일 수 있습니다. 서버에 먼저 접속해서 디렉터리와
권한을 준비합니다.

```bash
ssh -i ~/.ssh/oracle-cloud.pem <SSH_USER>@<SERVER_PUBLIC_IP>
sudo mkdir -p /home/projects
sudo chown -R $USER:$USER /home/projects
```

권한을 바꾸기 어렵다면 사용자 홈으로 먼저 업로드한 뒤 서버에서 `sudo mv`로 옮깁니다.

```bash
scp -i ~/.ssh/oracle-cloud.pem oracle-admin-standalone.tar.gz <SSH_USER>@<SERVER_PUBLIC_IP>:~/
ssh -i ~/.ssh/oracle-cloud.pem <SSH_USER>@<SERVER_PUBLIC_IP>
sudo mkdir -p /home/projects
sudo mv ~/oracle-admin-standalone.tar.gz /home/projects/
```

나중에 systemd로 등록할 때도 같은 경로를 `WorkingDirectory`로 맞춥니다.

```ini
WorkingDirectory=/home/projects/oracle-admin
ExecStart=/usr/bin/node /home/projects/oracle-admin/server.js
```

이 방식으로 배포하면 운영 서버에는 최소 실행 파일, 필요한 일부 `node_modules`, 정적 파일만
올라갑니다. 서버에서 `npm install`을 다시 실행할 필요도 없습니다.

실무 권장 방식:

- 빌드는 로컬 또는 별도 CI에서 수행합니다.
- Oracle Cloud 서버에는 `.next/standalone` 산출물만 업로드합니다.
- 서버 앞에는 nginx 같은 reverse proxy를 두고 80/443만 외부에 엽니다.
- 앱은 내부 포트 예: `127.0.0.1:3000` 또는 private network 포트로만 실행합니다.
- 환경변수는 `/home/projects/oracle-admin/.env` 같은 파일에 저장하지 말고 가능하면 systemd
  `EnvironmentFile` 또는 배포 secret으로 관리합니다.

서버에서 직접 pull 받아 배포해야 한다면 최소한 아래처럼 실행합니다.

```bash
git pull
npm ci
npm run build
npm prune --omit=dev
PORT=3000 npm start
```

하지만 이 방식은 `.next`, production `node_modules`, 소스 파일이 서버에 함께 남습니다.
용량을 가장 작게 유지하려면 standalone 산출물을 만들어 올리는 방식을 권장합니다.

## nginx 3095 -> Next.js 3000 연결

앱은 서버 내부에서 `PORT=3000 node server.js`로 실행하고, 외부 접속은 nginx가 `3095` 포트로
받아 내부 `127.0.0.1:3000`으로 전달하게 구성합니다.

예시 설정:

```nginx
server {
    listen 3095;
    listen [::]:3095;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ubuntu nginx에서는 보통 아래 파일 중 하나에 추가합니다.

```bash
sudo nano /etc/nginx/sites-available/oracle-admin
sudo ln -s /etc/nginx/sites-available/oracle-admin /etc/nginx/sites-enabled/oracle-admin
sudo nginx -t
sudo systemctl reload nginx
```

`3095`로 외부 접속하려면 nginx 설정 외에도 Oracle Cloud 보안 규칙과 서버 방화벽에서 `3095`
포트가 열려 있어야 합니다.

```bash
sudo ss -ltnp | grep ':3095'
sudo ss -ltnp | grep ':3000'
```

서버 내부 확인:

```bash
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3095
```

## 환경변수 입력 위치

비밀값은 저장소에 커밋하지 않습니다. 로컬 개발에서는 프로젝트 루트의 `.env.local`에
입력하고, Oracle Cloud에 배포할 때는 배포 방식에 맞는 서버 환경변수나 런타임 env 파일에
입력합니다.

- 로컬 개발: `.env.local`
- Oracle Cloud 배포: systemd `EnvironmentFile`, Docker/Compose `env_file`, PM2 ecosystem env,
  또는 배포 플랫폼의 secret/environment settings
- 오픈소스 배포: `.env.example`만 제공하고 실제 `.env.local`, private key, DB 비밀번호는
  절대 커밋하지 않습니다.

변수명이 `NEXT_PUBLIC_`으로 시작하면 브라우저 번들에 노출될 수 있습니다. DB 접속 정보와
OCI API 키는 반드시 서버 전용 환경변수로만 사용합니다.

## 관리자 로그인 설정

회원가입은 두지 않고, 단일 관리자 계정을 환경변수로 설정합니다.

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=change-this-long-random-secret
ADMIN_SESSION_MAX_AGE_SECONDS=28800
```

- `ADMIN_USERNAME`: 로그인 아이디
- `ADMIN_PASSWORD`: 로그인 비밀번호입니다. 예시값을 그대로 사용하지 말고 비밀번호 관리기로
  생성한 16자 이상의 고유한 값을 권장합니다.
- `ADMIN_SESSION_SECRET`: 세션 쿠키 서명용 비밀값입니다. 생략하면 `ADMIN_PASSWORD`를
  대신 사용하지만, 운영에서는 비밀번호와 다른 32바이트 이상의 랜덤 값을 사용해야 합니다.
- `ADMIN_SESSION_MAX_AGE_SECONDS`: 로그인 세션 유지시간(초)입니다. 기본값은 `28800`(8시간)이며
  `300`(5분)부터 `604800`(7일)까지 설정할 수 있습니다. 숫자가 아니거나 범위를 벗어나면
  기본값 8시간을 사용합니다.

시간 입력 예시:

| 유지시간 | 입력값 |
| --- | ---: |
| 30분 | `1800` |
| 1시간 | `3600` |
| 8시간 | `28800` |
| 24시간 | `86400` |
| 7일 | `604800` |

Linux에서 세션 비밀키를 생성하는 예시입니다. 출력된 값은 서버 환경변수에만 저장하고 문서,
Git, 셸 기록 공유, 애플리케이션 로그에 남기지 않습니다.

```bash
openssl rand -base64 48
```

Node.js가 설치된 환경에서는 다음 명령도 사용할 수 있습니다.

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

비밀번호나 비밀키에 `$`가 포함되어 `.env.local`에 입력할 때는 Next.js의 변수 확장을 피하도록
`\$`로 이스케이프합니다. 운영 중 `ADMIN_SESSION_SECRET`을 변경하면 기존 로그인 세션은 모두
무효가 되며, 유지시간을 변경한 경우 새로 로그인할 때부터 적용됩니다.

### 세션 쿠키와 HTTPS

운영 빌드의 세션 쿠키는 `httpOnly`, `sameSite=lax`, `secure`로 설정됩니다. 따라서 운영 서버는
반드시 HTTPS로 접속해야 하며 `http://공인IP:3095` 같은 HTTP 주소에서는 로그인 쿠키가 저장되지
않아 새로고침 시 로그인 화면으로 돌아갈 수 있습니다.

권장 구성은 nginx가 443 HTTPS 요청을 받고 내부의 Next.js 3000 포트로 전달하는 방식입니다.
인증서가 설정된 `server` 블록의 `location /`은 하나만 두고 다음과 같이 구성합니다.

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

설정 적용 전 문법을 검사합니다.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### systemd 환경변수 예시

standalone 배포에서는 임의 이름인 `local.env`를 Next.js가 자동으로 읽는다고 가정하지 않고,
systemd의 `EnvironmentFile`로 런타임 환경변수를 전달하는 방식을 권장합니다.

예시 환경파일 `/etc/oracle-admin/oracle-admin.env`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-unique-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_SESSION_MAX_AGE_SECONDS=28800
HOSTNAME=127.0.0.1
PORT=3000
```

파일은 서비스 실행 계정과 root만 읽을 수 있도록 권한을 제한합니다.

```bash
sudo chown root:oracle-admin /etc/oracle-admin/oracle-admin.env
sudo chmod 640 /etc/oracle-admin/oracle-admin.env
```

systemd 서비스 파일에서는 다음처럼 연결합니다. 서비스의 실제 사용자와 경로에 맞게 수정합니다.

```ini
[Service]
User=oracle-admin
Group=oracle-admin
WorkingDirectory=/opt/oracle-admin
EnvironmentFile=/etc/oracle-admin/oracle-admin.env
ExecStart=/usr/bin/node /opt/oracle-admin/server.js
Restart=on-failure
```

환경변수를 변경한 뒤에는 프로세스를 다시 시작해야 합니다.

```bash
sudo systemctl daemon-reload
sudo systemctl restart oracle-admin
```

## PostgreSQL DB 연결 설정

Oracle Cloud 안에서 구동 중인 PostgreSQL은 서버 코드에서만 접속해야 합니다. 이후 DB 연동
코드는 `process.env.DATABASE_URL`을 우선 사용하도록 구성합니다.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
```

필요하면 배포 환경에서 개별 변수로 나눠 관리할 수도 있습니다.

```env
POSTGRES_HOST=10.0.0.10
POSTGRES_PORT=5432
POSTGRES_DB=oracle_admin
POSTGRES_USER=oracle_admin
POSTGRES_PASSWORD=change-this-db-password
POSTGRES_SSL=false
```

권장 방식:

- 앱과 DB가 같은 VCN/private subnet 안에 있으면 `HOST`는 DB의 private IP 또는 private DNS를
  사용합니다.
- 외부 공개 IP로 DB를 열지 않습니다.
- DB 비밀번호와 connection string은 `.env.local` 또는 서버 런타임 env에만 둡니다.
- 오픈소스용 문서에는 실제 host, user, password, database name을 적지 않습니다.

## Oracle Cloud API 설정

OCI API 호출은 브라우저에서 직접 하지 않고, Next.js 서버 라우트나 서버 컴포넌트에서만
수행합니다. 현재 앱은 아래 환경변수의 설정 여부를 확인합니다.

```env
OCI_TENANCY_ID=ocid1.tenancy.oc1..example
OCI_USER_ID=ocid1.user.oc1..example
OCI_FINGERPRINT=12:34:56:78:90:ab:cd:ef:12:34:56:78:90:ab:cd:ef
OCI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
OCI_REGION=ap-chuncheon-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..example
```

각 값의 의미:

- `OCI_TENANCY_ID`: Oracle Cloud 테넌시 OCID
- `OCI_USER_ID`: API key를 등록한 IAM user OCID
- `OCI_FINGERPRINT`: 해당 API key fingerprint
- `OCI_PRIVATE_KEY`: OCI API signing private key 내용. 운영에서는 파일 경로나 secret manager
  사용도 고려합니다.
- `OCI_REGION`: 조회할 리전입니다. 예: `ap-seoul-1`, `ap-chuncheon-1`
- `OCI_COMPARTMENT_ID`: Compute instance, VNIC, Security List/NSG, Monitoring metric을 조회할
  compartment OCID입니다. 개인 계정에서는 root compartment가 tenancy OCID와 같을 수 있지만,
  별도 compartment를 쓰면 해당 OCID를 넣습니다.

OCI API에서 확인할 예정인 항목:

- Compute API: instance 목록, lifecycle state, shape, public/private IP
- Virtual Network API: VNIC, subnet, Security List, NSG ingress rule, cloud-level open ports
- Monitoring API: CPU, network, availability 관련 metric
- Announcements API: Oracle Cloud 점검, 장애, required action 공지

주의:

- `OCI_PRIVATE_KEY`, DB 비밀번호, 관리자 비밀번호는 절대 클라이언트 컴포넌트로 전달하지
  않습니다.
- SSH 접속용 `.pem` 파일과 `OCI_PRIVATE_KEY`는 용도가 다릅니다. `.pem`은 서버 접속/SCP용이고,
  `OCI_PRIVATE_KEY`는 Oracle Cloud API signing용입니다.
- `NEXT_PUBLIC_OCI_*`, `NEXT_PUBLIC_DATABASE_URL` 같은 변수명은 사용하지 않습니다.
- 공개 저장소에는 실제 OCID를 넣지 않는 편이 좋습니다. OCID 자체가 비밀번호는 아니지만,
  개인 인프라 식별 정보라 예시값으로만 문서화합니다.

## 현재 상태

- 구현됨: 관리자 로그인, 설정 가능한 만료시간의 서명된 httpOnly 세션 쿠키, 로그인 전 상태 API
  차단, OCI 설정 상태 대시보드, Linux 서버 리스닝 포트 조회
- 예정: PostgreSQL 연결, OCI SDK 연동, Compute 상태 조회, 보안 규칙 기반 포트 목록, Monitoring
  metric 조회

## 검증

```bash
npm run lint
npm run build
```
