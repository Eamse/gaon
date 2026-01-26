import { Router } from 'express';
import dotenv from 'dotenv';
import prisma from './db.js';
import { deleteFileFromR2 } from './r2.js';
import { protect } from './auth.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const router = Router();

// ---------------------------
// 프로젝트 API 라우트
// ---------------------------

// 📌 프로젝트 목록 조회 (GET /api/projects)
router.get('/', async (req, res, next) => {
  try {
    // 최신순 정렬
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        // 대표 이미지 1장만 가져오기 (목록 표시용)
        images: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        costs: true, // 견적 내역 포함
      },
    });
    res.json({ ok: true, projects });
  } catch (error) {
    next(error);
  }
});

// 📌 프로젝트 상세 조회 (GET /api/projects/:id)
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      const error = new Error('유효한 프로젝트 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { createdAt: 'desc' },
        },
        costs: true, // 견적 내역 포함
      },
    });

    if (!project) {
      const error = new Error('프로젝트를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    res.json({ ok: true, project });
  } catch (error) {
    next(error);
  }
});

// 📌 프로젝트 생성 (POST /api/projects)
router.post('/', protect, async (req, res, next) => {
  try {
    const {
      title,
      description,
      location,
      category,
      year,
      period,
      area,
      costs, // [{ label: '철거', amount: 1000 }, ...]
      mainImage,
      images,
    } = req.body;

    if (!title) {
      const error = new Error('프로젝트 제목(title)은 필수입니다.');
      error.status = 400;
      throw error;
    }

    // 견적 합계 계산
    let calculatedPrice = 0;
    let costData = [];
    if (Array.isArray(costs)) {
      costData = costs.map((c) => ({
        label: c.label,
        amount: Number(c.amount) || 0,
      }));
      calculatedPrice = costData.reduce((sum, c) => sum + c.amount, 0);
    }

    const newProject = await prisma.project.create({
      data: {
        title,
        description: description || '',
        location: location || '',
        category: category || '',
        year: year ? parseInt(year, 10) : null,
        period: period || '',
        area: area ? parseFloat(area) : null,
        price: calculatedPrice, // 총액 자동 저장
        mainImage: mainImage || null,
        images: images || undefined,
        costs: { create: costData },
      },
    });

    res.status(201).json({ ok: true, project: newProject });
  } catch (error) {
    next(error);
  }
});

// 📌 프로젝트 수정 (PATCH /api/projects/:id)
router.patch('/:id', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      const error = new Error('유효한 프로젝트 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    const {
      title,
      description,
      location,
      category,
      year,
      period,
      area,
      costs,
      mainImage,
      images,
    } = req.body;
    const dataToUpdate = {};

    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;
    if (location !== undefined) dataToUpdate.location = location;
    if (category !== undefined) dataToUpdate.category = category;
    if (year !== undefined)
      dataToUpdate.year = year ? parseInt(year, 10) : null;
    if (period !== undefined) dataToUpdate.period = period;
    if (area !== undefined) dataToUpdate.area = area ? parseFloat(area) : null;
    if (mainImage !== undefined) dataToUpdate.mainImage = mainImage;
    if (images !== undefined) dataToUpdate.images = images;

    // 견적 내역 업데이트 (기존 내역 삭제 후 재생성)
    if (costs !== undefined && Array.isArray(costs)) {
      // 1. 기존 견적 삭제
      await prisma.projectCost.deleteMany({ where: { projectId: id } });

      // 2. 새 견적 데이터 준비
      const costData = costs.map((c) => ({
        label: c.label,
        amount: Number(c.amount) || 0,
      }));

      // 3. 데이터 업데이트 객체에 추가 (createMany는 nested update에서 지원 안될 수 있으므로 create 사용)
      dataToUpdate.costs = { create: costData };

      // 4. 총액 재계산
      dataToUpdate.price = costData.reduce((sum, c) => sum + c.amount, 0);
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: '수정할 내용이 없습니다.' });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({ ok: true, project: updatedProject });
  } catch (error) {
    if (error.code === 'P2025') {
      const err = new Error('프로젝트를 찾을 수 없습니다.');
      err.status = 404;
      return next(err);
    }
    next(error);
  }
});

// 📌 프로젝트 삭제 (DELETE /api/projects/:id)
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      const error = new Error('유효한 프로젝트 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    // 1. 프로젝트에 연결된 이미지 조회
    const images = await prisma.projectImage.findMany({
      where: { projectId: id },
    });

    // 2. R2에서 이미지 파일 삭제
    for (const img of images) {
      await deleteFileFromR2(img.originalUrl);
      await deleteFileFromR2(img.thumbUrl);
    }

    // 3. DB에서 이미지 레코드 삭제 (Cascade 설정이 없으므로 수동 삭제)
    await prisma.projectImage.deleteMany({ where: { projectId: id } });

    // 4. 프로젝트 삭제
    await prisma.project.delete({
      where: { id },
    });

    res.json({ ok: true, message: '프로젝트가 삭제되었습니다.' });
  } catch (error) {
    if (error.code === 'P2025') {
      const err = new Error('프로젝트를 찾을 수 없습니다.');
      err.status = 404;
      return next(err);
    }
    next(error);
  }
});

// 📌 프로젝트 개별 이미지 삭제 (DELETE /api/projects/images/:imageId)
router.delete('/images/:imageId', protect, async (req, res, next) => {
  try {
    const imageId = Number(req.params.imageId);
    if (isNaN(imageId)) {
      const error = new Error('유효한 이미지 ID가 아닙니다.');
      error.status = 400;
      throw error;
    }

    // 1. 이미지 정보 조회
    const image = await prisma.projectImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      const error = new Error('이미지를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    // 2. R2에서 파일 삭제
    await deleteFileFromR2(image.originalUrl);
    await deleteFileFromR2(image.thumbUrl);

    // 3. DB에서 레코드 삭제
    await prisma.projectImage.delete({
      where: { id: imageId },
    });

    res.json({ ok: true, message: '이미지가 삭제되었습니다.' });
  } catch (error) {
    if (error.code === 'P2025') {
      const err = new Error('이미지를 찾을 수 없습니다.');
      err.status = 404;
      return next(err);
    }
    next(error);
  }
});

export default router;
