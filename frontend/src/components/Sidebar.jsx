import React, { useState } from 'react';
import { useToast } from './Toast';

const API_BASE = 'http://localhost:3002';

export default function Sidebar({ conversations, activeId, onSelect, onNewChat, onGoAdmin, onGoCalendar, onGoEmail, onGoAgent, onGoStudio, onGoDiffusion, onRefresh, user, onLogout, theme, onToggleTheme, isOpen }) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const toast = useToast();

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleRename = async (id) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    await fetch(`${API_BASE}/api/chat/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setEditingId(null);
    toast.success('Chat renamed');
    onRefresh();
  };

  const handleDelete = async (id) => {
    await fetch(`${API_BASE}/api/chat/conversations/${id}`, { method: 'DELETE' });
    toast.success('Chat deleted');
    setContextMenu(null);
    onRefresh();
  };

  const handleExport = (id) => {
    window.open(`${API_BASE}/api/chat/conversations/${id}/export`, '_blank');
    setContextMenu(null);
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-db-badge" onClick={onNewChat} style={{ cursor: 'pointer' }}>DU</span>
        <button className="new-chat-btn" onClick={onNewChat}>+ New</button>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chat-list">
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`chat-item ${c.id === activeId ? 'active' : ''}`}
            onClick={() => { onSelect(c.id); setContextMenu(null); }}
            onContextMenu={(e) => handleContextMenu(e, c.id)}
          >
            {editingId === c.id ? (
              <input
                className="rename-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleRename(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(c.id); if (e.key === 'Escape') setEditingId(null); }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="chat-item-title">{c.title}</span>
                <span className="chat-item-count">{c.message_count}</span>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && conversations.length > 0 && (
          <p style={{ color: '#606080', fontSize: 12, padding: '8px 12px' }}>No matches</p>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="context-overlay" onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <div className="context-item" onClick={() => { setEditingId(contextMenu.id); setEditTitle(conversations.find(c => c.id === contextMenu.id)?.title || ''); setContextMenu(null); }}>
              Rename
            </div>
            <div className="context-item" onClick={() => handleExport(contextMenu.id)}>
              Export
            </div>
            <div className="context-item danger" onClick={() => handleDelete(contextMenu.id)}>
              Delete
            </div>
          </div>
        </>
      )}

      <div className="sidebar-nav">
        {onGoStudio && <button className="sidebar-nav-btn" onClick={onGoStudio}>🎨 Studio</button>}
        {onGoDiffusion && <button className="sidebar-nav-btn" onClick={onGoDiffusion}>🖼 Stable Diffusion</button>}
        {onGoAgent && <button className="sidebar-nav-btn" onClick={onGoAgent}>✦ Agent</button>}
        {onGoCalendar && <button className="sidebar-nav-btn" onClick={onGoCalendar}>📅 Calendar</button>}
        {onGoEmail && <button className="sidebar-nav-btn" onClick={onGoEmail}>✉️ Email</button>}
        {user?.role === 'admin' && <button className="sidebar-nav-btn" onClick={onGoAdmin}>⚙️ Connectors</button>}
      </div>
      <div className="sidebar-footer">
        <button onClick={onToggleTheme}>{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
        <button onClick={onLogout}>Logout ({user?.username})</button>
      </div>
    </div>
  );
}
