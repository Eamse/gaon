/**
 * 사용자 인증 라우터
 * @module userRouter
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { env } from './env-validator.js';
import { loginValidation, validate } from './validators.js';
import logger from './utils/logger.js';

const router = Router();

/**
 * 로그인 엔드포인트 Rate Limiter
 * 5분 동안 최대 5회 시도 제한
 */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 5, // 최대 5회 시도
  message: {
    ok: false,
    error: '너무 많은 로그인 시도가 있었습니다. 5분 후에 다시 시도해주세요.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 기본 IP 추출 사용 (IPv6 안전)
});

/**
 * POST /api/users/login
 * 사용자 로그인
 * 
 * @route POST /api/users/login
 * @param {string} username - 사용자명
 * @param {string} password - 비밀번호
 * @returns {Object} { ok: true, token: string }
 * 
 * @example
 * // 요청
 * POST /api/users/login
 * {
 *   "username": "admin",
 *   "password": "password123"
 * }
 * 
 * // 응답 (성공)
 * {
 *   "ok": true,
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * 
 * // 응답 (실패)
 * {
 *   "ok": false,
 *   "error": "가입되지 않은 아이디입니다."
 * }
 */
router.post('/login', loginLimiter, loginValidation, validate, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 1. 사용자 확인
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      logger.warn(`로그인 실패: 존재하지 않는 사용자 (username: ${username})`);
      return res.status(401).json({
        ok: false,
        error: '가입되지 않은 아이디입니다.',
      });
    }

    // 2. 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`로그인 실패: 비밀번호 불일치 (username: ${username})`);
      return res.status(401).json({
        ok: false,
        error: '비밀번호가 일치하지 않습니다.',
      });
    }

    // 3. JWT 토큰 생성 (환경변수에서 비밀키 로드, fallback 없음)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    logger.info(`로그인 성공: ${username}`);

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error(`로그인 에러: ${error.message}`);
    next(error);
  }
});

export default router;
