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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_ROOT = path.join(ROOT_DIR, 'uploads');

const DIR_ORIGINAL = path.join(UPLOAD_ROOT, 'original');
const DIR_LARGE = path.join(UPLOAD_ROOT, 'large');
const DIR_MEDIUM = path.join(UPLOAD_ROOT, 'medium');
const DIR_THUMB = path.join(UPLOAD_ROOT, 'thumb');

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

/** 파일명을 URL 및 파일 시스템에 안전한 형태로 변환합니다. */
const sanitizeFilename = (name) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'upload';

/** 원본 파일명을 기반으로 고유한 새 파일명을 생성합니다. */
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

/** 원본 파일을 임시 디렉터리에 저장하는 Multer 저장소 설정을 정의합니다. */
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
      '지원하지 않는 파일 형식입니다. (jpeg/png/webp/gif/heic/heif)',
    );
    err.status = 400;
    return cb(err);
  },
});

/** 이미지 품질 값을 1과 100 사이로 제한합니다. */
const clampQuality = (quality) => Math.min(100, Math.max(1, quality));

/** Sharp 파이프라인에 이미지 포맷과 품질 설정을 적용합니다. */
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

/** 원본 이미지로부터 여러 크기의 리사이즈된 이미지를 생성하여 디스크에 저장합니다. */
const generateSizesToDisk = async (sourcePath, filename) => {
  const format = path.extname(filename).replace('.', '').toLowerCase();
  const baseImage = sharp(sourcePath, { failOnError: false }).rotate();

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
        quality,
      ).toFile(path.join(dir, filename)),
    ),
  );

  return {
    originalPath: sourcePath,
    largePath: path.join(DIR_LARGE, filename),
    mediumPath: path.join(DIR_MEDIUM, filename),
    thumbPath: path.join(DIR_THUMB, filename),
  };
};

/** 특정 프로젝트에 대한 이미지(대표, 상세)들을 업로드합니다. */
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
      console.log(
        '  - fileList:',
        fileList.map((f) => ({
          filename: f.filename,
          size: f.size,
          mimetype: f.mimetype,
        })),
      );

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
            contentType,
          ),
          uploadFileToR2(
            mediumPath,
            `projects/${projectId}/medium/${file.filename}`,
            contentType,
          ),
          uploadFileToR2(
            thumbPath,
            `projects/${projectId}/thumb/${file.filename}`,
            contentType,
          ),
        ]);

        const meta = await sharp(srcPath, { failOnError: false }).metadata();

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

      await Promise.all(
        fileList.map((file) => {
          const filename = file.filename;
          const targets = [
            path.join(DIR_ORIGINAL, filename),
            path.join(DIR_LARGE, filename),
            path.join(DIR_MEDIUM, filename),
            path.join(DIR_THUMB, filename),
          ];
          return Promise.all(targets.map((p) => fsp.unlink(p).catch(() => {})));
        }),
      );

      console.log(
        '✅ [/projects/:projectId/images] 업로드 완료:',
        results.length,
        '개 파일',
      );
      return res.json({ ok: true, count: results.length, items: results });
    } catch (error) {
      console.error('❌ [/projects/:projectId/images] 에러:', error.message);
      return next(error);
    }
  },
);

