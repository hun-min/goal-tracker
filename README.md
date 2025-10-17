# Goal Tracker 배포 가이드

## 1. Dropbox 앱 설정 완료 후

1. `.env.local` 파일을 열고 Dropbox App Key와 App Secret을 입력하세요
2. 의존성 설치: `npm install`
3. 로컬 테스트: `npm run dev`

## 2. Vercel 배포

1. GitHub에 코드 푸시
2. Vercel 접속: https://vercel.com
3. "Import Project" 클릭
4. GitHub 저장소 선택
5. Environment Variables 설정:
   - `DROPBOX_APP_KEY`: Dropbox App Key
   - `DROPBOX_APP_SECRET`: Dropbox App Secret
6. Deploy 클릭

## 3. 배포 후 Dropbox 설정 업데이트

1. Dropbox 개발자 콘솔로 돌아가기
2. Settings 탭 > Redirect URIs에 추가:
   - `https://your-app.vercel.app/api/dropbox/callback`
3. Save 클릭

완료!
