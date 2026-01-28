import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fsp from 'fs/promises';
import path, { extname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
import prisma from './db.js';
import { deleteFileFromR2, uploadFileToR2 } from './r2.js';
import { protect } from './auth.js';

const router = Router();

// ---------------------------
// PATH & 디렉터리 설정
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_ROOT = path.join(ROOT_DIR, 'uploads');

// 임시/백업용 로컬 디렉터리 (원본 + 리사이즈 결과 저장)
const DIR_ORIGINAL = path.join(UPLOAD_ROOT, 'original');
const DIR_LARGE = path.join(UPLOAD_ROOT, 'large');
const DIR_MEDIUM = path.join(UPLOAD_ROOT, 'medium');
const DIR_THUMB = path.join(UPLOAD_ROOT, 'thumb');

// ---------------------------
// 업로드 제약 & 유틸리티
// ---------------------------
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_MULTI_FILES = 10;

const sanitizeFilename = (name) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'upload';

const buildFilename = (originalName) => {
  const extCandidate = path.extname(originalName || '').toLowerCase();
  const allowedExts = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.heic',
    '.heif',
  ];
  const ext = allowedExts.includes(extCandidate) ? extCandidate : '.jpg';
  const base = sanitizeFilename(path.basename(originalName, extCandidate));
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${suffix}-${base}${ext}`.toLowerCase();
};

// ---------------------------
// Multer (원본 파일을 DIR_ORIGINAL에 저장)
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_ORIGINAL),
  filename: (req, file, cb) => cb(null, buildFilename(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const mimetype = (file.mimetype || '').toLowerCase();
    if (ALLOWED_MIMES.includes(mimetype)) {
      return cb(null, true);
    }
    const err = new Error(
      '지원하지 않는 파일 형식입니다. (jpeg/png/webp/gif/heic/heif)'
    );
    err.status = 400;
    return cb(err);
  },
});

// ---------------------------
// Sharp 리사이즈 + 로컬 파일 생성
// ---------------------------
const clampQuality = (quality) => Math.min(100, Math.max(1, quality));

const applyFormat = (pipeline, format, quality) => {
  const q = clampQuality(quality);
  if (format === 'png') {
    return pipeline.png({ compressionLevel: 9 });
  }
  if (format === 'webp') {
    return pipeline.webp({ quality: q });
  }
  if (format === 'heic' || format === 'heif') {
    return pipeline.heif({ quality: q });
  }
  if (format === 'gif') {
    return pipeline;
  }
  if (format === 'jpg' || format === 'jpeg' || !format) {
    return pipeline.jpeg({ quality: q });
  }
  return pipeline;
};

const generateSizesToDisk = async (sourcePath, filename) => {
  const format = path.extname(filename).replace('.', '').toLowerCase();
  const baseImage = sharp(sourcePath).rotate();

  const targets = [
    { width: 1600, quality: 82, dir: DIR_LARGE, key: 'large' },
    { width: 1000, quality: 84, dir: DIR_MEDIUM, key: 'medium' },
    { width: 400, quality: 86, dir: DIR_THUMB, key: 'thumb' },
  ];

  await Promise.all(
    targets.map(({ width, quality, dir }) =>
      applyFormat(
        baseImage
          .clone()
          .resize({ width, fit: 'inside', withoutEnlargement: true }),
        format,
        quality
      ).toFile(path.join(dir, filename))
    )
  );

  return {
    originalPath: sourcePath,
    largePath: path.join(DIR_LARGE, filename),
    mediumPath: path.join(DIR_MEDIUM, filename),
    thumbPath: path.join(DIR_THUMB, filename),
  };
};

// ---------------------------
// 업로드 라우트
//  - POST /api/projects/:projectId/images
//  - form-data: files[] (다중 업로드)
// ---------------------------
router.post(
  '/projects/:projectId/images',
  protect,
  upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'mainImageFile', maxCount: 1 },
    { name: 'detailImageFiles', maxCount: 10 },
  ]),
  async (req, res, next) => {
    try {
      console.log('🔍 [/projects/:projectId/images] 요청 시작');
      console.log('  - projectId:', req.params.projectId);
      console.log('  - req.files:', req.files);
      console.log('  - req.body:', req.body);
      console.log('  - Content-Type:', req.headers['content-type']);

      const projectId = Number(req.params.projectId);
      if (!projectId || Number.isNaN(projectId)) {
        const error = new Error('유효한 프로젝트 ID가 아닙니다.');
        error.status = 400;
        throw error;
      }

      // upload.fields를 사용하면 req.files는 객체가 됩니다. 모든 파일을 하나의 배열로 합칩니다.
      const fileList = [
        ...(req.files && req.files.files ? req.files.files : []),
        ...(req.files && req.files.mainImageFile
          ? req.files.mainImageFile
          : []),
        ...(req.files && req.files.detailImageFiles
          ? req.files.detailImageFiles
          : []),
      ];

      console.log('  - fileList.length:', fileList.length);
      console.log('  - fileList:', fileList.map(f => ({ filename: f.filename, size: f.size, mimetype: f.mimetype })));

      if (fileList.length === 0) {
        console.error('❌ 업로드된 파일이 없습니다!');
        const error = new Error('업로드된 파일이 없습니다.');
        error.status = 400;
        throw error;
      }

      const results = [];

      for (const file of fileList) {
        const originalPath = path.join(DIR_ORIGINAL, file.filename);

        const {
          originalPath: srcPath,
          largePath,
          mediumPath,
          thumbPath,
        } = await generateSizesToDisk(originalPath, file.filename);

        const contentType = file.mimetype || 'image/jpeg';

        const baseKey = `projects/${projectId}/${file.filename}`;

        const [originalR2, largeR2, mediumR2, thumbR2] = await Promise.all([
          uploadFileToR2(srcPath, baseKey, contentType),
          uploadFileToR2(
            largePath,
            `projects/${projectId}/large/${file.filename}`,
            contentType
          ),
          uploadFileToR2(
            mediumPath,
            `projects/${projectId}/medium/${file.filename}`,
            contentType
          ),
          uploadFileToR2(
            thumbPath,
            `projects/${projectId}/thumb/${file.filename}`,
            contentType
          ),
        ]);

        const meta = await sharp(srcPath).metadata();

        const imageRecord = await prisma.projectImage.create({
          data: {
            projectId,
            filename: file.filename,
            originalUrl: originalR2.url || '',
            largeUrl: largeR2.url || '',
            mediumUrl: mediumR2.url || '',
            thumbUrl: thumbR2.url || null,
            width: meta.width ?? null,
            height: meta.height ?? null,
            sizeBytes: file.size,
          },
        });

        results.push({
          file: file.filename,
          db: imageRecord,
          urls: {
            original: originalR2.url,
            large: largeR2.url,
            medium: mediumR2.url,
            thumb: thumbR2.url,
          },
        });
      }

      // 로컬 파일 삭제 (R2에 업로드했으므로 로컬은 임시)
      await Promise.all(
        fileList.map((file) => {
          const filename = file.filename;
          const targets = [
            path.join(DIR_ORIGINAL, filename),
            path.join(DIR_LARGE, filename),
            path.join(DIR_MEDIUM, filename),
            path.join(DIR_THUMB, filename),
          ];
          return Promise.all(targets.map((p) => fsp.unlink(p).catch(() => { })));
        })
      );

      console.log('✅ [/projects/:projectId/images] 업로드 완료:', results.length, '개 파일');
      return res.json({ ok: true, count: results.length, items: results });
    } catch (error) {
      console.error('❌ [/projects/:projectId/images] 에러:', error.message);
      return next(error);
    }
  }
);

// 📌 프로젝트별 이미지 목록 조회 (GET)
router.get('/projects/:projectId/images', async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId || Number.isNaN(projectId)) {
      const error = new Error('유효한 프로젝트 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    // AdminImage와 연결된 AdminGalleryImage도 함께 가져오도록 include 추가
    // ProjectImage는 AdminGalleryImage와 직접적인 관계가 없으므로 include 하지 않음
    // AdminImage 모델에 galleryImages 관계가 있으므로, AdminImage 조회 시 함께 가져옴
    const images = await prisma.projectImage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      ok: true,
      count: images.length,
      items: images,
    });
  } catch (error) {
    return next(error);
  }
});

// 📌 프로젝트 이미지 삭제 (DELETE /api/projects/images/:id)
router.delete('/projects/images/:id', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      const error = new Error('유효한 이미지 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    const image = await prisma.projectImage.findUnique({
      where: { id },
    });

    if (!image) {
      const error = new Error('이미지를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    // R2에서 파일 삭제
    const urls = [image.originalUrl, image.thumbUrl].filter(Boolean);
    // large/medium 등 파생 이미지도 있다면 삭제해야 함 (URL 규칙에 따라 추론하거나 DB에 저장 필요)
    // 현재 DB에는 original/thumb만 저장 중이므로 이들만 삭제 시도

    await Promise.all(urls.map((url) => deleteFileFromR2(url)));

    // DB에서 레코드 삭제
    await prisma.projectImage.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------
// 어드민 전용: AdminImage 관리 (대표 이미지)
// ---------------------------

// 📌 어드민: 단일 AdminImage 업로드
router.post(
  '/uploads',
  protect,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error('업로드된 파일이 없습니다. field: file');
        error.status = 400;
        throw error;
      }

      const file = req.file;
      const originalPath = path.join(DIR_ORIGINAL, file.filename);
      await generateSizesToDisk(originalPath, file.filename); // 로컬에 리사이즈된 이미지 생성

      const meta = await sharp(originalPath).metadata();

      // R2에 업로드
      const contentType = file.mimetype || 'image/jpeg';
      // AdminImage는 filename을 키로 사용
      const [originalR2, largeR2, mediumR2, thumbR2] = await Promise.all([
        uploadFileToR2(
          originalPath,
          `uploads/original/${file.filename}`,
          contentType
        ),
        uploadFileToR2(
          path.join(DIR_LARGE, file.filename),
          `uploads/large/${file.filename}`,
          contentType
        ),
        uploadFileToR2(
          path.join(DIR_MEDIUM, file.filename),
          `uploads/medium/${file.filename}`,
          contentType
        ),
        uploadFileToR2(
          path.join(DIR_THUMB, file.filename),
          `uploads/thumb/${file.filename}`,
          contentType
        ),
      ]);

      const imageRecord = await prisma.adminImage.create({
        data: {
          filename: file.filename,
          title: req.body.title || '',
          category: req.body.category || '',
          sizeBytes: file.size,
          width: meta.width ?? null,
          height: meta.height ?? null,
          originalUrl: originalR2.url || '',
          largeUrl: largeR2.url || '',
          mediumUrl: mediumR2.url || '',
          thumbUrl: thumbR2.url || '',
        },
      });

      // 로컬 파일 삭제 (R2에 업로드했으므로 로컬은 임시)
      const targets = [
        path.join(DIR_ORIGINAL, file.filename),
        path.join(DIR_LARGE, file.filename),
        path.join(DIR_MEDIUM, file.filename),
        path.join(DIR_THUMB, file.filename),
      ];
      await Promise.all(targets.map((p) => fsp.unlink(p).catch(() => { })));

      return res.status(201).json({ ok: true, item: imageRecord });
    } catch (error) {
      return next(error);
    }
  }
);

// 📌 어드민: 다중 AdminImage 업로드
router.post(
  '/uploads-multi',
  protect,
  upload.array('files', MAX_MULTI_FILES),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        const error = new Error('업로드된 파일이 없습니다. field: files');
        error.status = 400;
        throw error;
      }

      const results = [];
      for (const file of req.files) {
        const originalPath = path.join(DIR_ORIGINAL, file.filename);
        await generateSizesToDisk(originalPath, file.filename); // 로컬에 리사이즈된 이미지 생성

        const meta = await sharp(originalPath).metadata();

        // R2에 업로드
        const contentType = file.mimetype || 'image/jpeg';
        const [originalR2, largeR2, mediumR2, thumbR2] = await Promise.all([
          uploadFileToR2(
            originalPath,
            `uploads/original/${file.filename}`,
            contentType
          ),
          uploadFileToR2(
            path.join(DIR_LARGE, file.filename),
            `uploads/large/${file.filename}`,
            contentType
          ),
          uploadFileToR2(
            path.join(DIR_MEDIUM, file.filename),
            `uploads/medium/${file.filename}`,
            contentType
          ),
          uploadFileToR2(
            path.join(DIR_THUMB, file.filename),
            `uploads/thumb/${file.filename}`,
            contentType
          ),
        ]);

        const imageRecord = await prisma.adminImage.create({
          data: {
            filename: file.filename,
            title: '', // 다중 업로드는 제목/카테고리 비움
            category: '',
            sizeBytes: file.size,
            width: meta.width ?? null,
            height: meta.height ?? null,
            originalUrl: originalR2.url || '',
            largeUrl: largeR2.url || '',
            mediumUrl: mediumR2.url || '',
            thumbUrl: thumbR2.url || '',
          },
        });
        results.push(imageRecord);

        // 로컬 파일 삭제 (R2에 업로드했으므로 로컬은 임시)
        const targets = [
          path.join(DIR_ORIGINAL, file.filename),
          path.join(DIR_LARGE, file.filename),
          path.join(DIR_MEDIUM, file.filename),
          path.join(DIR_THUMB, file.filename),
        ];
        await Promise.all(targets.map((p) => fsp.unlink(p).catch(() => { })));
      }

      return res
        .status(201)
        .json({ ok: true, items: results, count: results.length });
    } catch (error) {
      return next(error);
    }
  }
);

// 📌 어드민: 단일 AdminImage 정보 조회 (갤러리 이미지 포함)
router.get('/uploads/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const image = await prisma.adminImage.findUnique({
      where: { filename: name },
      include: { galleryImages: { orderBy: { order: 'asc' } } }, // 갤러리 이미지 함께 가져오기
    });

    if (!image) {
      const error = new Error('파일을 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    return res.json({ ok: true, item: image });
  } catch (error) {
    return next(error);
  }
});

// 📌 어드민: AdminImage 목록 조회 (갤러리 이미지 포함)
router.get('/uploads', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const category = (req.query.category || '').toString();
    const sort = (req.query.sort || 'recent').toString();
    const limit = Number(req.query.limit || 24);
    const page = Number(req.query.page || 1);
    const skip = (page - 1) * limit;

    const where = {};
    if (q) {
      where.OR = [
        { filename: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const orderBy =
      sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    const [total, items] = await prisma.$transaction([
      prisma.adminImage.count({ where }),
      prisma.adminImage.findMany({
        where,
        orderBy,
        take: limit,
        skip,
        include: { galleryImages: { orderBy: { order: 'asc' } } }, // 갤러리 이미지 함께 가져오기
      }),
    ]);

    return res.json({
      ok: true,
      total,
      items,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
});

// 📌 어드민: AdminImage 정보 수정
router.patch('/uploads/:name', protect, async (req, res, next) => {
  try {
    const { name } = req.params;
    const { title, category } = req.body || {};

    const dataToUpdate = {};
    if (typeof title === 'string') dataToUpdate.title = title;
    if (typeof category === 'string') dataToUpdate.category = category;

    if (Object.keys(dataToUpdate).length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: '수정할 내용이 없습니다.' });
    }

    const updatedImage = await prisma.adminImage.update({
      where: { filename: name },
      data: dataToUpdate,
    });

    return res.json({ ok: true, item: updatedImage });
  } catch (error) {
    // Prisma의 update는 레코드가 없으면 에러를 던집니다.
    if (error.code === 'P2025') {
      const error = new Error('파일을 찾을 수 없습니다.');
      error.status = 404;
      return next(err);
    }
    return next(error);
  }
});

// 📌 어드민: AdminImage 삭제 (연결된 갤러리 이미지 파일도 함께 삭제)
router.delete('/uploads/:name', protect, async (req, res, next) => {
  try {
    const { name } = req.params;

    const adminImage = await prisma.adminImage.findUnique({
      where: { filename: name },
      include: { galleryImages: true },
    });

    if (!adminImage) {
      const error = new Error('파일을 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    // 1. R2에서 AdminImage 관련 파일 삭제
    const adminImageUrls = [
      adminImage.originalUrl,
      adminImage.largeUrl,
      adminImage.mediumUrl,
      adminImage.thumbUrl,
    ].filter(Boolean); // null이 아닌 URL만 필터링
    await Promise.all(adminImageUrls.map((url) => deleteFileFromR2(url)));

    // 2. R2에서 연결된 AdminGalleryImage 관련 파일 삭제
    const galleryImageUrls = adminImage.galleryImages.flatMap((gImage) =>
      [
        gImage.originalUrl,
        gImage.largeUrl,
        gImage.mediumUrl,
        gImage.thumbUrl,
      ].filter(Boolean)
    ); // null이 아닌 URL만 필터링
    await Promise.all(galleryImageUrls.map((url) => deleteFileFromR2(url)));

    // 3. DB에서 AdminImage 및 연결된 AdminGalleryImage 레코드 삭제
    // onDelete: Cascade 설정 덕분에 AdminImage 삭제 시 AdminGalleryImage는 자동으로 삭제됨
    await prisma.adminImage.delete({
      where: { filename: name },
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------
// 어드민 전용: AdminGalleryImage 관리 (상세 이미지)
// ---------------------------

// 📌 어드민: 특정 AdminImage에 상세 이미지 업로드
router.post(
  '/uploads/:filename/gallery',
  protect,
  upload.array('files', MAX_MULTI_FILES),
  async (req, res, next) => {
    try {
      const { filename } = req.params;
      const adminImage = await prisma.adminImage.findUnique({
        where: { filename },
      });

      if (!adminImage) {
        const error = new Error('대표 이미지를 찾을 수 없습니다.');
        error.status = 404;
        throw error;
      }

      if (!req.files || req.files.length === 0) {
        const error = new Error('업로드된 파일이 없습니다. field: files');
        error.status = 400;
        throw error;
      }

      const results = [];
      for (const file of req.files) {
        const originalPath = path.join(DIR_ORIGINAL, file.filename);
        await generateSizesToDisk(originalPath, file.filename); // 로컬에 리사이즈된 이미지 생성

        const meta = await sharp(originalPath).metadata();

        // AdminGalleryImage는 id를 파일명에 포함시키기 위해 먼저 생성하고 id를 얻어옴
        // R2 키는 AdminImage의 id와 AdminGalleryImage의 id를 조합하여 고유하게 만듭니다.
        const fileExtension = extname(file.originalname);

        const tempGalleryImage = await prisma.adminGalleryImage.create({
          data: {
            adminImageId: adminImage.id,
            alt: req.body.alt || '', // 상세 이미지별 alt 텍스트
            order: Number(req.body.order) || 0, // 순서
            originalUrl: '', // 임시로 비워둠
            largeUrl: '',
            mediumUrl: '',
            thumbUrl: '',
          },
        });

        const galleryImageId = tempGalleryImage.id;
        const baseGalleryKey = `uploads/gallery/${adminImage.id}/${galleryImageId}`;

        const [originalR2, largeR2, mediumR2, thumbR2] = await Promise.all([
          uploadFileToR2(
            originalPath,
            `${baseGalleryKey}${fileExtension}`,
            file.mimetype
          ),
          uploadFileToR2(
            path.join(DIR_LARGE, file.filename),
            `${baseGalleryKey}_large${fileExtension}`,
            file.mimetype
          ),
          uploadFileToR2(
            path.join(DIR_MEDIUM, file.filename),
            `${baseGalleryKey}_medium${fileExtension}`,
            file.mimetype
          ),
          uploadFileToR2(
            path.join(DIR_THUMB, file.filename),
            `${baseGalleryKey}_thumb${fileExtension}`,
            file.mimetype
          ),
        ]);

        const updatedGalleryImage = await prisma.adminGalleryImage.update({
          where: { id: galleryImageId },
          data: {
            originalUrl: originalR2.url || '',
            largeUrl: largeR2.url || '',
            mediumUrl: mediumR2.url || '',
            thumbUrl: thumbR2.url || '',
            sizeBytes: file.size,
            width: meta.width ?? null,
            height: meta.height ?? null,
          },
        });

        // 🔍 디버깅 로그 추가
        console.log('[DEBUG] updatedGalleryImage:', updatedGalleryImage);

        results.push(updatedGalleryImage);

        // 로컬 파일 삭제 (R2에 업로드했으므로 로컬은 임시)
        const targets = [
          path.join(DIR_ORIGINAL, file.filename),
          path.join(DIR_LARGE, file.filename),
          path.join(DIR_MEDIUM, file.filename),
          path.join(DIR_THUMB, file.filename),
        ];
        await Promise.all(targets.map((p) => fsp.unlink(p).catch(() => { })));
      }

      return res
        .status(201)
        .json({ ok: true, items: results, count: results.length });
    } catch (error) {
      return next(error);
    }
  }
);

// 📌 어드민: 상세 이미지 정보 수정
router.patch('/uploads/gallery/:id', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      const error = new Error('유효한 상세 이미지 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }
    const { alt, order } = req.body || {};

    const dataToUpdate = {};
    if (typeof alt === 'string') dataToUpdate.alt = alt;
    if (typeof order === 'number') dataToUpdate.order = order;

    if (Object.keys(dataToUpdate).length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: '수정할 내용이 없습니다.' });
    }

    const updatedGalleryImage = await prisma.adminGalleryImage.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.json({ ok: true, item: updatedGalleryImage });
  } catch (error) {
    if (error.code === 'P2025') {
      const err = new Error('상세 이미지를 찾을 수 없습니다.');
      err.status = 404;
      return next(err);
    }
    return next(error);
  }
});

// 📌 어드민: 상세 이미지 삭제
router.delete('/uploads/gallery/:id', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      const error = new Error('유효한 상세 이미지 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    const galleryImage = await prisma.adminGalleryImage.findUnique({
      where: { id },
    });

    if (!galleryImage) {
      const error = new Error('상세 이미지를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    // R2에서 상세 이미지 관련 파일 삭제
    const galleryImageUrls = [
      galleryImage.originalUrl,
      galleryImage.largeUrl,
      galleryImage.mediumUrl,
      galleryImage.thumbUrl,
    ].filter(Boolean); // null이 아닌 URL만 필터링
    await Promise.all(galleryImageUrls.map((url) => deleteFileFromR2(url)));

    // DB에서 상세 이미지 레코드 삭제
    await prisma.adminGalleryImage.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2025') {
      const err = new Error('상세 이미지를 찾을 수 없습니다.');
      err.status = 404;
      return next(err);
    }
    return next(error);
  }
});

export default router;
