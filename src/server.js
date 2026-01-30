import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import prisma from './db.js';
import uploadRouter from './uploadRouter.js';
import projectRouter from './projectRouter.js';
import userRouter from './userRouter.js';
import inquiryRouter from './inquiryRouter.js';
import metricsRouter from './metricsRouter.js';
import logger, { httpLogger } from './utils/logger.js';
import { loadAndValidateEnv, env } from './env-validator.js';

// 환경변수 로드 및 검증 (서버 시작 전 가장 먼저 실행)
dotenv.config();
loadAndValidateEnv();

// ---------------------------
// PATH 설정
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// 업로드 관련 폴더가 없으면 자동 생성 (동기 처리)
const DIR_ORIGINAL = path.join(UPLOAD_DIR, 'original');
const DIR_LARGE = path.join(UPLOAD_DIR, 'large');
const DIR_MEDIUM = path.join(UPLOAD_DIR, 'medium');
const DIR_THUMB = path.join(UPLOAD_DIR, 'thumb');

[UPLOAD_DIR, DIR_ORIGINAL, DIR_LARGE, DIR_MEDIUM, DIR_THUMB].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    } catch (err) {
      logger.error(`Failed to create directory ${dir}: ${err.message}`);
    }
  }
});

// ---------------------------
// Express 기본 설정
// ---------------------------
const app = express();
const PORT = env.PORT;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// HTTP 요청 로깅 미들웨어
app.use(httpLogger);

const VISIT_SALT = env.VISIT_SALT;
const ADMIN_BASIC_USER = env.ADMIN_BASIC_USER;
const ADMIN_BASIC_PASS = env.ADMIN_BASIC_PASS;

const shouldLogVisit = (req) => {
  if (req.method !== 'GET') return false;
  if (req.path === '/') return false;
  if (req.path.startsWith('/api')) return false;
  if (req.path.includes('.')) return false;
  return !!req.accepts('html');
};

const logVisit = async (req) => {
  const rawIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '';
  const ip = rawIp.replace('::ffff:', '');
  const ipHash = crypto
    .createHash('sha256')
    .update(`${ip}${VISIT_SALT}`)
    .digest('hex');

  await prisma.visitLog.create({
    data: {
      ipHash,
      userAgent: req.headers['user-agent'] || '',
      path: req.path.slice(0, 255),
      referrer: (req.get('referer') || '').slice(0, 255),
    },
  });
};

app.use((req, res, next) => {
  if (shouldLogVisit(req)) {
    logVisit(req).catch((err) =>
      logger.error(`Visit log error: ${err.message || err}`)
    );
  }
  next();
});

// ---------------------------
// 관리자 정적 자원 보호 (Basic Auth, env 미설정 시 통과)
// ---------------------------
const adminGuard = (req, res, next) => {
  if (!ADMIN_BASIC_USER || !ADMIN_BASIC_PASS) return next();
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="admin"');
    return res.status(401).send('Authentication required');
  }
  const decoded = Buffer.from(header.split(' ')[1] || '', 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user === ADMIN_BASIC_USER && pass === ADMIN_BASIC_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="admin"');
  return res.status(401).send('Invalid credentials');
};

const adminStaticPaths = new Set([
  '/src/admin-projects.html',
  '/src/admin-gallery.html',
  '/src/admin-inquiries.html',
  '/src/admin-projects.js',
  '/src/admin-gallery.js',
  '/src/admin-inquiries.js',
  '/src/admin-projects.css',
]);

const serveSrc = express.static(SRC_DIR);
app.use('/src', (req, res, next) => {
  if (adminStaticPaths.has(req.path)) {
    return adminGuard(req, res, () => serveSrc(req, res, next));
  }
  return serveSrc(req, res, next);
});

// ---------------------------
// CORS 설정
// ---------------------------
const ALLOWED_ORIGINS = new Set([
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:4001',
  'http://127.0.0.1:4001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5502',
  'http://127.0.0.1:5502',
  'https://gaoninterior.kr',
  'http://gaoninterior.kr',
  'https://www.gaoninterior.kr',
  'http://www.gaoninterior.kr',
  'https://admin.gaoninterior.kr',
  'http://admin.gaoninterior.kr',
]);

const corsOptions = {
  origin(origin, callback) {
    // 브라우저가 Origin을 보내지 않는 경우(null, same-origin) 허용
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'], // 인증 헤더 명시적 허용
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // 모든 경로에 대해 Preflight(OPTIONS) 요청 허용
// ---------------------------
// 정적 파일 제공
// ---------------------------
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    },
  })
);

