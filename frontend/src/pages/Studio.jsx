import React, { useState } from 'react';

const TOOLS = [
  { id: 'adobe_cc',  label: 'Adobe Lightroom',  icon: '🅰',  color: '#ff0000', connected: false, desc: 'Photos, albums, metadata' },
  { id: 'figma',     label: 'Figma',             icon: '🎨', color: '#a259ff', connected: false, desc: 'Design files, components' },
  { id: 'frameio',   label: 'Frame.io',          icon: '🎬', color: '#45d0a1', connected: false, desc: 'Video clips, reviews' },
  { id: 'behance',   label: 'Behance',           icon: '✦',  color: '#1769ff', connected: false, desc: 'Portfolio, inspiration' },
  { id: 'dropbox',   label: 'Dropbox',           icon: '📦', color: '#0061ff', connected: false, desc: 'Files and folders' },
  { id: 'google_drive', label: 'Google Drive',   icon: '🔵', color: '#34a853', connected: false, desc: 'Docs, sheets, assets' },
];

const MOCK_ASSETS = [
  { id: 1,  source: 'adobe_cc',    type: 'photo',  name: 'Golden Hour — Shoot 04',   thumb: null, meta: 'ISO 400 · f/2.8 · 1/500s',  tags: ['portrait','outdoor'],  score: 91 },
  { id: 2,  source: 'adobe_cc',    type: 'photo',  name: 'Studio Series — Look 12',  thumb: null, meta: 'ISO 100 · f/8 · 1/125s',   tags: ['studio','product'],    score: 78 },
  { id: 3,  source: 'figma',       type: 'design', name: 'Brand Refresh v3',         thumb: null, meta: '14 components · 6 styles',  tags: ['branding'],            score: null },
  { id: 4,  source: 'figma',       type: 'design', name: 'App UI Kit',               thumb: null, meta: '82 components · 12 styles', tags: ['ui','mobile'],         score: null },
  { id: 5,  source: 'frameio',     type: 'video',  name: 'Campaign Cut — Draft 3',   thumb: null, meta: '4K · 23.98fps · 1m 42s',    tags: ['campaign','video'],    score: null },
  { id: 6,  source: 'behance',     type: 'project',name: 'Editorial — Spring 2026',  thumb: null, meta: '24 images · 1.2k views',    tags: ['editorial'],           score: 85 },
  { id: 7,  source: 'adobe_cc',    type: 'photo',  name: 'Street Series — Downtown', thumb: null, meta: 'ISO 800 · f/4 · 1/1000s',  tags: ['street','urban'],      score: 62 },
  { id: 8,  source: 'figma',       type: 'design', name: 'Social Templates 2026',    thumb: null, meta: '34 frames · 3 styles',      tags: ['social','templates'],  score: null },
  { id: 9,  source: 'frameio',     type: 'video',  name: 'BTS — Behind The Shoot',   thumb: null, meta: '1080p · 29.97fps · 4m 11s', tags: ['bts'],                 score: null },
  { id: 10, source: 'adobe_cc',    type: 'photo',  name: 'Product Launch — Hero',    thumb: null, meta: 'ISO 200 · f/5.6 · 1/250s', tags: ['product','hero'],      score: 95 },
];

const SOURCE_COLORS = {
  adobe_cc: '#ff0000', figma: '#a259ff', frameio: '#45d0a1',
  behance: '#1769ff', dropbox: '#0061ff', google_drive: '#34a853',
};
const SOURCE_ICONS = {
  adobe_cc: '🅰', figma: '🎨', frameio: '🎬',
  behance: '✦', dropbox: '📦', google_drive: '🔵',
};
const TYPE_ICONS = { photo: '📷', design: '🎨', video: '🎬', project: '✦' };

const SCORE_COLOR = (s) => s >= 85 ? '#4ade80' : s >= 65 ? '#f59e0b' : '#ff6b6b';

