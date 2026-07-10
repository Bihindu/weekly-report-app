import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { mondayOf } from '../utils/weeks.js';

const router = Router();
router.use(requireAuth, requireRole('MANAGER'));

// Approach (document this in the presentation):
// Lightweight retrieval — pull the last N weeks of reports from Postgres,
// serialize them into the prompt as context, and ask Claude to answer
// grounded ONLY in that data. No vector DB needed at this scale.
//
// Data privacy considerations:
// - Endpoint is manager-only (same RBAC as the dashboard — the AI can't
//   reveal anything the manager couldn't already see).
// - Only report fields are sent to the LLM; no emails or password hashes.
// - The API key lives server-side; the browser never talks to Anthropic.

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  weeksBack: z.number().int().min(1).max(12).default(4),
});

function serializeReports(reports) {
  return reports
    .map(
      (r) =>
        `--- Report ---\nMember: ${r.user.name}\nWeek of: ${r.weekStart
          .toISOString()
          .slice(0, 10)}\nProject: ${r.project.name}\nStatus: ${r.status}\nTasks completed:\n${
          r.tasksCompleted
        }\nTasks planned:\n${r.tasksPlanned}\nBlockers: ${r.blockers || 'none'}\nHours: ${
          r.hoursWorked ?? 'n/a'
        }`
    )
    .join('\n\n');
}

router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI assistant is not configured (missing API key)' });
    }
    const { message, weeksBack } = chatSchema.parse(req.body);

    const since = mondayOf(new Date());
    since.setUTCDate(since.getUTCDate() - 7 * (weeksBack - 1));
    const reports = await prisma.report.findMany({
      where: { weekStart: { gte: since } },
      include: {
        user: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { weekStart: 'desc' },
    });

    const systemPrompt = `You are a team activity assistant inside a weekly report dashboard.
Answer the manager's question using ONLY the report data provided below.
If the data doesn't contain the answer, say so plainly — never invent activity.
Be concise. When summarizing, call out recurring blockers and workload imbalances.

REPORT DATA (last ${weeksBack} weeks, ${reports.length} reports):

${serializeReports(reports) || 'No reports in this period.'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Anthropic API error:', detail);
      return res.status(502).json({ error: 'AI provider request failed' });
    }

    const data = await response.json();
    const answer = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ answer });
  })
);

export default router;
