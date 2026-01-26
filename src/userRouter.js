import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './db.js';

const router = Router();

// POST /api/users/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 1. 사용자 확인
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      const error = new Error('가입되지 않은 아이디입니다.');
      error.status = 401;
      throw error;
    }

    // 2. 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const error = new Error('비밀번호가 일치하지 않습니다.');
      error.status = 401;
      throw error;
    }

    // 3. 토큰 생성 (환경변수 JWT_SECRET이 없으면 기본값 사용)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '12h' }
    );

    return res.json({ ok: true, token });
  } catch (error) {
    next(error);
  }
});

export default router;
