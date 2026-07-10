import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER' });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async () => {
    setError('');
    try {
      await register(form);
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand">Create your account</div>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">Password (min 8 characters)</label>
          <input id="password" type="password" value={form.password} onChange={set('password')} />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" value={form.role} onChange={set('role')}>
            <option value="MEMBER">Team member</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        <button onClick={submit} style={{ width: '100%' }}>Sign up</button>
        <p style={{ fontSize: 14 }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
