import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const PINE = '#2f6f5e';
const CLAY = '#b3541e';
const SLATE = '#8a93a0';

export default function TeamDashboard() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState([]);
  const [trends, setTrends] = useState(null);
  const [reports, setReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);

  // Filters
  const [week, setWeek] = useState('');
  const [memberId, setMemberId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/reports/team/status'),
      api.get('/dashboard/trends?weeks=8'),
      api.get('/projects'),
    ]).then(([s, st, t, p]) => {
      setSummary(s);
      setStatus(st.status);
      setTrends(t);
      setProjects(p.projects);
      setMembers(st.status.map((row) => row.member));
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (week) params.set('week', week);
    if (memberId) params.set('memberId', memberId);
    if (projectId) params.set('projectId', projectId);
    if (!week && from) params.set('from', from);
    if (!week && to) params.set('to', to);
    api.get(`/reports/team?${params}`).then((d) => setReports(d.reports));
  }, [week, memberId, projectId, from, to]);

  const trendData = useMemo(
    () =>
      (trends?.taskTrend || []).map((r) => ({
        ...r,
        week: new Date(r.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })),
    [trends]
  );

  if (!summary) return <div className="page-loading">Loading dashboard…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team dashboard</h1>
          <p className="subtitle">
            Week of {new Date(summary.weekStart).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card metric">
          <div className="value">{summary.totalSubmitted} / {summary.teamSize}</div>
          <div className="label">Reports submitted this week</div>
        </div>
        <div className="card metric">
          <div className="value">{summary.complianceRate}%</div>
          <div className="label">Submission compliance</div>
        </div>
        <div className="card metric">
          <div className="value">{summary.openBlockers}</div>
          <div className="label">Open blockers across the team</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Tasks completed over time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="#eef0ec" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="tasks" stroke={PINE} strokeWidth={2} dot={false} name="Tasks" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Submissions by member (8 weeks)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trends?.byMember || []}>
              <CartesianGrid stroke="#eef0ec" />
              <XAxis dataKey="member" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="submitted" stackId="a" fill={PINE} name="Submitted" />
              <Bar dataKey="drafts" stackId="a" fill={SLATE} name="Drafts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Workload by project (tasks)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trends?.byProject || []} layout="vertical">
              <CartesianGrid stroke="#eef0ec" />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="project" fontSize={12} width={110} />
              <Tooltip />
              <Bar dataKey="tasks" fill={CLAY} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>This week's submission status</h2>
          <table>
            <thead>
              <tr><th>Member</th><th>Status</th><th>Submitted</th></tr>
            </thead>
            <tbody>
              {status.map((row) => (
                <tr key={row.member.id}>
                  <td>{row.member.name}</td>
                  <td>
                    <span className={`badge ${row.state}`}>
                      {row.state.charAt(0).toUpperCase() + row.state.slice(1)}
                    </span>
                  </td>
                  <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Recent activity</h2>
        <table>
          <thead>
            <tr><th>Member</th><th>Project</th><th>Week</th><th>Status</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {(trends?.recent || []).map((r) => (
              <tr key={r.id}>
                <td>{r.member}</td>
                <td>{r.project}</td>
                <td>{new Date(r.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status === 'SUBMITTED' ? 'Submitted' : 'Draft'}</span></td>
                <td>{new Date(r.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>All team reports</h2>
        <div className="filters">
          <div>
            <label htmlFor="f-week">Week</label>
            <input id="f-week" type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
          </div>
          <div>
            <label htmlFor="f-member">Team member</label>
            <select id="f-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">All members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-project">Project</label>
            <select id="f-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-from">From</label>
            <input id="f-from" type="date" value={from} disabled={!!week} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="f-to">To</label>
            <input id="f-to" type="date" value={to} disabled={!!week} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            className="subtle"
            onClick={() => { setWeek(''); setMemberId(''); setProjectId(''); setFrom(''); setTo(''); }}
          >
            Clear filters
          </button>
        </div>

        {reports.length === 0 && <p className="subtitle">No reports match these filters.</p>}
        {reports.map((r) => (
          <div key={r.id} className="report-item">
            <div className="head">
              <div>
                <strong>{r.user.name}</strong>
                <span className="meta"> · {r.project.name} · week of {new Date(r.weekStart).toLocaleDateString()}</span>
              </div>
              <StatusBadge report={r} />
            </div>
            <div className="section-label">Completed</div>
            <pre>{r.tasksCompleted}</pre>
            {r.blockers && (
              <>
                <div className="section-label">Blockers</div>
                <pre>{r.blockers}</pre>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
