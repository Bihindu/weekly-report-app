import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // Role at signup keeps the demo simple. In production you'd restrict
  // MANAGER assignment to an admin flow — worth mentioning in the presentation.
  role: z.enum(['MEMBER', 'MANAGER']).default('MEMBER'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email.toLowerCase(), passwordHash, role: data.role },
    });
    setSessionCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const valid = user && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    setSessionCookie(res, user);
    res.json({ user: publicUser(user) });
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    res.json({ user: publicUser(user) });
  })
);

export default router;
