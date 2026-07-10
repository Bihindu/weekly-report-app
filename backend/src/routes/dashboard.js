import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { mondayOf } from '../utils/weeks.js';

const router = Router();
router.use(requireAuth, requireRole('MANAGER'));

// GET /api/dashboard/summary — headline metrics for the current (or given) week
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const monday = mondayOf(req.query.week ? new Date(req.query.week) : new Date());

    const [memberCount, weekReports] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.report.findMany({
        where: { weekStart: monday },
        select: { status: true, blockers: true },
      }),
    ]);

    const submitted = weekReports.filter((r) => r.status === 'SUBMITTED').length;
    const openBlockers = weekReports.filter((r) => r.blockers && r.blockers.trim().length > 0)
      .length;

    res.json({
      weekStart: monday,
      totalSubmitted: submitted,
      teamSize: memberCount,
      complianceRate: memberCount ? Math.round((submitted / memberCount) * 100) : 0,
      openBlockers,
    });
  })
);

// GET /api/dashboard/trends?weeks=8 — data series for the charts
router.get(
  '/trends',
  asyncHandler(async (req, res) => {
    const weeksBack = Math.min(Number(req.query.weeks) || 8, 26);
    const since = mondayOf(new Date());
    since.setUTCDate(since.getUTCDate() - 7 * (weeksBack - 1));

    const reports = await prisma.report.findMany({
      where: { weekStart: { gte: since } },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { weekStart: 'asc' },
    });

    // Tasks completed trend over time (team-wide). Tasks are newline-separated
    // in the text field; count non-empty lines as a lightweight task count.
    const countTasks = (text) => text.split('\n').filter((l) => l.trim()).length;
    const trendMap = new Map();
    for (const r of reports) {
      const key = r.weekStart.toISOString().slice(0, 10);
      const row = trendMap.get(key) || { week: key, tasks: 0, reports: 0, hours: 0 };
      row.tasks += countTasks(r.tasksCompleted);
      row.reports += 1;
      row.hours += Number(r.hoursWorked || 0);
      trendMap.set(key, row);
    }

    // Workload distribution by project
    const projectMap = new Map();
    for (const r of reports) {
      const row = projectMap.get(r.project.id) || { project: r.project.name, tasks: 0, hours: 0 };
      row.tasks += countTasks(r.tasksCompleted);
      row.hours += Number(r.hoursWorked || 0);
      projectMap.set(r.project.id, row);
    }

    // Submission counts by team member
    const memberMap = new Map();
    for (const r of reports) {
      const row = memberMap.get(r.user.id) || { member: r.user.name, submitted: 0, drafts: 0 };
      r.status === 'SUBMITTED' ? row.submitted++ : row.drafts++;
      memberMap.set(r.user.id, row);
    }

    // Recent activity feed
    const recent = [...reports]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        member: r.user.name,
        project: r.project.name,
        weekStart: r.weekStart,
        status: r.status,
        updatedAt: r.updatedAt,
      }));

    res.json({
      taskTrend: [...trendMap.values()],
      byProject: [...projectMap.values()],
      byMember: [...memberMap.values()],
      recent,
    });
  })
);

export default router;
