const BASE = '/api';

function getToken() {
  return localStorage.getItem('lt_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem('lt_token');
    window.location.href = '/';
    return;
  }

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) msg = body.error;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Auth
  login:  (data) => fetch(`${BASE}/auth/login`,  { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }),
  logout: ()     => request('/auth/logout', { method: 'POST' }),
  me:     ()     => request('/auth/me'),

  // Leads
  getLeads:     ()       => request('/leads'),
  getLead:      (id)     => request(`/leads/${id}`),
  createLead:   (data)   => request('/leads',     { method: 'POST', body: JSON.stringify(data) }),
  updateLead:   (id, d)  => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  nextEnquiryId: ()      => request('/leads/next-enquiry-id'),
  getLocations:  ()      => request('/leads/meta/locations'),

  // Followups
  getFollowups:   (lead_id) => request(`/followups?lead_id=${lead_id}`),
  createFollowup: (data)    => request('/followups', { method: 'POST', body: JSON.stringify(data) }),

  // Calendar links (admin only) — group share links for the availability calendar
  getCalendarGroups:   ()     => request('/calendar-admin'),
  createCalendarGroup: (data) => request('/calendar-admin', { method: 'POST', body: JSON.stringify(data) }),
  rotateCalendarLink:  (key)  => request(`/calendar-admin/${key}/rotate`, { method: 'POST' }),
  deleteCalendarGroup: (key)  => request(`/calendar-admin/${key}`, { method: 'DELETE' }),

  // Users (admin only)
  getUsers:      ()       => request('/users'),
  createUser:    (data)   => request('/users',               { method: 'POST',   body: JSON.stringify(data) }),
  resetPassword: (id, pw) => request(`/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password: pw }) }),
  deleteUser:    (id)     => request(`/users/${id}`,         { method: 'DELETE' }),
};
