import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';

const API_BASE = 'http://localhost:3002';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EVENT_COLORS = ['#7c83ff', '#4ade80', '#f59e0b', '#ff6b6b', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const days = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrev - i, month: month - 1, year, otherMonth: true });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, month, year, otherMonth: false });
  }
  // Next month padding
  while (days.length < 42) {
    days.push({ day: days.length - firstDay - daysInMonth + 1, month: month + 1, year, otherMonth: true });
  }
  return days;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export default function Calendar({ onGoChat, onGoAdmin, onGoEmail, user, onLogout, theme, onToggleTheme }) {
  // Org state
  const [orgs, setOrgs] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [members, setMembers] = useState([]);

  // Calendar state
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [events, setEvents] = useState([]);
  const [weekEvents, setWeekEvents] = useState([]);

  // Modal state
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showJoinOrg, setShowJoinOrg] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(null); // date string (for modal)
  const [selectedDay, setSelectedDay] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }); // currently selected day (for inline event list)
  const [editingEvent, setEditingEvent] = useState(null);

  // Form state
  const [orgName, setOrgName] = useState('');
  const [orgDesc, setOrgDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventColor, setEventColor] = useState('#7c83ff');
  const [linkCopied, setLinkCopied] = useState(false);
  const [hubspotLink, setHubspotLink] = useState('');
  const [editingHubspot, setEditingHubspot] = useState(false);
  const [zoomStatus, setZoomStatus] = useState({ connected: false });
  const [zoomConnecting, setZoomConnecting] = useState(false);

  const toast = useToast();

  const loadOrgs = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/orgs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      setOrgs(data.organizations || []);
      // Auto-select first org if none selected
      if (!activeOrg && data.organizations?.length > 0) {
        setActiveOrg(data.organizations[0]);
      }
    } catch { /* ignore */ }
  }, [activeOrg]);

  const loadEvents = useCallback(async () => {
    if (!activeOrg) return;
    const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    try {
      const resp = await fetch(`${API_BASE}/api/orgs/${activeOrg.id}/events?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      setEvents(data.events || []);
    } catch { /* ignore */ }
  }, [activeOrg, viewYear, viewMonth]);

  const loadWeekEvents = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const resp = await fetch(`${API_BASE}/api/orgs/${activeOrg.id}/events/week`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      setWeekEvents(data.events || []);
    } catch { /* ignore */ }
  }, [activeOrg]);

  const loadMembers = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const resp = await fetch(`${API_BASE}/api/orgs/${activeOrg.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      setMembers(data.members || []);
    } catch { /* ignore */ }
  }, [activeOrg]);

  const loadZoomStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/zoom/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      setZoomStatus(data);
    } catch { /* ignore */ }
  }, []);

  const loadUserSettings = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/user/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      setHubspotLink(data.hubspot_meeting_link || '');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);
  useEffect(() => { loadEvents(); loadWeekEvents(); }, [loadEvents, loadWeekEvents]);
  useEffect(() => { loadZoomStatus(); loadUserSettings(); }, [loadZoomStatus, loadUserSettings]);

  // Handle Zoom OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zoomResult = params.get('zoom');
    if (zoomResult === 'success') {
      toast.success('Zoom account connected!');
      loadZoomStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (zoomResult === 'error') {
      toast.error('Failed to connect Zoom. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // run once on mount

  // ─── Handlers ───

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    try {
      const resp = await fetch(`${API_BASE}/api/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ name: orgName.trim(), description: orgDesc.trim() }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setCreatedCode(data.join_code);
        toast.success(`Organization "${data.name}" created!`);
        loadOrgs();
      } else {
        toast.error(data.detail || 'Failed to create organization');
      }
    } catch { toast.error('Failed to create organization'); }
  };

  const handleJoinOrg = async () => {
    if (!joinCode.trim()) return;
    try {
      const resp = await fetch(`${API_BASE}/api/orgs/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success(data.message);
        setShowJoinOrg(false);
        setJoinCode('');
        loadOrgs();
      } else {
        toast.error(data.detail || 'Failed to join');
      }
    } catch { toast.error('Failed to join organization'); }
  };

  const handleAddEvent = async () => {
    if (!eventTitle.trim() || !eventStart || !eventEnd) {
      toast.info('Fill in title, start, and end time');
      return;
    }
    const url = editingEvent
      ? `${API_BASE}/api/orgs/${activeOrg.id}/events/${editingEvent.id}`
      : `${API_BASE}/api/orgs/${activeOrg.id}/events`;
    try {
      const resp = await fetch(url, {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          title: eventTitle.trim(),
          description: eventDesc.trim(),
          start_time: eventStart,
          end_time: eventEnd,
          all_day: eventAllDay,
          color: eventColor,
        }),
      });
      if (resp.ok) {
        toast.success(editingEvent ? 'Event updated' : 'Event created');
        closeEventModal();
        loadEvents();
        loadWeekEvents();
      } else {
        const data = await resp.json();
        toast.error(data.detail || 'Failed');
      }
    } catch { toast.error('Failed to save event'); }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const resp = await fetch(`${API_BASE}/api/orgs/${activeOrg.id}/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (resp.ok) {
        toast.success('Event deleted');
        loadEvents();
        loadWeekEvents();
        setShowDayDetail(null);
      }
    } catch { toast.error('Failed to delete'); }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await fetch(`${API_BASE}/api/orgs/${activeOrg.id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ role: newRole }),
      });
      toast.success('Role updated');
      loadMembers();
    } catch { toast.error('Failed to update role'); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await fetch(`${API_BASE}/api/orgs/${activeOrg.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      toast.success('Member removed');
      loadMembers();
    } catch { toast.error('Failed to remove'); }
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDesc(event.description || '');
    setEventStart(event.start_time?.slice(0, 16) || '');
    setEventEnd(event.end_time?.slice(0, 16) || '');
    setEventAllDay(event.all_day || false);
    setEventColor(event.color || '#7c83ff');
    setShowAddEvent(true);
  };

  const closeEventModal = () => {
    setShowAddEvent(false);
    setEditingEvent(null);
    setEventTitle('');
    setEventDesc('');
    setEventStart('');
    setEventEnd('');
    setEventAllDay(false);
    setEventColor('#7c83ff');
  };

  const openNewEvent = (dateStr) => {
    setEditingEvent(null);
    setEventTitle('');
    setEventDesc('');
    setEventStart(dateStr ? `${dateStr}T09:00` : '');
    setEventEnd(dateStr ? `${dateStr}T10:00` : '');
    setEventAllDay(false);
    setEventColor('#7c83ff');
    setShowAddEvent(true);
  };

  const copyBookingLink = () => {
    const link = `${window.location.origin}/book/${user?.username}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast.success('Booking link copied!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleConnectZoom = async () => {
    setZoomConnecting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/zoom/connect`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await resp.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast.error(data.detail || 'Failed to get Zoom auth URL');
        setZoomConnecting(false);
      }
    } catch {
      toast.error('Failed to connect Zoom');
      setZoomConnecting(false);
    }
  };

  const handleDisconnectZoom = async () => {
    try {
      await fetch(`${API_BASE}/api/zoom/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setZoomStatus({ connected: false });
      toast.success('Zoom disconnected');
    } catch { toast.error('Failed to disconnect'); }
  };

  const copyHubspotLink = () => {
    if (!hubspotLink.trim()) return;
    navigator.clipboard.writeText(hubspotLink.trim());
    toast.success('HubSpot link copied!');
  };

  const saveHubspotLink = async () => {
    try {
      await fetch(`${API_BASE}/api/user/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ hubspot_meeting_link: hubspotLink.trim() }),
      });
      setEditingHubspot(false);
      if (hubspotLink.trim()) toast.success('HubSpot link saved');
    } catch { toast.error('Failed to save'); }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // ─── Computed ───

  const today = new Date();
  const monthDays = getMonthDays(viewYear, viewMonth);
  const myRole = activeOrg?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const getEventsForDay = (year, month, day) => {
    const d = new Date(year, month, day);
    return events.filter(e => {
      const eDate = new Date(e.start_time);
      return isSameDay(eDate, d);
    });
  };

  // Week days for "this week" bar
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayEvents = weekEvents.filter(e => isSameDay(new Date(e.start_time), d));
    weekDays.push({ date: d, events: dayEvents });
  }

  // ─── Render ───

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-db-badge" onClick={onGoChat} style={{ cursor: 'pointer' }}>DU</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Calendar</span>
        </div>

        <div style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
          <button className="new-chat-btn" style={{ flex: 1, fontSize: 12 }} onClick={() => { setShowCreateOrg(true); setCreatedCode(''); setOrgName(''); setOrgDesc(''); }}>
            + Create Org
          </button>
          <button className="new-chat-btn" style={{ flex: 1, fontSize: 12 }} onClick={() => { setShowJoinOrg(true); setJoinCode(''); }}>
            Join Org
          </button>
        </div>

        <div className="chat-list">
          {orgs.map(o => (
            <div
              key={o.id}
              className={`chat-item ${activeOrg?.id === o.id ? 'active' : ''}`}
              onClick={() => setActiveOrg(o)}
            >
              <span className="chat-item-title">{o.name}</span>
              <span className="chat-item-count" style={{ fontSize: 10 }}>{o.role}</span>
            </div>
          ))}
          {orgs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '16px 12px', textAlign: 'center' }}>
              No organizations yet. Create one or join with a code.
            </p>
          )}
        </div>

        {/* Active org info */}
        {activeOrg && (
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>JOIN CODE</div>
            <div className="org-join-code" style={{ marginBottom: 8, userSelect: 'all' }}>{activeOrg.join_code}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {activeOrg.member_count} member{activeOrg.member_count !== 1 ? 's' : ''} &middot; {activeOrg.role}
            </div>
            {isAdmin && (
              <button
                className="new-chat-btn"
                style={{ width: '100%', marginTop: 8, fontSize: 12 }}
                onClick={() => { setShowMembers(true); loadMembers(); }}
              >
                Manage Members
              </button>
            )}
          </div>
        )}

        {/* Zoom Connection (per-user) */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Zoom Account
          </div>
          {zoomStatus.connected ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>Connected</span>
              </div>
              {zoomStatus.zoom_email && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{zoomStatus.zoom_email}</div>
              )}
              <button
                className="new-chat-btn"
                style={{ width: '100%', fontSize: 11, background: 'var(--bg-active)', color: 'var(--text-secondary)' }}
                onClick={handleDisconnectZoom}
              >
                Disconnect Zoom
              </button>
            </div>
          ) : (
            <button
              className="new-chat-btn"
              style={{ width: '100%', fontSize: 12, background: '#2D8CFF', color: '#fff' }}
              onClick={handleConnectZoom}
              disabled={zoomConnecting}
            >
              {zoomConnecting ? 'Connecting...' : 'Connect Zoom'}
            </button>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Meetings will be created under your Zoom account
          </div>
        </div>

        {/* Share scheduling links */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Share Scheduling
          </div>

          {/* Built-in booking link */}
          <button
            className="new-chat-btn"
            style={{ width: '100%', fontSize: 12, marginBottom: 6, background: linkCopied ? '#34a853' : undefined, color: linkCopied ? '#fff' : undefined }}
            onClick={copyBookingLink}
          >
            {linkCopied ? 'Copied!' : 'Copy My Booking Link'}
          </button>

          {/* HubSpot link */}
          {editingHubspot ? (
            <div style={{ marginTop: 4 }}>
              <input
                type="text"
                placeholder="https://meetings.hubspot.com/your-name"
                value={hubspotLink}
                onChange={(e) => setHubspotLink(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', fontSize: 11, borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', outline: 'none', marginBottom: 4,
                  boxSizing: 'border-box',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveHubspotLink(); }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="new-chat-btn" style={{ flex: 1, fontSize: 11 }} onClick={saveHubspotLink}>Save</button>
                <button className="new-chat-btn" style={{ flex: 1, fontSize: 11, background: 'var(--bg-active)' }} onClick={() => setEditingHubspot(false)}>Cancel</button>
              </div>
            </div>
          ) : hubspotLink ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="new-chat-btn"
                style={{ flex: 1, fontSize: 11, background: '#ff7a59', color: '#fff' }}
                onClick={copyHubspotLink}
              >
                Copy HubSpot Link
              </button>
              <button
                className="new-chat-btn"
                style={{ fontSize: 11, padding: '0 8px', background: 'var(--bg-active)' }}
                onClick={() => setEditingHubspot(true)}
                title="Edit HubSpot link"
              >
                ...
              </button>
            </div>
          ) : (
            <button
              className="new-chat-btn"
              style={{ width: '100%', fontSize: 11, background: 'var(--bg-active)', color: 'var(--text-secondary)' }}
              onClick={() => setEditingHubspot(true)}
            >
              + Add HubSpot Link
            </button>
          )}

          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
            Share either link in your email signature
          </div>
        </div>

        <div className="sidebar-footer">
          <button onClick={onToggleTheme}>{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
          <button onClick={onGoChat}>Chat</button>
          {onGoEmail && <button onClick={onGoEmail}>Email</button>}
          {user?.role === 'admin' && <button onClick={onGoAdmin}>Admin</button>}
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* Main Area */}
      <div className="main-area">
        {!activeOrg ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Team Calendar</div>
              <div>Create or join an organization to get started</div>
            </div>
          </div>
        ) : (
          <>
            {/* Calendar Header */}
            <div className="calendar-header">
              <div className="calendar-nav">
                <button className="cal-nav-btn" onClick={prevMonth}>&lt;</button>
                <h2 className="cal-month-title">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
                <button className="cal-nav-btn" onClick={nextMonth}>&gt;</button>
                <button className="cal-today-btn" onClick={goToday}>Today</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{activeOrg.name}</span>
                <button className="cal-add-btn" onClick={() => openNewEvent(null)}>+ Add Event</button>
              </div>
            </div>

            {/* iPhone-style Monthly Grid */}
            <div className="calendar-grid">
              {/* Day headers */}
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="calendar-day-header">{d}</div>
              ))}
              {/* Day cells */}
              {monthDays.map((cell, i) => {
                const cellDate = new Date(cell.year, cell.month, cell.day);
                const dayEvents = cell.otherMonth ? [] : getEventsForDay(cell.year, cell.month, cell.day);
                const isToday = isSameDay(cellDate, today);
                const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                const isSelected = dateStr === selectedDay && !cell.otherMonth;

                return (
                  <div
                    key={i}
                    className={`calendar-day ${cell.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (!cell.otherMonth) setSelectedDay(dateStr);
                    }}
                    onDoubleClick={() => !cell.otherMonth && openNewEvent(dateStr)}
                  >
                    <div className="calendar-day-number">{cell.day}</div>
                    <div className="calendar-day-events">
                      {dayEvents.slice(0, 5).map((e, j) => (
                        <div
                          key={j}
                          className="calendar-event-dot"
                          style={{ background: e.color || 'var(--accent)' }}
                          title={e.title}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Day Events List (iPhone-style below grid) */}
            <div className="calendar-day-events-list" style={{ flex: 1 }}>
              {selectedDay && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {new Date(selectedDay + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => openNewEvent(selectedDay)}
                    >
                      + Add
                    </button>
                  </div>
                  {(() => {
                    const [y, m, d] = selectedDay.split('-').map(Number);
                    const dayEvts = getEventsForDay(y, m - 1, d);
                    if (dayEvts.length === 0) {
                      return <div className="calendar-no-events">No events</div>;
                    }
                    return dayEvts.map(e => (
                      <div key={e.id} className="calendar-event-row" onClick={() => openEditEvent(e)}>
                        <div className="calendar-event-color-bar" style={{ background: e.color || 'var(--accent)' }} />
                        <div className="calendar-event-info">
                          <div className="calendar-event-title">{e.title}</div>
                          <div className="calendar-event-time">
                            {e.all_day ? 'All day' : `${new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            {e.creator_name && ` · ${e.creator_name}`}
                          </div>
                          {e.zoom_link && (
                            <a href={e.zoom_link} target="_blank" rel="noopener noreferrer" className="calendar-event-zoom" onClick={ev => ev.stopPropagation()}>
                              Join Zoom
                            </a>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Modals ─── */}

      {/* Create Org Modal */}
      {showCreateOrg && (
        <div className="modal-overlay" onClick={() => setShowCreateOrg(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Organization</h3>
              <button className="modal-close" onClick={() => setShowCreateOrg(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {createdCode ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 16, marginBottom: 12, color: 'var(--success)' }}>Organization created!</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Share this code with your team:</div>
                  <div className="org-join-code" style={{ fontSize: 24, padding: '12px 24px', display: 'inline-block' }}>{createdCode}</div>
                </div>
              ) : (
                <>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
                  <input
                    type="text"
                    placeholder="e.g. 50 Words"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateOrg(); }}
                    autoFocus
                  />
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, marginTop: 12 }}>Description (optional)</label>
                  <input
                    type="text"
                    placeholder="Brief description"
                    value={orgDesc}
                    onChange={e => setOrgDesc(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="modal-footer">
              {createdCode ? (
                <button className="btn-primary" onClick={() => setShowCreateOrg(false)}>Done</button>
              ) : (
                <button className="btn-primary" onClick={handleCreateOrg}>Create</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join Org Modal */}
      {showJoinOrg && (
        <div className="modal-overlay" onClick={() => setShowJoinOrg(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Join Organization</h3>
              <button className="modal-close" onClick={() => setShowJoinOrg(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Enter join code</label>
              <input
                type="text"
                placeholder="e.g. XK7-92M4"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleJoinOrg(); }}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontSize: 18, textAlign: 'center', letterSpacing: 2 }}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleJoinOrg}>Join</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Event Modal */}
      {showAddEvent && (
        <div className="modal-overlay" onClick={closeEventModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEvent ? 'Edit Event' : 'Add Event'}</h3>
              <button className="modal-close" onClick={closeEventModal}>&times;</button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Title</label>
              <input
                type="text"
                placeholder="Event title"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                autoFocus
              />
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, marginTop: 12 }}>Description</label>
              <textarea
                placeholder="Optional description"
                value={eventDesc}
                onChange={e => setEventDesc(e.target.value)}
                rows={2}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Start</label>
                  <input type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>End</label>
                  <input type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <input type="checkbox" checked={eventAllDay} onChange={e => setEventAllDay(e.target.checked)} id="allday" />
                <label htmlFor="allday" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>All day</label>
              </div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, marginTop: 12 }}>Color</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {EVENT_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => setEventColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: eventColor === c ? '3px solid var(--text-primary)' : '3px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="modal-footer">
              {editingEvent && (
                <button className="btn-danger" onClick={() => { handleDeleteEvent(editingEvent.id); closeEventModal(); }}>Delete</button>
              )}
              <button className="btn-primary" onClick={handleAddEvent}>
                {editingEvent ? 'Save' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <h3>Members — {activeOrg?.name}</h3>
              <button className="modal-close" onClick={() => setShowMembers(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {members.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{m.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                      joined {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {m.role === 'owner' ? (
                      <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Owner</span>
                    ) : (
                      <>
                        <select
                          value={m.role}
                          onChange={e => handleUpdateRole(m.user_id, e.target.value)}
                          style={{ fontSize: 12, padding: '2px 6px' }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className="btn-danger"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => handleRemoveMember(m.user_id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Day Detail Modal */}
      {showDayDetail && (
        <div className="modal-overlay" onClick={() => setShowDayDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{new Date(showDayDetail + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <button className="modal-close" onClick={() => setShowDayDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {(() => {
                const [y, m, d] = showDayDetail.split('-').map(Number);
                const dayEvts = getEventsForDay(y, m - 1, d);
                if (dayEvts.length === 0) {
                  return <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No events this day</p>;
                }
                return dayEvts.map(e => (
                  <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => { setShowDayDetail(null); openEditEvent(e); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color || 'var(--accent)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginLeft: 18 }}>
                      {e.all_day ? 'All day' : `${new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      {e.creator_name && ` · ${e.creator_name}`}
                    </div>
                    {e.zoom_link && (
                      <a href={e.zoom_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 18 }} onClick={ev => ev.stopPropagation()}>
                        Join Zoom
                      </a>
                    )}
                  </div>
                ));
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => { setShowDayDetail(null); openNewEvent(showDayDetail); }}>+ Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
