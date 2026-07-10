import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const projectSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
});

// Everyone can list projects (members need them to tag their reports)
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const projects = await prisma.project.findMany({
      orderBy: { name: 'asc' },
      include: {
        projectMembers: { include: { user: { select: { id: true, name: true } } } },
        _count: { select: { reports: true } },
      },
    });
    res.json({ projects });
  })
);

// Write operations are manager-only
router.post(
  '/',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const data = projectSchema.parse(req.body);
    const project = await prisma.project.create({ data });
    res.status(201).json({ project });
  })
);

router.patch(
  '/:id',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const data = projectSchema.partial().parse(req.body);
    const project = await prisma.project.update({ where: { id: req.params.id }, data });
    res.json({ project });
  })
);

router.delete(
  '/:id',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const reportCount = await prisma.report.count({ where: { projectId: req.params.id } });
    if (reportCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${reportCount} report(s) reference this project`,
      });
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

// Optional feature: assign / unassign team members
router.post(
  '/:id/members',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
    const member = await prisma.projectMember.create({
      data: { projectId: req.params.id, userId },
    });
    res.status(201).json({ member });
  })
);

router.delete(
  '/:id/members/:userId',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    await prisma.projectMember.deleteMany({
      where: { projectId: req.params.id, userId: req.params.userId },
    });
    res.json({ ok: true });
  })
);

export default router;
