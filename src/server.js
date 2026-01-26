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

dotenv.config();

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
      console.log(`✅ Created directory: ${dir}`);
    } catch (err) {
      console.error(`❌ Failed to create directory ${dir}: ${err.message}`);
    }
  }
});

// ---------------------------
// Express 기본 설정
// ---------------------------
const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

const VISIT_SALT = process.env.VISIT_SALT || 'visit-salt';
const ADMIN_BASIC_USER = process.env.ADMIN_BASIC_USER;
const ADMIN_BASIC_PASS = process.env.ADMIN_BASIC_PASS;

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
      console.error('visit log error:', err.message || err)
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
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5502',
  'http://127.0.0.1:5502',
  'https://gaoninterior.kr',
  'http://gaoninterior.kr',
  'https://www.gaoninterior.kr',
  'http://www.gaoninterior.kr',
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

app.use(express.static(PUBLIC_DIR));

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
  console.error(err);

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
  if (process.env.NODE_ENV !== 'production' && err.stack) {
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
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
