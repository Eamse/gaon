import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { env } from './env-validator.js';
import { loginValidation, validate } from './validators.js';
import logger from './utils/logger.js';

const router = Router();

/** 5분 동안 5회로 로그인 시도를 제한하는 Rate Limiter 입니다. */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 5, // 최대 5회 시도
  message: {
    ok: false,
    error: '너무 많은 로그인 시도가 있었습니다. 5분 후에 다시 시도해주세요.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** 사용자 로그인을 처리하고, 성공 시 JWT 토큰을 발급합니다. */
router.post(
  '/login',
  loginLimiter,
  loginValidation,
  validate,
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        logger.warn(
          `로그인 실패: 존재하지 않는 사용자 (username: ${username})`,
        );
        return res.status(401).json({
          ok: false,
          error: '가입되지 않은 아이디입니다.',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        logger.warn(`로그인 실패: 비밀번호 불일치 (username: ${username})`);
        return res.status(401).json({
          ok: false,
          error: '비밀번호가 일치하지 않습니다.',
        });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        env.JWT_SECRET,
        { expiresIn: '12h' },
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
  },
);

export default router;