export default function Studio({ onGoChat, onGoAdmin, onGoCalendar, user, onLogout, theme, onToggleTheme }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [tools, setTools] = useState(TOOLS);
  const [showConnect, setShowConnect] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtered = filter === 'all'
    ? MOCK_ASSETS
    : MOCK_ASSETS.filter(a => a.source === filter || a.type === filter);

  const connectedCount = tools.filter(t => t.connected).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>Studio</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: 20, padding: '2px 10px' }}>
          {connectedCount}/{tools.length} connected
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
          + Connect Tool
        </button>
        <button onClick={onGoChat} style={navBtn}>Chat</button>
        <button onClick={onGoCalendar} style={navBtn}>Calendar</button>
        {user?.role === 'admin' && <button onClick={onGoAdmin} style={navBtn}>Admin</button>}
        <button onClick={onToggleTheme} style={navBtn}>{theme === 'dark' ? '☀' : '🌙'}</button>
        <button onClick={onLogout} style={{ ...navBtn, color: 'var(--danger)' }}>Out</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Main area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Tool pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <button onClick={() => setFilter('all')} style={filterBtn(filter === 'all')}>All Assets</button>
            <button onClick={() => setFilter('photo')} style={filterBtn(filter === 'photo')}>📷 Photos</button>
            <button onClick={() => setFilter('design')} style={filterBtn(filter === 'design')}>🎨 Designs</button>
            <button onClick={() => setFilter('video')} style={filterBtn(filter === 'video')}>🎬 Video</button>
            <button onClick={() => setFilter('project')} style={filterBtn(filter === 'project')}>✦ Portfolio</button>
            <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
            {tools.map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)} style={{ ...filterBtn(filter === t.id), borderColor: filter === t.id ? SOURCE_COLORS[t.id] : undefined }}>
                {SOURCE_ICONS[t.id]} {t.label.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Asset grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {filtered.map(asset => (
              <div key={asset.id} onClick={() => setSelected(asset)}
                style={{ background: 'var(--bg-secondary)', border: `1px solid ${selected?.id === asset.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s', }}>
                {/* Thumbnail placeholder */}
                <div style={{ height: 130, background: `linear-gradient(135deg, ${SOURCE_COLORS[asset.source]}22, ${SOURCE_COLORS[asset.source]}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                  {TYPE_ICONS[asset.type]}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{asset.name}</span>
                    {asset.score != null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: SCORE_COLOR(asset.score), whiteSpace: 'nowrap', marginTop: 1 }}>{asset.score}/100</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{asset.meta}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    <span style={{ fontSize: 10, background: SOURCE_COLORS[asset.source] + '22', color: SOURCE_COLORS[asset.source], borderRadius: 4, padding: '1px 6px' }}>
                      {SOURCE_ICONS[asset.source]} {asset.source.replace('_', ' ')}
                    </span>
                    {asset.tags.slice(0, 2).map(tag => (
                      <span key={tag} style={{ fontSize: 10, background: 'var(--bg-hover)', color: 'var(--text-muted)', borderRadius: 4, padding: '1px 6px' }}>#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Asset detail panel */}
        {selected && (
          <div style={{ width: 300, borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: 20, overflow: 'auto', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Asset Detail</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ height: 160, background: `linear-gradient(135deg, ${SOURCE_COLORS[selected.source]}22, ${SOURCE_COLORS[selected.source]}55)`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, marginBottom: 16 }}>
              {TYPE_ICONS[selected.type]}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{selected.meta}</div>

            {selected.score != null && (
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Post Performance Score</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: SCORE_COLOR(selected.score) }}>{selected.score}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span></div>
                <div style={{ fontSize: 12, color: SCORE_COLOR(selected.score), marginTop: 2 }}>
                  {selected.score >= 85 ? 'Strong — ready to post' : selected.score >= 65 ? 'Good — minor tweaks suggested' : 'Needs work before posting'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {selected.tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px' }}>#{tag}</span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={onGoChat} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Ask Agent About This
              </button>
              <button style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', cursor: 'pointer', fontSize: 13 }}>
                Score This Photo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Connect Tool drawer */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setSidebarOpen(false)}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 340, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: 24, overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Connect Tools</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {tools.map(tool => (
              <div key={tool.id} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{tool.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{tool.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tool.desc}</div>
                </div>
                <button
                  onClick={() => {
                    setTools(prev => prev.map(t => t.id === tool.id ? { ...t, connected: !t.connected } : t));
                  }}
                  style={{ background: tool.connected ? 'var(--success-bg)' : tool.color + '22', color: tool.connected ? 'var(--success)' : tool.color, border: `1px solid ${tool.connected ? 'var(--success)' : tool.color}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {tool.connected ? '✓ Connected' : 'Connect'}
                </button>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              API credentials are configured in Admin → Connectors. Connect here to start syncing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = {
  background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13,
};

const filterBtn = (active) => ({
  background: active ? 'var(--accent)' : 'var(--bg-hover)',
  color: active ? '#fff' : 'var(--text-secondary)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
  transition: 'all 0.15s',
});
