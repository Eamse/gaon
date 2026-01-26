import { Router } from 'express';
import prisma from './db.js';
import { protect } from './auth.js'; // 관리자 인증을 위한 미들웨어

const router = Router();

// ---------------------------
// 문의 API 라우트
// ---------------------------

// 📌 문의 목록 조회 (GET /api/inquiries) - 관리자용
router.get('/', protect, async (req, res, next) => {
  try {
    const inquiries = await prisma.inquiry.findMany({
      orderBy: { createdAt: 'desc' }, // 최신순으로 정렬
    });
    res.json({ ok: true, inquiries });
  } catch (error) {
    next(error);
  }
});

// 📌 문의 생성 (POST /api/inquiries) - 사용자용 (인증 불필요)
router.post('/', async (req, res, next) => {
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

    // 필수 값 검증
    if (!userName || !userPhone) {
      const error = new Error('이름과 연락처는 필수입니다.');
      error.status = 400;
      throw error;
    }

    const newInquiry = await prisma.inquiry.create({
      data: {
        userName,
        userPhone,
        spaceType,
        areaSize: parseFloat(areaSize) || 0, // "32평" 같은 입력도 숫자만 추출
        location,
        scope,
        budget: parseFloat(budget) || 0, // "5000만원" 같은 입력도 숫자만 추출
        schedule,
        requests,
        status: 'new', // 최초 상태는 '신규'
      },
    });

    res.status(201).json({ ok: true, inquiry: newInquiry });
  } catch (error) {
    next(error);
  }
});

// 📌 문의 수정 (PATCH /api/inquiries/:id) - 관리자용
router.patch('/:id', protect, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, adminMemo } = req.body;

    const updatedInquiry = await prisma.inquiry.update({
      where: { id },
      data: { status, adminMemo },
    });

    res.json({ ok: true, inquiry: updatedInquiry });
  } catch (error) {
    // P2025: Prisma에서 레코드를 찾지 못했을 때 발생하는 에러 코드
    if (error.code === 'P2025') {
      const err = new Error('해당 문의를 찾을 수 없습니다.');
      err.status = 404;
      return next(err);
    }
    next(error);
  }
});

export default router;
