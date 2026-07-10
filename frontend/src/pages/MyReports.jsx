import { useEffect, useState } from 'react';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

// The form fields are intentionally hard-coded in a fixed order — the
// assignment requires the same structure for every user, so there is no
// field customization anywhere in the app.
const emptyForm = {
  weekStart: '',
  projectId: '',
  tasksCompleted: '',
  tasksPlanned: '',
  blockers: '',
  hoursWorked: '',
  notes: '',
};

function fmtWeek(r) {
  const s = new Date(r.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const e = new Date(r.weekEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${s} – ${e}`;
}

export default function MyReports() {
  const [reports, setReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([api.get('/reports'), api.get('/projects')]).then(([r, p]) => {
      setReports(r.reports);
      setProjects(p.projects);
    });

  useEffect(() => {
    load();
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const startCreate = () => {
    setForm({ ...emptyForm, projectId: projects[0]?.id || '' });
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const startEdit = (r) => {
    setForm({
      weekStart: r.weekStart.slice(0, 10),
      projectId: r.project.id,
      tasksCompleted: r.tasksCompleted,
      tasksPlanned: r.tasksPlanned,
      blockers: r.blockers || '',
      hoursWorked: r.hoursWorked ?? '',
      notes: r.notes || '',
    });
    setEditingId(r.id);
    setShowForm(true);
    setError('');
  };

  const save = async () => {
    setError('');
    const payload = {
      ...form,
      hoursWorked: form.hoursWorked === '' ? null : Number(form.hoursWorked),
      notes: form.notes || null,
    };
    try {
      if (editingId) {
        await api.patch(`/reports/${editingId}`, payload);
      } else {
        await api.post('/reports', payload);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async (id) => {
    setError('');
    try {
      await api.post(`/reports/${id}/submit`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this draft?')) return;
    await api.delete(`/reports/${id}`);
    await load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My weekly reports</h1>
          <p className="subtitle">One report per week — same structure for everyone on the team.</p>
        </div>
        <button onClick={startCreate}>New report</button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>{editingId ? 'Edit report' : 'New report'}</h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="weekStart">Week (pick any day — it snaps to that Monday)</label>
              <input id="weekStart" type="date" value={form.weekStart} onChange={set('weekStart')} />
            </div>
            <div className="field">
              <label htmlFor="projectId">Project / category</label>
              <select id="projectId" value={form.projectId} onChange={set('projectId')}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="tasksCompleted">Tasks completed (one per line)</label>
            <textarea id="tasksCompleted" value={form.tasksCompleted} onChange={set('tasksCompleted')} />
          </div>
          <div className="field">
            <label htmlFor="tasksPlanned">Tasks planned for next week</label>
            <textarea id="tasksPlanned" value={form.tasksPlanned} onChange={set('tasksPlanned')} />
          </div>
          <div className="field">
            <label htmlFor="blockers">Blockers / challenges</label>
            <textarea id="blockers" value={form.blockers} onChange={set('blockers')} placeholder="Leave empty if none" />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="hoursWorked">Hours worked (optional)</label>
              <input id="hoursWorked" type="number" min="0" max="168" value={form.hoursWorked} onChange={set('hoursWorked')} />
            </div>
            <div className="field">
              <label htmlFor="notes">Notes or links (optional)</label>
              <input id="notes" value={form.notes} onChange={set('notes')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save}>{editingId ? 'Save changes' : 'Create draft'}</button>
            <button className="subtle" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {reports.length === 0 && !showForm && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
          No reports yet. Create your first weekly report to get started.
        </div>
      )}

      {reports.map((r) => (
        <div key={r.id} className="report-item">
          <div className="head">
            <div>
              <strong>Week of {fmtWeek(r)}</strong>
              <span className="meta"> · {r.project.name}</span>
              {r.hoursWorked != null && <span className="meta"> · {r.hoursWorked}h</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusBadge report={r} />
              <button className="ghost" onClick={() => startEdit(r)}>Edit</button>
              {r.status === 'DRAFT' && (
                <>
                  <button onClick={() => submit(r.id)}>Submit</button>
                  <button className="subtle" onClick={() => remove(r.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
          <div className="section-label">Completed</div>
          <pre>{r.tasksCompleted}</pre>
          <div className="section-label">Planned next</div>
          <pre>{r.tasksPlanned}</pre>
          {r.blockers && (
            <>
              <div className="section-label">Blockers</div>
              <pre>{r.blockers}</pre>
            </>
          )}
          {r.notes && (
            <>
              <div className="section-label">Notes</div>
              <pre>{r.notes}</pre>
            </>
          )}
        </div>
      ))}
    </>
  );
}
