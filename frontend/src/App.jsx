import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import LoginPage from './components/Auth/LoginPage';
import PipelineBoard from './components/Board/PipelineBoard';
import NewLeadForm from './components/Leads/NewLeadForm';
import FollowupScreen from './components/Followups/FollowupScreen';
import Reports from './components/Reports/Reports';
import UserManagement from './components/Admin/UserManagement';
import CalendarLinks from './components/Admin/CalendarLinks';

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F0F4F8', color: '#64748B', fontSize: 15,
      }}>
        Loading…
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/"          element={<Navigate to="/board" replace />} />
            <Route path="/board"     element={<PipelineBoard />} />
            <Route path="/new-lead"  element={<NewLeadForm />} />
            <Route path="/followups" element={<FollowupScreen />} />
            <Route path="/reports"   element={<Reports />} />
            {user.role === 'admin' && (
              <Route path="/users" element={<UserManagement />} />
            )}
            {user.role === 'admin' && (
              <Route path="/calendar-links" element={<CalendarLinks />} />
            )}
            <Route path="*" element={<Navigate to="/board" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
