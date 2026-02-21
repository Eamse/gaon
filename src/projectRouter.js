import { Router } from 'express';
import prisma from './db.js';
import { deleteFileFromR2 } from './r2.js';
import { protect } from './auth.js';
import {
  createProjectValidation,
  updateProjectValidation,
  projectIdValidation,
  validate,
  paginationValidation,
} from './validators.js';
import {
  getPagination,
  getSortParams,
  successResponse,
  errorResponse,
  handlePrismaError,
  buildFilters,
  paginatedResponse,
} from './utils/api-helpers.js';
import logger from './utils/logger.js';

const router = Router();

/** GET /api/projects - 모든 프로젝트 목록을 페이지네이션, 필터링, 정렬하여 조회합니다. */
router.get('/', paginationValidation, validate, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, search, sort, order } = req.query;

    const { skip, take } = getPagination(page, limit);

    const orderBy = getSortParams(
      sort,
      order,
      ['createdAt', 'updatedAt', 'title', 'year'],
      'createdAt',
    );

    const where = buildFilters({ category, search }, [
      'title',
      'location',
      'description',
    ]);

    const total = await prisma.project.count({ where });

    const projects = await prisma.project.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        images: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        costs: true,
      },
    });

    logger.info(
      `프로젝트 목록 조회: page=${page}, limit=${limit}, total=${total}`,
    );

    res.json(paginatedResponse(projects, total, page, limit));
  } catch (error) {
    logger.error(`프로젝트 목록 조회 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

/** GET /api/projects/:id - ID를 기준으로 특정 프로젝트의 상세 정보를 조회합니다. */
router.get('/:id', projectIdValidation, validate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { createdAt: 'desc' },
        },
        costs: true,
      },
    });

    if (!project) {
      logger.warn(`프로젝트 조회 실패: 존재하지 않음 (ID: ${id})`);
      return res
        .status(404)
        .json(errorResponse('프로젝트를 찾을 수 없습니다.'));
    }

    logger.info(`프로젝트 상세 조회: ID=${id}`);
    res.json(successResponse(project));
  } catch (error) {
    logger.error(`프로젝트 상세 조회 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

/** POST /api/projects - 새로운 프로젝트를 생성합니다. */
router.post(
  '/',
  protect,
  createProjectValidation,
  validate,
  async (req, res, next) => {
    try {
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
          price: calculatedPrice,
          mainImage: mainImage || null,
          images: images || undefined,
          costs: { create: costData },
        },
        include: {
          images: true,
          costs: true,
        },
      });

      logger.info(`프로젝트 생성: ID=${newProject.id}, title=${title}`);
      res
        .status(201)
        .json(successResponse(newProject, '프로젝트가 생성되었습니다.'));
    } catch (error) {
      logger.error(`프로젝트 생성 에러: ${error.message}`);
      const { status, message } = handlePrismaError(error);
      next(Object.assign(new Error(message), { status }));
    }
  },
);

/** PATCH /api/projects/:id - ID를 기준으로 특정 프로젝트의 정보를 수정합니다. */
router.patch(
  '/:id',
  protect,
  updateProjectValidation,
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
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
      if (area !== undefined)
        dataToUpdate.area = area ? parseFloat(area) : null;
      if (mainImage !== undefined) dataToUpdate.mainImage = mainImage;
      if (images !== undefined) dataToUpdate.images = images;

      if (costs !== undefined && Array.isArray(costs)) {
        await prisma.projectCost.deleteMany({ where: { projectId: id } });

        const costData = costs.map((c) => ({
          label: c.label,
          amount: Number(c.amount) || 0,
        }));

        dataToUpdate.costs = { create: costData };
        dataToUpdate.price = costData.reduce((sum, c) => sum + c.amount, 0);
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json(errorResponse('수정할 내용이 없습니다.'));
      }

      const updatedProject = await prisma.project.update({
        where: { id },
        data: dataToUpdate,
        include: {
          images: true,
          costs: true,
        },
      });

      logger.info(`프로젝트 수정: ID=${id}`);
      res.json(successResponse(updatedProject, '프로젝트가 수정되었습니다.'));
    } catch (error) {
      logger.error(`프로젝트 수정 에러: ${error.message}`);
      const { status, message } = handlePrismaError(error);
      next(Object.assign(new Error(message), { status }));
    }
  },
);

/** DELETE /api/projects/:id - ID를 기준으로 특정 프로젝트와 관련된 모든 이미지 및 데이터를 삭제합니다. */
router.delete(
  '/:id',
  protect,
  projectIdValidation,
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);

      const images = await prisma.projectImage.findMany({
        where: { projectId: id },
      });

      // R2에서 이미지 파일 삭제
      for (const img of images) {
        try {
          await deleteFileFromR2(img.originalUrl);
          await deleteFileFromR2(img.thumbUrl);
        } catch (error) {
          logger.warn(`R2 이미지 삭제 실패: ${error.message}`);
        }
      }

      await prisma.projectImage.deleteMany({ where: { projectId: id } });

      await prisma.project.delete({
        where: { id },
      });

      logger.info(`프로젝트 삭제: ID=${id}`);
      res.json(successResponse(null, '프로젝트가 삭제되었습니다.'));
    } catch (error) {
      logger.error(`프로젝트 삭제 에러: ${error.message}`);
      const { status, message } = handlePrismaError(error);
      next(Object.assign(new Error(message), { status }));
    }
  },
);

/** DELETE /api/projects/images/:imageId - 프로젝트에 속한 개별 이미지를 삭제합니다. */
router.delete('/images/:imageId', protect, async (req, res, next) => {
  try {
    const imageId = parseInt(req.params.imageId, 10);

    if (isNaN(imageId)) {
      return res
        .status(400)
        .json(errorResponse('유효한 이미지 ID가 아닙니다.'));
    }

    const image = await prisma.projectImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return res.status(404).json(errorResponse('이미지를 찾을 수 없습니다.'));
    }

    try {
      await deleteFileFromR2(image.originalUrl);
      await deleteFileFromR2(image.thumbUrl);
    } catch (error) {
      logger.warn(`R2 이미지 삭제 실패: ${error.message}`);
    }

    await prisma.projectImage.delete({
      where: { id: imageId },
    });

    logger.info(`이미지 삭제: ID=${imageId}`);
    res.json(successResponse(null, '이미지가 삭제되었습니다.'));
  } catch (error) {
    logger.error(`이미지 삭제 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

export default router;