// ---------------------------
// SSR-Lite: 프로젝트 상세 페이지 동적 메타 태그 처리
// ---------------------------
app.get('/project/project-detail.html', async (req, res, next) => {
  const projectId = parseInt(req.query.id);
  // ID가 없거나 유효하지 않으면 정적 파일 서빙으로 넘어감
  if (!projectId || isNaN(projectId)) {
    return next();
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    // 프로젝트가 없으면 정적 파일 서빙 (Client-side에서 "존재하지 않음" 처리하도록)
    if (!project) return next();

    // HTML 파일 읽기
    const filePath = path.join(PUBLIC_DIR, 'project', 'project-detail.html');
    let html = await fs.promises.readFile(filePath, 'utf-8');

    // 메타 데이터 생성
    const title = `${project.title} · 가온 인테리어`;
    const description = `${project.location || '경기'} ${project.area ? project.area + '평' : ''} ${project.category || '인테리어'} 프로젝트 시공사례입니다.`;

    // 이미지 URL 처리 (절대 경로로 변환)
    let imageUrl = project.mainImage || 'https://gaoninterior.kr/public/image/logo.png';
    if (imageUrl && !imageUrl.startsWith('http')) {
      // 이미지 경로가 /로 시작하면 제거 (중복 방지)
      const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
      imageUrl = `https://gaoninterior.kr/${cleanPath}`;
    }

    // HTML 내 메타 태그 교체 (Regex 사용)
    // 1. Title
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`);

    // 2. Description
    html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`);
    html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`); // og:description이 없을 수도 있으니 주의

    // 3. Image
    html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${imageUrl}" />`);

    // 4. URL
    const canonicalUrl = `https://gaoninterior.kr/project/project-detail.html?id=${projectId}`;
    html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${canonicalUrl}" />`);
    // Canonical 태그가 있다면 교체
    html = html.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${canonicalUrl}" />`);

    // 수정된 HTML 전송
    res.send(html);

  } catch (err) {
    logger.error(`SSR Error for project ${projectId}: ${err.message}`);
    // 에러 발생 시에도 안전하게 정적 파일 서빙으로 폴백
    next();
  }
});

app.use(express.static(PUBLIC_DIR));

// ---------------------------
// 관리자 루트 경로 처리
// ---------------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin/admin-login.html'));
});

app.get('/admin/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin/admin-login.html'));
});

// ---------------------------
// Clean URL 처리 (확장자 없이 HTML 파일 서빙)
// ---------------------------
app.use((req, res, next) => {
  // API 요청이나 파일 확장자가 있는 요청은 건너뜀
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }

  // /admin/ 경로 처리
  if (req.path.startsWith('/admin/')) {
    const adminPath = req.path.replace('/admin/', '');
    const candidates = [
      path.join(PUBLIC_DIR, 'admin', `${adminPath}.html`),
      path.join(PUBLIC_DIR, 'admin', adminPath, `${path.basename(adminPath)}.html`),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
  }

  // 일반 경로 처리
  const candidates = [
    path.join(PUBLIC_DIR, `${req.path}.html`),
    path.join(PUBLIC_DIR, req.path, `${path.basename(req.path)}.html`),
  ];

  // 파일이 존재하는지 확인하고 서빙
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }

  // HTML 파일이 없으면 다음 미들웨어로
  next();
});

// ---------------------------
// 헬스 체크 라우트
// ---------------------------
// app.get('/', (req, res) => {
//   res.json({ ok: true, message: 'Gaon backend is running' });
// });


// ---------------------------
// 실제 API 라우트
// ---------------------------
app.use('/api', uploadRouter);
app.use('/api/projects', projectRouter);
app.use('/api/users', userRouter);
app.use('/api/inquiries', inquiryRouter);
app.use('/api/metrics', metricsRouter);

// ---------------------------
// OPTIONS / HEAD 핸들링
// ---------------------------
app.use((req, res, next) => {
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  return next();
});

// ---------------------------
// 에러 핸들러
// ---------------------------
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });

  // JWT 인증 관련 에러 처리 (토큰 만료 등)
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ ok: false, error: 'Token expired' });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }

  const status = err.status || err.statusCode || 500;
  const payload = {
    ok: false,
    error: err.message || 'Internal Server Error',
  };
  if (env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
});

// ---------------------------
// 404 핸들러
// ---------------------------
app.use((req, res) => {
  const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  return res.status(404).json({ ok: false, error: 'Not Found' });
});

// ---------------------------
// 서버 실행
// ---------------------------
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`API docs enabled: ${env.ENABLE_API_DOCS}`);
});
