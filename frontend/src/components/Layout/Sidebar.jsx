import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../branding';

const NAV = [
  { to: '/board',     label: 'Pipeline Board', icon: '⬜' },
  { to: '/new-lead',  label: 'New Lead',        icon: '＋' },
  { to: '/followups', label: 'Follow-ups',       icon: '📋' },
  { to: '/reports',   label: 'Reports',          icon: '📊' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minHeight: '100vh',
      background: '#1E293B',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{APP_NAME}</div>
        <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Sales Pipeline</div>
      </div>

      {/* Nav links */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={navStyle}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </NavLink>
        ))}

        {/* Aarti Sangrah — a standalone page served by this same Express process, not
            a React route, so it is a plain link rather than a NavLink. Opens in a new
            tab to leave the board where the user left it. */}
        <a
          href="/aartisangrah"
          target="_blank"
          rel="noopener noreferrer"
          style={navStyle({ isActive: false })}
        >
          <span style={{ fontSize: 16 }}>🪔</span>
          Aarti Sangrah
        </a>

        {/* PrimeGem — another standalone page served by this same Express
            process, not a React route, so it is a plain link like Aarti Sangrah. */}
        <a
          href="/kinetic-gem"
          target="_blank"
          rel="noopener noreferrer"
          style={navStyle({ isActive: false })}
        >
          <span style={{ fontSize: 16 }}>💎</span>
          PrimeGem
        </a>

        {/* Shete Parivar Navratri — another standalone page served by this same
            Express process, not a React route, so it is a plain link like the
            two above. */}
        <a
          href="/shetenavratri"
          target="_blank"
          rel="noopener noreferrer"
          style={navStyle({ isActive: false })}
        >
          <span style={{ fontSize: 16 }}>🪔</span>
          Shete Navratri
        </a>

        {/* Admin-only: the approval queue for Shete Navratri's public photo/
            member submissions. A plain link (its own login screen, not a React
            route) placed alongside the other admin-only pages below. */}
        {user?.role === 'admin' && (
          <a
            href="/shetenavratri/admin.html"
            target="_blank"
            rel="noopener noreferrer"
            style={navStyle({ isActive: false })}
          >
            <span style={{ fontSize: 16 }}>✅</span>
            Shete Navratri Admin
          </a>
        )}

        {/* Admin-only: Users */}
        {user?.role === 'admin' && (
          <NavLink to="/users" style={navStyle}>
            <span style={{ fontSize: 16 }}>👥</span>
            Users
          </NavLink>
        )}

        {/* Admin-only: how many people are opening the public pages */}
        {user?.role === 'admin' && (
          <NavLink to="/visitors" style={navStyle}>
            <span style={{ fontSize: 16 }}>📈</span>
            Visitors
          </NavLink>
        )}

        {/* Admin-only: share links for the friends' availability calendar */}
        {user?.role === 'admin' && (
          <NavLink to="/calendar-links" style={navStyle}>
            <span style={{ fontSize: 16 }}>🗓️</span>
            Calendar Links
          </NavLink>
        )}
      </nav>

      {/* Logged-in user + logout */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: user?.role === 'admin' ? '#2563EB' : '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
            textTransform: 'uppercase',
          }}>
            {user?.username?.[0] || '?'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.username}
            </div>
            <div style={{ color: '#94A3B8', fontSize: 11, textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%', padding: '8px 0',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: '#94A3B8',
            fontSize: 13, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function navStyle({ isActive }) {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 8,
    color: isActive ? '#fff' : '#94A3B8',
    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
    textDecoration: 'none',
    fontWeight: isActive ? 600 : 400,
    fontSize: 14, marginBottom: 2,
    transition: 'background 0.15s, color 0.15s',
  };
}
