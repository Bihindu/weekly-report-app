import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.com' },
    update: {},
    create: { name: 'Maya Fernando', email: 'manager@demo.com', passwordHash, role: 'MANAGER' },
  });

  const memberData = [
    { name: 'Kasun Perera', email: 'kasun@demo.com' },
    { name: 'Ishara Silva', email: 'ishara@demo.com' },
    { name: 'Tharindu Jay', email: 'tharindu@demo.com' },
    { name: 'Nadia Ahmed', email: 'nadia@demo.com' },
  ];
  const members = [];
  for (const m of memberData) {
    members.push(
      await prisma.user.upsert({
        where: { email: m.email },
        update: {},
        create: { ...m, passwordHash, role: 'MEMBER' },
      })
    );
  }

  const projectNames = ['Client A', 'Internal Tooling', 'R&D', 'Marketing'];
  const projects = [];
  for (const name of projectNames) {
    projects.push(
      await prisma.project.upsert({ where: { name }, update: {}, create: { name } })
    );
  }

  const completedPool = [
    'Implemented login form validation\nFixed responsive layout on mobile\nCode review for PR #42',
    'Set up CI pipeline\nWrote unit tests for auth service\nUpdated API documentation',
    'Designed dashboard wireframes\nUser interviews (3 sessions)\nIterated on onboarding flow',
    'Migrated reports table to new schema\nOptimized slow dashboard query\nFixed timezone bug',
    'Drafted Q3 campaign copy\nA/B test setup for landing page\nAnalytics review',
  ];
  const plannedPool = [
    'Finish dashboard filters\nStart on export feature',
    'Refactor report service\nAdd integration tests',
    'Ship onboarding v2\nPrepare demo for stakeholders',
    'Index tuning\nStart data archival job',
  ];
  const blockerPool = ['', '', 'Waiting on API keys from vendor', 'Staging environment is down', ''];

  const thisMonday = mondayOf(new Date());
  const weeks = 8;

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(thisMonday);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7 * w);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    for (let i = 0; i < members.length; i++) {
      // Leave some gaps in the current week so the dashboard shows pending members
      if (w === 0 && i >= 2) continue;

      const submitted = Math.random() > 0.15;
      const late = submitted && Math.random() > 0.8;
      const submittedAt = new Date(weekStart);
      submittedAt.setUTCDate(submittedAt.getUTCDate() + (late ? 8 : 4 + Math.floor(Math.random() * 3)));

      await prisma.report.upsert({
        where: { userId_weekStart: { userId: members[i].id, weekStart } },
        update: {},
        create: {
          userId: members[i].id,
          projectId: projects[(i + w) % projects.length].id,
          weekStart,
          weekEnd,
          tasksCompleted: completedPool[(i + w) % completedPool.length],
          tasksPlanned: plannedPool[(i + w) % plannedPool.length],
          blockers: blockerPool[(i * 2 + w) % blockerPool.length],
          hoursWorked: 32 + Math.floor(Math.random() * 12),
          notes: null,
          status: submitted ? 'SUBMITTED' : 'DRAFT',
          submittedAt: submitted ? submittedAt : null,
        },
      });
    }
  }

  console.log('Seeded:');
  console.log('  Manager  → manager@demo.com / password123');
  console.log('  Members  → kasun@demo.com, ishara@demo.com, tharindu@demo.com, nadia@demo.com (same password)');
  console.log(`  ${projectNames.length} projects, ~${weeks} weeks of reports`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
