/**
 * 문의 관리 라우터
 * @module inquiryRouter
 */

import { Router } from 'express';
import prisma from './db.js';
import { protect } from './auth.js';
import {
  createInquiryValidation,
  updateInquiryValidation,
  validate,
  paginationValidation,
} from './validators.js';
import {
  getPagination,
  getSortParams,
  successResponse,
  errorResponse,
  handlePrismaError,
  paginatedResponse,
  buildFilters,
} from './utils/api-helpers.js';
import logger from './utils/logger.js';

const router = Router();

/**
 * GET /api/inquiries
 * 문의 목록 조회 (관리자 전용)
 * 
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=10] - 페이지당 항목 수
 * @query {string} [status] - 상태 필터 (new, processing, completed, cancelled)
 * @query {string} [sort=createdAt] - 정렬 기준
 * @query {string} [order=desc] - 정렬 순서
 * @returns {Object} 문의 목록
 */
router.get('/', protect, paginationValidation, validate, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, sort, order } = req.query;

    // 페이지네이션
    const { skip, take } = getPagination(page, limit);

    // 정렬
    const orderBy = getSortParams(sort, order, ['createdAt', 'updatedAt'], 'createdAt');

    // 필터
    const where = buildFilters({ status }, []);

    // 전체 개수 조회
    const total = await prisma.inquiry.count({ where });

    // 문의 목록 조회
    const inquiries = await prisma.inquiry.findMany({
      where,
      skip,
      take,
      orderBy,
    });

    logger.info(`문의 목록 조회: page=${page}, limit=${limit}, total=${total}`);

    res.json(paginatedResponse(inquiries, total, page, limit));
  } catch (error) {
    logger.error(`문의 목록 조회 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

/**
 * POST /api/inquiries
 * 문의 생성 (인증 불필요 - 사용자용)
 * 
 * @body {string} userName - 이름 (필수)
 * @body {string} userPhone - 연락처 (필수)
 * @body {string} [spaceType] - 공간 타입
 * @body {number} [areaSize] - 면적
 * @body {string} [location] - 위치
 * @body {string} [scope] - 범위
 * @body {number} [budget] - 예산
 * @body {string} [schedule] - 일정
 * @body {string} [requests] - 요청 사항
 * @returns {Object} 생성된 문의
 */
router.post('/', createInquiryValidation, validate, async (req, res, next) => {
  try {
    const {
      userName,
      userPhone,
      spaceType,
      areaSize,
      location,
      scope,
      budget,
      schedule,
      requests,
    } = req.body;

    const newInquiry = await prisma.inquiry.create({
      data: {
        userName,
        userPhone,
        spaceType,
        areaSize: areaSize ? parseInt(areaSize, 10) : null,
        location,
        scope,
        budget: budget ? parseInt(budget, 10) : null,
        schedule,
        requests,
        status: 'new',
      },
    });

    logger.info(`문의 생성: ID=${newInquiry.id}, userName=${userName}`);
    res.status(201).json(successResponse(newInquiry, '문의가 접수되었습니다.'));
  } catch (error) {
    logger.error(`문의 생성 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

/**
 * PATCH /api/inquiries/:id
 * 문의 수정 (관리자 전용 - 상태 및 메모 업데이트)
 * 
 * @param {number} id - 문의 ID
 * @body {string} [status] - 상태 (new, processing, completed, cancelled)
 * @body {string} [adminMemo] - 관리자 메모
 * @returns {Object} 수정된 문의
 */
router.patch('/:id', protect, updateInquiryValidation, validate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, adminMemo } = req.body;

    const dataToUpdate = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (adminMemo !== undefined) dataToUpdate.adminMemo = adminMemo;

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json(errorResponse('수정할 내용이 없습니다.'));
    }

    const updatedInquiry = await prisma.inquiry.update({
      where: { id },
      data: dataToUpdate,
    });

    logger.info(`문의 수정: ID=${id}, status=${status}`);
    res.json(successResponse(updatedInquiry, '문의가 수정되었습니다.'));
  } catch (error) {
    logger.error(`문의 수정 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

/**
 * DELETE /api/inquiries/:id
 * 문의 삭제 (관리자 전용)
 * 
 * @param {number} id - 문의 ID
 * @returns {Object} 삭제 성공 메시지
 */
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json(errorResponse('유효한 문의 ID가 아닙니다.'));
    }

    await prisma.inquiry.delete({
      where: { id },
    });

    logger.info(`문의 삭제: ID=${id}`);
    res.json(successResponse(null, '문의가 삭제되었습니다.'));
  } catch (error) {
    logger.error(`문의 삭제 에러: ${error.message}`);
    const { status, message } = handlePrismaError(error);
    next(Object.assign(new Error(message), { status }));
  }
});

export default router;
