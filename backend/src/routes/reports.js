import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { mondayOf, sundayOf, deadlineFor } from '../utils/weeks.js';

const router = Router();
router.use(requireAuth);

// The fixed report structure — same fields for every user, enforced here
// (validation) and in the database schema (real columns, not JSON).
const reportSchema = z.object({
  weekStart: z.coerce.date(),
  projectId: z.string().uuid(),
  tasksCompleted: z.string().min(1, 'Tasks completed is required'),
  tasksPlanned: z.string().min(1, 'Tasks planned is required'),
  blockers: z.string().optional().default(''),
  hoursWorked: z.coerce.number().min(0).max(168).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const include = {
  project: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
};

function withDerivedStatus(report) {
  const late =
    report.status === 'SUBMITTED' &&
    report.submittedAt &&
    new Date(report.submittedAt) > deadlineFor(report.weekStart);
  return { ...report, late };
}

// GET /api/reports — own report history, newest week first
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const reports = await prisma.report.findMany({
      where: { userId: req.user.id },
      orderBy: { weekStart: 'desc' },
      include,
    });
    res.json({ reports: reports.map(withDerivedStatus) });
  })
);

// GET /api/reports/team — MANAGER ONLY, with filters:
// ?week=YYYY-MM-DD (any date in the week) &memberId= &projectId= &from= &to=
router.get(
  '/team',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const { week, memberId, projectId, from, to } = req.query;
    const where = {};
    if (week) {
      const monday = mondayOf(new Date(week));
      where.weekStart = monday;
    } else if (from || to) {
      where.weekStart = {};
      if (from) where.weekStart.gte = mondayOf(new Date(from));
      if (to) where.weekStart.lte = mondayOf(new Date(to));
    }
    if (memberId) where.userId = memberId;
    if (projectId) where.projectId = projectId;

    const reports = await prisma.report.findMany({
      where,
      orderBy: [{ weekStart: 'desc' }, { user: { name: 'asc' } }],
      include,
    });
    res.json({ reports: reports.map(withDerivedStatus) });
  })
);

// GET /api/reports/team/status?week= — submission status per team member
router.get(
  '/team/status',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const monday = mondayOf(req.query.week ? new Date(req.query.week) : new Date());
    const [members, reports] = await Promise.all([
      prisma.user.findMany({ where: { role: 'MEMBER' }, select: { id: true, name: true } }),
      prisma.report.findMany({ where: { weekStart: monday }, include }),
    ]);
    const byUser = new Map(reports.map((r) => [r.userId, r]));
    const deadline = deadlineFor(monday);
    const status = members.map((m) => {
      const r = byUser.get(m.id);
      let state = 'pending';
      if (r?.status === 'SUBMITTED') {
        state = new Date(r.submittedAt) > deadline ? 'late' : 'submitted';
      }
      return { member: m, state, reportId: r?.id ?? null, submittedAt: r?.submittedAt ?? null };
    });
    res.json({ weekStart: monday, status });
  })
);

// POST /api/reports — create own report (draft)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = reportSchema.parse(req.body);
    const weekStart = mondayOf(data.weekStart);
    const report = await prisma.report.create({
      data: {
        ...data,
        weekStart,
        weekEnd: sundayOf(weekStart),
        userId: req.user.id,
      },
      include,
    });
    res.status(201).json({ report: withDerivedStatus(report) });
  })
);

// Owner check shared by read/update/submit on a single report
async function loadOwnedReport(req, res) {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, include });
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return null;
  }
  const isOwner = report.userId === req.user.id;
  const isManager = req.user.role === 'MANAGER';
  if (!isOwner && !isManager) {
    res.status(403).json({ error: 'Not your report' });
    return null;
  }
  return { report, isOwner };
}

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const found = await loadOwnedReport(req, res);
    if (found) res.json({ report: withDerivedStatus(found.report) });
  })
);

// PATCH /api/reports/:id — edit own report (design choice: editable even after
// submission; edits keep the original submittedAt for late tracking)
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const found = await loadOwnedReport(req, res);
    if (!found) return;
    if (!found.isOwner) return res.status(403).json({ error: 'Managers can view but not edit' });
    const data = reportSchema.partial().parse(req.body);
    if (data.weekStart) {
      data.weekStart = mondayOf(data.weekStart);
      data.weekEnd = sundayOf(data.weekStart);
    }
    const report = await prisma.report.update({ where: { id: req.params.id }, data, include });
    res.json({ report: withDerivedStatus(report) });
  })
);

// POST /api/reports/:id/submit
router.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const found = await loadOwnedReport(req, res);
    if (!found) return;
    if (!found.isOwner) return res.status(403).json({ error: 'Only the owner can submit' });
    if (found.report.status === 'SUBMITTED') {
      return res.status(409).json({ error: 'Report already submitted' });
    }
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include,
    });
    res.json({ report: withDerivedStatus(report) });
  })
);

// DELETE /api/reports/:id — only own drafts
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const found = await loadOwnedReport(req, res);
    if (!found) return;
    if (!found.isOwner) return res.status(403).json({ error: 'Only the owner can delete' });
    if (found.report.status === 'SUBMITTED') {
      return res.status(409).json({ error: 'Submitted reports cannot be deleted' });
    }
    await prisma.report.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

export default router;