/** 특정 프로젝트에 속한 모든 이미지 목록을 조회합니다. */
router.get('/projects/:projectId/images', async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId || Number.isNaN(projectId)) {
      const error = new Error('유효한 프로젝트 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

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

/** ID를 기준으로 특정 프로젝트 이미지를 R2와 DB에서 삭제합니다. */
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

    const urls = [image.originalUrl, image.thumbUrl].filter(Boolean);

    await Promise.all(urls.map((url) => deleteFileFromR2(url)));

    await prisma.projectImage.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

/** 관리자용으로 단일 이미지를 업로드하고 DB에 기록합니다. */
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
      const meta = await sharp(originalPath, { failOnError: false }).metadata();

      const contentType = file.mimetype || 'image/jpeg';
      const [originalR2, largeR2, mediumR2, thumbR2] = await Promise.all([
        uploadFileToR2(
          originalPath,
          `uploads/original/${file.filename}`,
          contentType,
        ),
        uploadFileToR2(
          path.join(DIR_LARGE, file.filename),
          `uploads/large/${file.filename}`,
          contentType,
        ),
        uploadFileToR2(
          path.join(DIR_MEDIUM, file.filename),
          `uploads/medium/${file.filename}`,
          contentType,
        ),
        uploadFileToR2(
          path.join(DIR_THUMB, file.filename),
          `uploads/thumb/${file.filename}`,
          contentType,
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

      const targets = [
        path.join(DIR_ORIGINAL, file.filename),
        path.join(DIR_LARGE, file.filename),
        path.join(DIR_MEDIUM, file.filename),
        path.join(DIR_THUMB, file.filename),
      ];
      await Promise.all(targets.map((p) => fsp.unlink(p).catch(() => {})));

      return res.status(201).json({ ok: true, item: imageRecord });
    } catch (error) {
      return next(error);
    }
  },
);

/** 관리자용으로 여러 이미지를 동시에 업로드하고 DB에 기록합니다. */
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

        const meta = await sharp(originalPath, {
          failOnError: false,
        }).metadata();

        const contentType = file.mimetype || 'image/jpeg';
        const [originalR2, largeR2, mediumR2, thumbR2] = await Promise.all([
          uploadFileToR2(
            originalPath,
            `uploads/original/${file.filename}`,
            contentType,
          ),
          uploadFileToR2(
            path.join(DIR_LARGE, file.filename),
            `uploads/large/${file.filename}`,
            contentType,
          ),
          uploadFileToR2(
            path.join(DIR_MEDIUM, file.filename),
            `uploads/medium/${file.filename}`,
            contentType,
          ),
          uploadFileToR2(
            path.join(DIR_THUMB, file.filename),
            `uploads/thumb/${file.filename}`,
            contentType,
          ),
        ]);

        const imageRecord = await prisma.adminImage.create({
          data: {
            filename: file.filename,
            title: '',
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

        const targets = [
          path.join(DIR_ORIGINAL, file.filename),
          path.join(DIR_LARGE, file.filename),
          path.join(DIR_MEDIUM, file.filename),
          path.join(DIR_THUMB, file.filename),
        ];
        await Promise.all(targets.map((p) => fsp.unlink(p).catch(() => {})));
      }

      return res
        .status(201)
        .json({ ok: true, items: results, count: results.length });
    } catch (error) {
      return next(error);
    }
  },
);

/** 파일명을 기준으로 단일 관리자 이미지 정보를 조회합니다. */
router.get('/uploads/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const image = await prisma.adminImage.findUnique({
      where: { filename: name },
      include: { galleryImages: { orderBy: { order: 'asc' } } },
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

/** 필터링 및 페이지네이션을 적용하여 관리자 이미지 목록을 조회합니다. */
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
        include: { galleryImages: { orderBy: { order: 'asc' } } },
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

/** 파일명을 기준으로 관리자 이미지의 제목과 카테고리를 수정합니다. */
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
    if (error.code === 'P2025') {
      const error = new Error('파일을 찾을 수 없습니다.');
      error.status = 404;
      return next(err);
    }
    return next(error);
  }
});

/** 파일명을 기준으로 관리자 이미지와 연결된 모든 파일 및 데이터를 삭제합니다. */
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

    const adminImageUrls = [
      adminImage.originalUrl,
      adminImage.largeUrl,
      adminImage.mediumUrl,
      adminImage.thumbUrl,
    ].filter(Boolean);
    await Promise.all(adminImageUrls.map((url) => deleteFileFromR2(url)));

    const galleryImageUrls = adminImage.galleryImages.flatMap((gImage) =>
      [
        gImage.originalUrl,
        gImage.largeUrl,
        gImage.mediumUrl,
        gImage.thumbUrl,
      ].filter(Boolean),
    );
    await Promise.all(galleryImageUrls.map((url) => deleteFileFromR2(url)));

    await prisma.adminImage.delete({
      where: { filename: name },
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

/** 특정 관리자 이미지에 속하는 상세 갤러리 이미지를 업로드합니다. */
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

        const meta = await sharp(originalPath, {
          failOnError: false,
        }).metadata();
        const fileExtension = extname(file.originalname);

        const tempGalleryImage = await prisma.adminGalleryImage.create({
          data: {
            adminImageId: adminImage.id,
            alt: req.body.alt || '',
            order: Number(req.body.order) || 0,
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
            file.mimetype,
          ),
          uploadFileToR2(
            path.join(DIR_LARGE, file.filename),
            `${baseGalleryKey}_large${fileExtension}`,
            file.mimetype,
          ),
          uploadFileToR2(
            path.join(DIR_MEDIUM, file.filename),
            `${baseGalleryKey}_medium${fileExtension}`,
            file.mimetype,
          ),
          uploadFileToR2(
            path.join(DIR_THUMB, file.filename),
            `${baseGalleryKey}_thumb${fileExtension}`,
            file.mimetype,
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

        console.log('[DEBUG] updatedGalleryImage:', updatedGalleryImage);

        results.push(updatedGalleryImage);

        const targets = [
          path.join(DIR_ORIGINAL, file.filename),
          path.join(DIR_LARGE, file.filename),
          path.join(DIR_MEDIUM, file.filename),
          path.join(DIR_THUMB, file.filename),
        ];
        await Promise.all(targets.map((p) => fsp.unlink(p).catch(() => {})));
      }

      return res
        .status(201)
        .json({ ok: true, items: results, count: results.length });
    } catch (error) {
      return next(error);
    }
  },
);

/** ID를 기준으로 상세 갤러리 이미지의 alt 텍스트와 순서를 수정합니다. */
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

/** ID를 기준으로 상세 갤러리 이미지를 R2와 DB에서 삭제합니다. */
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

    const galleryImageUrls = [
      galleryImage.originalUrl,
      galleryImage.largeUrl,
      galleryImage.mediumUrl,
      galleryImage.thumbUrl,
    ].filter(Boolean);
    await Promise.all(galleryImageUrls.map((url) => deleteFileFromR2(url)));

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
