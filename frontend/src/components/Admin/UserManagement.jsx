import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function UserManagement() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // user object

  async function load() {
    const data = await api.getUsers();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add User</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['#', 'Username', 'Role', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '11px 16px',
                    fontWeight: 600, color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 ? 'var(--bg)' : 'var(--surface)' }}>
                  <td style={cell}>{u.id}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>
                    {u.username}
                    {u.role === 'admin' && (
                      <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: 10 }}>ADMIN</span>
                    )}
                  </td>
                  <td style={cell}>
                    <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-sky'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ ...cell, color: 'var(--text-muted)' }}>{u.created_at?.slice(0, 10)}</td>
                  <td style={cell}>
                    {u.role !== 'admin' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setResetTarget(u)}
                        >
                          Reset Password
                        </button>
                        <DeleteButton userId={u.id} username={u.username} onDeleted={load} />
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Master account</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onSaved={() => setResetTarget(null)} />}
    </div>
  );
}

function AddUserModal({ onClose, onSaved }) {
  const [form, setForm]   = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username.trim()) { setError('Username is required.'); return; }
    if (form.password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.createUser({ username: form.username.trim(), password: form.password });
      onSaved();
    } catch (err) {
      setError('Username already exists or an error occurred.');
      setSaving(false);
    }
  }

  return (
    <Modal title="Add New User" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-group">
          <label>Username</label>
          <input className="form-control" placeholder="e.g. john" value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus />
        </div>
        <div className="form-group">
          <label>Password</label>
          <div style={{ position: 'relative' }}>
            <input className="form-control" type={showPw ? 'text' : 'password'}
              placeholder="Set initial password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ paddingRight: 40 }} />
            <EyeBtn show={showPw} toggle={() => setShowPw(v => !v)} />
          </div>
        </div>
        <div className="form-group">
          <label>Confirm Password</label>
          <input className="form-control" type={showPw ? 'text' : 'password'}
            placeholder="Re-enter password" value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        </div>
        {error && <ErrorBox msg={error} />}
        <ModalActions saving={saving} label="Create User" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onSaved }) {
  const [pw, setPw]       = useState('');
  const [confirm, setCon] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [done, setDone]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pw.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.resetPassword(user.id, pw);
      setDone(true);
    } catch {
      setError('Failed to reset password.');
      setSaving(false);
    }
  }

  return (
    <Modal title={`Reset Password — ${user.username}`} onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Password reset successfully</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            {user.username} can now log in with the new password.
          </div>
          <button className="btn btn-primary" onClick={onSaved}>Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            You are setting a new password for <strong>{user.username}</strong>. The existing password will be replaced.
          </div>
          <div className="form-group">
            <label>New Password</label>
            <div style={{ position: 'relative' }}>
              <input className="form-control" type={showPw ? 'text' : 'password'}
                placeholder="Enter new password" value={pw}
                onChange={e => setPw(e.target.value)} autoFocus style={{ paddingRight: 40 }} />
              <EyeBtn show={showPw} toggle={() => setShowPw(v => !v)} />
            </div>
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input className="form-control" type={showPw ? 'text' : 'password'}
              placeholder="Re-enter new password" value={confirm}
              onChange={e => setCon(e.target.value)} />
          </div>
          {error && <ErrorBox msg={error} />}
          <ModalActions saving={saving} label="Reset Password" onCancel={onClose} />
        </form>
      )}
    </Modal>
  );
}

function DeleteButton({ userId, username, onDeleted }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirm) return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--danger)' }}>Delete {username}?</span>
      <button className="btn btn-danger btn-sm" disabled={deleting}
        onClick={async () => { setDeleting(true); await api.deleteUser(userId); onDeleted(); }}>
        Yes
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>No</button>
    </div>
  );
  return <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Delete</button>;
}

// ── Shared small components ──────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 420, background: 'var(--surface)', borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)', zIndex: 201, padding: 28,
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>{title}</div>
        {children}
      </div>
    </>
  );
}

function ModalActions({ saving, label, onCancel }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : label}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
      {msg}
    </div>
  );
}

function EyeBtn({ show, toggle }) {
  return (
    <button type="button" onClick={toggle} style={{
      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 16, padding: 4,
    }}>
      {show ? '🙈' : '👁'}
    </button>
  );
}

const cell = { padding: '11px 16px', borderBottom: '1px solid var(--border)' };
