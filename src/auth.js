/**
 * JWT 인증 미들웨어
 * @module auth
 */

import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { env } from './env-validator.js';
import logger from './utils/logger.js';

/**
 * JWT 토큰을 검증하고 사용자 정보를 req.user에 추가하는 미들웨어
 * @param {Object} req - Express Request 객체
 * @param {Object} res - Express Response 객체
 * @param {Function} next - Express next 함수
 * @returns {void}
 * 
 * @example
 * // 보호된 라우트에 사용
 * router.get('/protected', protect, async (req, res) => {
 *   // req.user로 현재 사용자 정보 접근 가능
 *   res.json({ user: req.user });
 * });
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Authorization 헤더에서 토큰 추출
      token = req.headers.authorization.split(' ')[1];

      // JWT 토큰 검증 (환경변수에서 비밀키 로드, fallback 없음)
      const decoded = jwt.verify(token, env.JWT_SECRET);

      // 토큰에서 사용자 ID를 추출하여 DB에서 사용자 정보 조회
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, name: true },
      });

      if (!req.user) {
        logger.warn(`인증 실패: 사용자를 찾을 수 없음 (ID: ${decoded.id})`);
        return res
          .status(401)
          .json({ ok: false, error: '인증 실패: 사용자를 찾을 수 없습니다.' });
      }

      next();
    } catch (error) {
      logger.error(`JWT 검증 실패: ${error.message}`);

      // JWT 에러 타입에 따라 구체적인 메시지 반환
      let errorMessage = '인증에 실패했습니다.';

      if (error.name === 'TokenExpiredError') {
        errorMessage = '토큰이 만료되었습니다. 다시 로그인해주세요.';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = '유효하지 않은 토큰입니다.';
      } else if (error.name === 'NotBeforeError') {
        errorMessage = '토큰이 아직 활성화되지 않았습니다.';
      }

      return res.status(401).json({ ok: false, error: errorMessage });
    }
    return;
  }

  // Authorization 헤더가 없거나 Bearer 토큰이 아닌 경우
  logger.warn('인증 실패: 토큰이 제공되지 않음');
  return res.status(401).json({ ok: false, error: '인증이 필요합니다. 로그인해주세요.' });
};
