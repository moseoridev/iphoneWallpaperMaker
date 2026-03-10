# iPhone Wallpaper Maker

오프라인으로 동작하는 `Svelte 5 + Vite` PWA입니다. 원본 사진의 비율을 유지한 채 목표 해상도에 맞는 레터박스 배경화면을 생성합니다.

## 주요 기능

- 원본 사진 1장 + 스크린샷 또는 수동 해상도 입력
- 블러 확장, 검은색, 단색 배경 선택
- JPEG 기본 저장과 PNG 옵션
- `HEIC/HEIF` 입력 지원
- GitHub Pages 배포와 오프라인 재실행 대응

## 개발

```bash
pnpm install
pnpm dev
```

## 검증

```bash
pnpm check
pnpm test
pnpm build
```
