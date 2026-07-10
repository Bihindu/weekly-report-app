import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/projects').then((d) => setProjects(d.projects));
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError('');
    try {
      if (editingId) {
        await api.patch(`/projects/${editingId}`, { name, description: description || null });
      } else {
        await api.post('/projects', { name, description: description || null });
      }
      setName('');
      setDescription('');
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description || '');
  };

  const remove = async (id) => {
    setError('');
    if (!confirm('Delete this project?')) return;
    try {
      await api.delete(`/projects/${id}`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects & categories</h1>
          <p className="subtitle">
            {isManager
              ? 'Manage the projects team members tag their reports with.'
              : 'Projects you can tag your weekly reports with.'}
          </p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {isManager && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>{editingId ? 'Edit project' : 'Add project'}</h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="p-name">Name</label>
              <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Client A" />
            </div>
            <div className="field">
              <label htmlFor="p-desc">Description (optional)</label>
              <input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save}>{editingId ? 'Save changes' : 'Add project'}</button>
            {editingId && (
              <button className="subtle" onClick={() => { setEditingId(null); setName(''); setDescription(''); }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Description</th>
              <th>Reports</th>
              {isManager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.description || '—'}</td>
                <td>{p._count.reports}</td>
                {isManager && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="ghost" onClick={() => startEdit(p)}>Edit</button>{' '}
                    <button className="subtle" onClick={() => remove(p.id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
