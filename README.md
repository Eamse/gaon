# Gaon Backend & Admin Suite

Node.js(ESM) + Express 기반 이미지 업로드, 메타 관리, 프론트 테스트 툴 모음입니다.

## 특징

- Sharp 리사이즈 (large 1600px, medium 1000px, thumb 400px)
- 업로드 메타데이터 `data/uploads.json` 저장/검색/필터/정렬/페이지네이션
- 관리자 페이지에서 타이틀/카테고리 수정 및 삭제
- Project(시공사례) 페이지에서 카드 그리드 + 필터 + 정렬 + 모달 뷰
- 업로드 테스트 페이지(단일/다중) 유지
- CORS 화이트리스트, 파일 용량/확장자 제한, 통일된 JSON 에러 응답

## 준비

```bash
npm install
```

## 실행

```bash
npm run dev
# 또는
npm start
```

## 주요 스크립트

- `npm run dev`: nodemon 기반 개발 서버 (기본 4000번 포트)
- `npm start`: 프로덕션 서버

## API 요약

| Method | Path               | 설명                                         |
| ------ | ------------------ | -------------------------------------------- |
| POST   | /api/upload        | 단일 이미지 업로드 (field: `file`)           |
| POST   | /api/upload-multi  | 다중 이미지 업로드 (field: `files`, 최대 10) |
| GET    | /api/uploads       | 목록 조회 (검색/카테고리/페이지/정렬)        |
| PATCH  | /api/uploads/:name | title/category 수정                          |
| DELETE | /api/uploads/:name | 파일 및 메타 삭제                            |

응답은 공통으로 `{ ok: boolean, ... }` 포맷을 유지합니다.

## 정적 페이지

- `http://localhost:4000/upload-test.html`: 브라우저 업로드 테스트
- `http://localhost:4000/admin.html`: 관리자 페이지
- `http://localhost:4000/project/project.html`: 시공사례 그리드

## 폴더 구조

```
├── data/uploads.json
├── src
│   ├── server.js
│   ├── uploadRouter.js
│   ├── admin.html
│   ├── upload-test.html
│   ├── index.css / index.js
│   ├── layout/layout.css
│   └── project/
│       ├── project.html / project.css / project.js
└── uploads/{original,large,medium,thumb}
```

## 업로드 제한

- 확장자: jpeg, png, webp, gif, heic, heif
- 용량: 파일당 20MB, 다중 업로드 최대 10개

## 캐시/보안

- `/uploads/*` 정적 캐시 30일 · immutable
- CORS 화이트리스트: `http://localhost:4000`, `http://127.0.0.1:4000`, `http://localhost:5500`, `http://127.0.0.1:5500`
- HEAD/OPTIONS 200 처리, 미허용 메서드 405

## 데이터 파일

`data/uploads.json` 은 서버가 자동 생성합니다. Git 추적이 필요하면 직접 추가하세요.

## 라이선스

사내용 프로젝트. 필요 시 README 업데이트.
