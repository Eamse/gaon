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

dotenv.config();
loadAndValidateEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

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

const app = express();
const PORT = env.PORT;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(httpLogger);

const VISIT_SALT = env.VISIT_SALT;
const ADMIN_BASIC_USER = env.ADMIN_BASIC_USER;
const ADMIN_BASIC_PASS = env.ADMIN_BASIC_PASS;

/** 요청이 페이지 방문으로 기록되어야 하는지 여부를 결정합니다. */
const shouldLogVisit = (req) => {
  if (req.method !== 'GET') return false;
  if (req.path === '/') return false;
  if (req.path.startsWith('/api')) return false;
  if (req.path.includes('.')) return false;
  return !!req.accepts('html');
};

/** 방문자 정보를 해시화하여 데이터베이스에 기록합니다. */
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
      logger.error(`Visit log error: ${err.message || err}`),
    );
  }
  next();
});

/** Basic Auth를 사용하여 특정 경로를 보호하는 미들웨어입니다. */
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
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    },
  }),
);

/** 서버 사이드에서 프로젝트 상세 페이지의 SEO 메타 태그를 동적으로 삽입합니다. */
app.get('/project/project-detail.html', async (req, res, next) => {
  const projectId = parseInt(req.query.id);
  if (!projectId || isNaN(projectId)) {
    return next();
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return next();

    const filePath = path.join(PUBLIC_DIR, 'project', 'project-detail.html');
    let html = await fs.promises.readFile(filePath, 'utf-8');

    const title = `${project.title} · 가온 인테리어`;
    const description = `${project.location || '경기'} ${project.area ? project.area + '평' : ''} ${project.category || '인테리어'} 프로젝트 시공사례입니다.`;

    let imageUrl =
      project.mainImage || 'https://gaoninterior.kr/public/image/logo.png';
    if (imageUrl && !imageUrl.startsWith('http')) {
      const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
      imageUrl = `https://gaoninterior.kr/${cleanPath}`;
    }

    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(
      /<meta property="og:title" content=".*?" \/>/,
      `<meta property="og:title" content="${title}" />`,
    );

    html = html.replace(
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="${description}" />`,
    );
    html = html.replace(
      /<meta property="og:description" content=".*?" \/>/,
      `<meta property="og:description" content="${description}" />`,
    );

    html = html.replace(
      /<meta property="og:image" content=".*?" \/>/,
      `<meta property="og:image" content="${imageUrl}" />`,
    );

    const canonicalUrl = `https://gaoninterior.kr/project/project-detail.html?id=${projectId}`;
    html = html.replace(
      /<meta property="og:url" content=".*?" \/>/,
      `<meta property="og:url" content="${canonicalUrl}" />`,
    );
    html = html.replace(
      /<link rel="canonical" href=".*?" \/>/,
      `<link rel="canonical" href="${canonicalUrl}" />`,
    );

    res.send(html);
  } catch (err) {
    logger.error(`SSR Error for project ${projectId}: ${err.message}`);
    next();
  }
});

app.use(express.static(PUBLIC_DIR));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin/admin-login.html'));
});

app.get('/admin/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin/admin-login.html'));
});

/** .html 확장자 없이도 HTML 파일을 서빙할 수 있도록 처리합니다. */
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }

  if (req.path.startsWith('/admin/')) {
    const adminPath = req.path.replace('/admin/', '');
    const candidates = [
      path.join(PUBLIC_DIR, 'admin', `${adminPath}.html`),
      path.join(
        PUBLIC_DIR,
        'admin',
        adminPath,
        `${path.basename(adminPath)}.html`,
      ),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
  }

  const candidates = [
    path.join(PUBLIC_DIR, `${req.path}.html`),
    path.join(PUBLIC_DIR, req.path, `${path.basename(req.path)}.html`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }

  next();
});

app.use('/api', uploadRouter);
app.use('/api/projects', projectRouter);
app.use('/api/users', userRouter);
app.use('/api/inquiries', inquiryRouter);
app.use('/api/metrics', metricsRouter);

/** HEAD 요청에 대해 200 OK로 응답합니다. */
app.use((req, res, next) => {
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  return next();
});

/** 모든 서버 에러를 처리하는 최종 에러 핸들러입니다. */
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });

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

/** 일치하는 라우트가 없을 경우 404 또는 405 에러를 반환합니다. */
app.use((req, res) => {
  const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  return res.status(404).json({ ok: false, error: 'Not Found' });
});

/** Express 서버를 시작합니다. */
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`API docs enabled: ${env.ENABLE_API_DOCS}`);
});
