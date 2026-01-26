import jwt from 'jsonwebtoken';
import prisma from './db.js';
import dotenv from 'dotenv';

dotenv.config(); // 환경변수 확실하게 로드

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

      // Get user from the token
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, name: true },
      });

      if (!req.user) {
        return res
          .status(401)
          .json({ error: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error(error);
      // 에러 원인을 구체적으로 반환 (예: jwt expired, invalid signature, jwt malformed)
      return res
        .status(401)
        .json({ error: `Not authorized: ${error.message}` });
    }
    return; // 토큰 검증 성공 시 여기서 종료 (아래로 내려가지 않음)
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }
};
