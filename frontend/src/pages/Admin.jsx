import React, { useState, useEffect, useCallback } from 'react';
import { KnowledgeBaseAdmin } from '../components/KnowledgeBase';
import ConnectorModal from '../components/ConnectorModal';
import { useToast } from '../components/Toast';

const API_BASE = 'http://localhost:3002';

const ICONS = {
  'local_files': '📁', 'dropbox': '📦', 'google_drive': '🔵', 'sharepoint': '🟦',
  'database': '🗄️', 'web_scraper': '🌐', 'email': '✉️', 'slack': '💬',
  'teams': '👥', 'salesforce': '☁️', 'hubspot': '🟠', 'aws_s3': '🪣', 'azure_blob': '🔷',
  'adobe_cc': '🅰', 'figma': '🎨', 'frameio': '🎬', 'behance': '✦', 'unsplash': '📷', 'notion': '📓',
};

export default function Admin({ onGoChat, onGoCalendar, onGoEmail, user, onLogout, theme, onToggleTheme }) {
  const [connectors, setConnectors] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [models, setModels] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedConnector, setSelectedConnector] = useState(null);
  const [systemPrompts, setSystemPrompts] = useState({});
  const [editingPromptModel, setEditingPromptModel] = useState('');
  const [editingPromptText, setEditingPromptText] = useState('');
  const [branding, setBranding] = useState({ app_name: 'Dashunbored', accent_color: '#7c83ff', logo_text: '' });
  const [agentModel, setAgentModel] = useState('claude-haiku-4-5-20251001');
  const [emailPreview, setEmailPreview] = useState(null);
  const [apiKeys, setApiKeys] = useState({});
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadConnectors = useCallback(async () => {
    const resp = await fetch(`${API_BASE}/api/connectors`);
    const data = await resp.json();
    setConnectors(data.connectors || []);
  }, []);

  const loadKBs = useCallback(async () => {
    const resp = await fetch(`${API_BASE}/api/knowledge`);
    const data = await resp.json();
    setKnowledgeBases(data.knowledge_bases || []);
  }, []);

  const loadModels = useCallback(async () => {
    const resp = await fetch(`${API_BASE}/api/models`);
    const data = await resp.json();
    setModels(data.models || []);
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/analytics/overview`);
      const data = await resp.json();
      setAnalytics(data);
    } catch { /* ignore */ }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const [promptsResp, brandingResp] = await Promise.all([
        fetch(`${API_BASE}/api/settings/system-prompts`),
        fetch(`${API_BASE}/api/settings/branding`),
      ]);
      const promptsData = await promptsResp.json();
      const brandingData = await brandingResp.json();
      setSystemPrompts(promptsData.prompts || {});
      setBranding(brandingData);
    } catch { /* ignore */ }
  }, []);

  const loadApiKeys = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/settings/api-keys`);
      const data = await resp.json();
      setApiKeys(data.api_keys || {});
    } catch { /* ignore */ }
  }, []);

  const loadAgentModel = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/settings/agent-model`);
      const data = await resp.json();
      setAgentModel(data.model || 'claude-haiku-4-5-20251001');
    } catch {}
  }, []);

  const saveAgentModel = async (model) => {
    setAgentModel(model);
    await fetch(`${API_BASE}/api/settings/agent-model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
  };

  const loadEmailPreview = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/connectors/email/preview`);
      const data = await resp.json();
      setEmailPreview(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadConnectors(), loadKBs(), loadModels(), loadAnalytics(), loadSettings(), loadEmailPreview(), loadApiKeys(), loadAgentModel()])
      .then(() => setLoading(false));
  }, [loadConnectors, loadKBs, loadModels, loadAnalytics, loadSettings, loadEmailPreview, loadApiKeys, loadAgentModel]);

  const connectedCount = connectors.filter(c => c.is_connected).length;
  const totalChunks = knowledgeBases.reduce((sum, kb) => sum + kb.total_chunks, 0);

  const saveSystemPrompt = async () => {
    await fetch(`${API_BASE}/api/settings/system-prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: editingPromptModel, prompt: editingPromptText }),
    });
    toast.success('System prompt saved');
    loadSettings();
    setEditingPromptModel('');
  };

  const saveApiKey = async (provider) => {
    if (!newApiKey.trim()) return;
    await fetch(`${API_BASE}/api/settings/api-keys`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: newApiKey.trim() }),
    });
    toast.success('API key saved');
    setNewApiKey('');
    setShowApiKey(false);
    loadApiKeys();
    loadModels();
  };

  const saveBranding = async () => {
    await fetch(`${API_BASE}/api/settings/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding),
    });
    toast.success('Branding updated');
  };

  const connectorsByCategory = {
    'Creative Tools': connectors.filter(c => ['adobe_cc', 'figma', 'frameio', 'behance', 'unsplash', 'notion'].includes(c.type)),
    'Cloud Storage': connectors.filter(c => ['dropbox', 'google_drive', 'sharepoint', 'aws_s3', 'azure_blob'].includes(c.type)),
    'Communication': connectors.filter(c => ['email', 'slack', 'teams'].includes(c.type)),
    'Business Systems': connectors.filter(c => ['database', 'salesforce', 'hubspot', 'web_scraper'].includes(c.type)),
    'Local': connectors.filter(c => ['local_files'].includes(c.type)),
  };

  if (loading) {
    return (
      <div className="app-layout">
        <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-db-badge" onClick={onGoChat} style={{ cursor: 'pointer' }}>DU</span>
        </div>

        <div className="chat-list">
          {['overview', 'connectors', 'knowledge', 'models', 'apikeys', 'analytics', 'prompts', 'branding'].map(tab => (
            <div key={tab} className={`chat-item ${activeTab === tab ? 'active' : ''}`} onClick={() => { setActiveTab(tab); if (tab === 'analytics') loadAnalytics(); }}>
              {
                { overview: '📊 Overview', connectors: '🔌 Data Connectors', knowledge: '📚 Knowledge Bases',
                  models: '🤖 Models', apikeys: '🔑 API Keys', analytics: '📈 Analytics', prompts: '💬 System Prompts', branding: '🎨 Branding',
                }[tab]
              }
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={onToggleTheme}>{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
          <button onClick={onGoChat}>Chat</button>
          {onGoCalendar && <button onClick={onGoCalendar}>Calendar</button>}
          {onGoEmail && <button onClick={onGoEmail}>Email</button>}
          <button onClick={onLogout}>Logout ({user?.username})</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-layout">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <h2>Dashboard Overview</h2>
            <div className="connector-grid" style={{ marginBottom: 32 }}>
              <div className="connector-card" style={{ borderLeft: '3px solid #7c83ff' }}>
                <div className="desc">MODELS LOADED</div>
                <div className="name" style={{ fontSize: 28 }}>{models.length}</div>
              </div>
              <div className="connector-card" style={{ borderLeft: '3px solid #4ade80' }}>
                <div className="desc">KNOWLEDGE BASES</div>
                <div className="name" style={{ fontSize: 28 }}>{knowledgeBases.length}</div>
              </div>
              <div className="connector-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <div className="desc">TOTAL CHUNKS INDEXED</div>
                <div className="name" style={{ fontSize: 28 }}>{totalChunks.toLocaleString()}</div>
              </div>
              <div className="connector-card" style={{ borderLeft: '3px solid #06b6d4' }}>
                <div className="desc">CONNECTORS ACTIVE</div>
                <div className="name" style={{ fontSize: 28 }}>{connectedCount} / {connectors.length}</div>
              </div>
            </div>

            <div className="admin-section">
              <h3>Models</h3>
              <div className="connector-grid">
                {models.map((m) => (
                  <div key={m.name} className="connector-card">
                    <div className="name">🤖 {m.name}</div>
                    <div className="desc">
                      {m.details?.parameter_size || ''} {m.details?.quantization_level ? `| ${m.details.quantization_level}` : ''}
                    </div>
                    <span className="status connected">Ready</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-section">
              <h3>Data Sources</h3>
              <div className="connector-grid">
                {connectors.map((c) => (
                  <div key={c.type} className="connector-card" style={{ cursor: 'pointer' }} onClick={() => c.type !== 'local_files' && setSelectedConnector(c)}>
                    <div className="name">{ICONS[c.type] || '📎'} {c.display_name}</div>
                    <div className="desc">{c.description}</div>
                    <span className={`status ${c.is_connected ? 'connected' : 'disconnected'}`}>
                      {c.is_connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Preview Widget */}
            <div className="admin-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Recent Emails</h3>
                <button
                  onClick={loadEmailPreview}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
                >
                  Refresh
                </button>
              </div>
              {!emailPreview || !emailPreview.connected ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                  <p>No email account connected.</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Go to Data Connectors to connect Gmail or Outlook.</p>
                </div>
              ) : emailPreview.error ? (
                <div style={{ color: '#ef4444', fontSize: 13, padding: '12px 0' }}>
                  Error fetching emails: {emailPreview.error}
                </div>
              ) : emailPreview.emails.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                  No emails found in inbox.
                </div>
              ) : (
                <div className="email-preview-list">
                  {emailPreview.account && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      {emailPreview.provider} &mdash; {emailPreview.account} &mdash; {emailPreview.total} recent
                    </div>
                  )}
                  {emailPreview.emails.map((em, i) => (
                    <div key={i} className="email-preview-item">
                      <div className="email-preview-header">
                        <span className="email-preview-from">{em.from.split('<')[0].trim()}</span>
                        <span className="email-preview-date">
                          {em.date ? new Date(em.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <div className="email-preview-subject">{em.subject}</div>
                      <div className="email-preview-body">{em.preview}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* CONNECTORS TAB */}
        {activeTab === 'connectors' && (
          <>
            <h2>Data Connectors</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              Connect your data sources to make them searchable by the AI. {connectedCount} of {connectors.length} connected.
            </p>

            {Object.entries(connectorsByCategory).map(([category, items]) => (
              <div key={category} className="admin-section">
                <h3>{{'Creative Tools':'🎨 Creative Tools','Cloud Storage':'☁️ Cloud Storage','Communication':'💬 Communication','Business Systems':'🏢 Business Systems','Local':'📁 Local'}[category]}</h3>
                <div className="connector-grid">
                  {items.map((c) => (
                    <div key={c.type} className="connector-card" style={{ cursor: c.type !== 'local_files' ? 'pointer' : 'default' }} onClick={() => c.type !== 'local_files' && setSelectedConnector(c)}>
                      <div className="name" style={{ fontSize: 18, marginBottom: 8 }}>{ICONS[c.type]} {c.display_name}</div>
                      <div className="desc">{c.description}</div>
                      {c.last_sync && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Last synced: {new Date(c.last_sync).toLocaleString()}
                        </div>
                      )}
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`status ${c.is_connected ? 'connected' : c.type === 'local_files' ? 'connected' : 'disconnected'}`}>
                          {c.type === 'local_files' ? 'Always Available' : (c.is_connected ? 'Connected' : 'Not Connected')}
                        </span>
                        {c.type !== 'local_files' && (
                          <button className="btn-primary" style={{ fontSize: 12, padding: '4px 12px' }}>
                            {c.is_connected ? 'Configure' : 'Connect'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* KNOWLEDGE TAB */}
        {activeTab === 'knowledge' && (
          <>
            <h2>Knowledge Bases</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              Upload documents to create searchable knowledge bases. The AI will use these to answer questions.
            </p>
            <KnowledgeBaseAdmin knowledgeBases={knowledgeBases} onRefresh={loadKBs} />
          </>
        )}

        {/* MODELS TAB */}
        {activeTab === 'models' && (
          <>
            <h2>AI Models</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              Models available through Ollama. Select which model to use in the chat interface.
            </p>
            <div className="connector-grid">
              {models.map((m) => (
                <div key={m.name} className="connector-card">
                  <div className="name" style={{ fontSize: 18, marginBottom: 8 }}>🤖 {m.name}</div>
                  <div className="desc" style={{ marginBottom: 8 }}>
                    <div>Parameters: {m.details?.parameter_size || 'Unknown'}</div>
                    <div>Quantization: {m.details?.quantization_level || 'N/A'}</div>
                    <div>Family: {m.details?.family || 'Unknown'}</div>
                    <div>Size: {(m.size / (1024**3)).toFixed(1)} GB</div>
                  </div>
                  <span className="status connected">Ready</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* API KEYS TAB */}
        {activeTab === 'apikeys' && (
          <>
            <h2>API Keys</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              Manage API keys for external AI providers. Keys are stored securely in the database.
            </p>

            {/* Anthropic / Claude */}
            <div className="admin-section">
              <h3>Anthropic (Claude)</h3>
              <div className="connector-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div className="name" style={{ fontSize: 16, marginBottom: 4 }}>Claude API Key</div>
                    <div className="desc">Required for Claude Opus, Sonnet, and Haiku models</div>
                  </div>
                  <span className={`status ${apiKeys.anthropic?.configured ? 'connected' : 'disconnected'}`}>
                    {apiKeys.anthropic?.configured ? 'Connected' : 'Not Configured'}
                  </span>
                </div>

                {apiKeys.anthropic?.configured && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'monospace', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: 6 }}>
                    Key: {apiKeys.anthropic.masked} &nbsp;
                    <span style={{ fontSize: 11, opacity: 0.6 }}>
                      (source: {apiKeys.anthropic.source === 'admin' ? 'Admin Panel' : 'Config File'})
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                  <button className="btn-primary" onClick={() => saveApiKey('anthropic')} style={{ padding: '8px 16px' }}>
                    Save
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                  Get your API key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    console.anthropic.com
                  </a>
                </div>
              </div>
            </div>

            {/* Agent Model Selector */}
            <div className="admin-section">
              <h3>Agent & Photo Scorer Model</h3>
              <div className="connector-card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-muted)' }}>
                  Choose which model powers the Creative Agent. Claude models use your Anthropic API key. Ollama models run free and locally on your machine (or DGX Spark).
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px' }}>Claude (API)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {[
                    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fastest · Cheapest · Great for most tasks' },
                    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Balanced · Stronger reasoning · ~5x Haiku cost' },
                    { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: 'Most capable · Best for complex briefs · ~15x Haiku cost' },
                  ].map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${agentModel === m.id ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', background: agentModel === m.id ? 'rgba(124,58,237,0.08)' : 'var(--bg-secondary)' }}>
                      <input type="radio" name="agentModel" value={m.id} checked={agentModel === m.id} onChange={() => saveAgentModel(m.id)} style={{ accentColor: 'var(--accent)' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px' }}>Ollama (Local / DGX Spark)</p>
                {models.filter(m => m.id && !m.id.startsWith('claude')).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    No Ollama models detected. Install Ollama and pull a model — e.g. <code>ollama pull llama3.1</code>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {models.filter(m => m.id && !m.id.startsWith('claude')).map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${agentModel === m.id ? '#16a34a' : 'var(--border)'}`, cursor: 'pointer', background: agentModel === m.id ? 'rgba(22,163,74,0.08)' : 'var(--bg-secondary)' }}>
                        <input type="radio" name="agentModel" value={m.id} checked={agentModel === m.id} onChange={() => saveAgentModel(m.id)} style={{ accentColor: '#16a34a' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: '#16a34a' }}>Free · Runs locally · No API cost</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Zoom OAuth App Credentials (global - admin only) */}
            <div className="admin-section">
              <h3>Zoom Integration</h3>
              <div className="connector-card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <div className="name" style={{ fontSize: 16, marginBottom: 4 }}>Zoom OAuth App</div>
                  <div className="desc">
                    Create a Zoom OAuth app at{' '}
                    <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                      marketplace.zoom.us
                    </a>
                    {' '}(User-managed OAuth type). Each employee connects their own Zoom account from the Calendar page.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Client ID</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={apiKeys.integrations?.zoom_client_id || ''}
                        readOnly
                        placeholder="Not configured"
                        style={{ flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 13 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Client Secret</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="password"
                        value={apiKeys.integrations?.zoom_client_secret_set ? '••••••••••' : ''}
                        readOnly
                        placeholder="Not configured"
                        style={{ flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 13 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Redirect URI (set this in your Zoom app)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <code style={{ flex: 1, background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        http://localhost:3002/api/zoom/callback
                      </code>
                      <button
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
                        onClick={() => { navigator.clipboard.writeText('http://localhost:3002/api/zoom/callback'); toast.success('Copied!'); }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Update Zoom Credentials</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Zoom Client ID"
                      id="zoom-client-id-input"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
                    />
                    <input
                      type="password"
                      placeholder="Zoom Client Secret"
                      id="zoom-client-secret-input"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
                    />
                    <button
                      className="btn-primary"
                      style={{ alignSelf: 'flex-start', padding: '8px 16px' }}
                      onClick={async () => {
                        const clientId = document.getElementById('zoom-client-id-input').value.trim();
                        const clientSecret = document.getElementById('zoom-client-secret-input').value.trim();
                        if (!clientId && !clientSecret) return;
                        const saves = [];
                        if (clientId) saves.push(fetch(`${API_BASE}/api/settings/api-keys`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'zoom_client_id', api_key: clientId }) }));
                        if (clientSecret) saves.push(fetch(`${API_BASE}/api/settings/api-keys`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'zoom_client_secret', api_key: clientSecret }) }));
                        await Promise.all(saves);
                        toast.success('Zoom credentials saved');
                        document.getElementById('zoom-client-id-input').value = '';
                        document.getElementById('zoom-client-secret-input').value = '';
                        loadApiKeys();
                      }}
                    >
                      Save Zoom Credentials
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Future providers placeholder */}
            <div className="admin-section">
              <h3>Other Providers</h3>
              <div className="connector-grid">
                <div className="connector-card" style={{ opacity: 0.5 }}>
                  <div className="name">OpenAI</div>
                  <div className="desc">GPT-4, GPT-4o models</div>
                  <span className="status disconnected">Coming Soon</span>
                </div>
                <div className="connector-card" style={{ opacity: 0.5 }}>
                  <div className="name">Google AI</div>
                  <div className="desc">Gemini models</div>
                  <span className="status disconnected">Coming Soon</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && analytics && (
          <>
            <h2>Usage Analytics</h2>
            <div className="connector-grid" style={{ marginBottom: 32 }}>
              <div className="connector-card" style={{ borderLeft: '3px solid #7c83ff' }}>
                <div className="desc">TOTAL CONVERSATIONS</div>
                <div className="name" style={{ fontSize: 28 }}>{analytics.total_conversations}</div>
              </div>
              <div className="connector-card" style={{ borderLeft: '3px solid #4ade80' }}>
                <div className="desc">TOTAL MESSAGES</div>
                <div className="name" style={{ fontSize: 28 }}>{analytics.total_messages}</div>
              </div>
              <div className="connector-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <div className="desc">USER MESSAGES</div>
                <div className="name" style={{ fontSize: 28 }}>{analytics.total_user_messages}</div>
              </div>
              <div className="connector-card" style={{ borderLeft: '3px solid #06b6d4' }}>
                <div className="desc">AI RESPONSES</div>
                <div className="name" style={{ fontSize: 28 }}>{analytics.total_ai_messages}</div>
              </div>
            </div>

            <div className="admin-section">
              <h3>Model Usage</h3>
              <div className="connector-grid">
                {analytics.model_usage.map(({ model, count }) => (
                  <div key={model} className="connector-card">
                    <div className="name">🤖 {model}</div>
                    <div className="desc">{count} conversation{count !== 1 ? 's' : ''}</div>
                  </div>
                ))}
                {analytics.model_usage.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No conversations yet</p>
                )}
              </div>
            </div>

            <div className="admin-section">
              <h3>Recent Conversations</h3>
              <div className="kb-list">
                {analytics.recent_conversations.map(c => (
                  <div key={c.id} className="kb-item">
                    <div className="info">
                      <h4>{c.title}</h4>
                      <p>{c.model} | {c.message_count} messages</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* SYSTEM PROMPTS TAB */}
        {activeTab === 'prompts' && (
          <>
            <h2>System Prompts</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              Configure default system prompts for each model. These define the AI's behavior and personality.
            </p>

            <div className="admin-section">
              <h3>Set Prompt</h3>
              <div className="form-field">
                <label>Model</label>
                <select
                  value={editingPromptModel}
                  onChange={(e) => {
                    setEditingPromptModel(e.target.value);
                    setEditingPromptText(systemPrompts[e.target.value] || '');
                  }}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', width: '100%', marginBottom: 12 }}
                >
                  <option value="">Select model...</option>
                  <option value="default">Default (all models)</option>
                  {models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              {editingPromptModel && (
                <>
                  <div className="form-field">
                    <label>System Prompt</label>
                    <textarea
                      value={editingPromptText}
                      onChange={(e) => setEditingPromptText(e.target.value)}
                      rows={6}
                      placeholder="You are a helpful AI assistant..."
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, width: '100%', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
                    />
                  </div>
                  <button className="btn-primary" onClick={saveSystemPrompt} style={{ marginTop: 8 }}>Save Prompt</button>
                </>
              )}
            </div>

            <div className="admin-section">
              <h3>Current Prompts</h3>
              <div className="kb-list">
                {Object.entries(systemPrompts).map(([m, prompt]) => (
                  <div key={m} className="kb-item">
                    <div className="info">
                      <h4>{m === 'default' ? 'Default (all models)' : m}</h4>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{prompt.substring(0, 200)}{prompt.length > 200 ? '...' : ''}</p>
                    </div>
                    <div className="kb-actions">
                      <button onClick={() => { setEditingPromptModel(m); setEditingPromptText(prompt); }}>Edit</button>
                    </div>
                  </div>
                ))}
                {Object.keys(systemPrompts).length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No system prompts configured yet.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* BRANDING TAB */}
        {activeTab === 'branding' && (
          <>
            <h2>Branding</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              Customize the look and feel for your clients.
            </p>

            <div className="admin-section">
              <div className="form-field">
                <label>Application Name</label>
                <input
                  type="text"
                  value={branding.app_name}
                  onChange={(e) => setBranding({ ...branding, app_name: e.target.value })}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', width: '100%' }}
                />
              </div>
              <div className="form-field">
                <label>Accent Color</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={branding.accent_color}
                    onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                    style={{ width: 48, height: 36, cursor: 'pointer', background: 'none', border: 'none' }}
                  />
                  <input
                    type="text"
                    value={branding.accent_color}
                    onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', width: 120 }}
                  />
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: branding.accent_color }} />
                </div>
              </div>
              <div className="form-field">
                <label>Logo Text (leave empty for default)</label>
                <input
                  type="text"
                  value={branding.logo_text}
                  onChange={(e) => setBranding({ ...branding, logo_text: e.target.value })}
                  placeholder="e.g. Your Company AI"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', width: '100%' }}
                />
              </div>
              <button className="btn-primary" onClick={saveBranding} style={{ marginTop: 12 }}>Save Branding</button>

              <div style={{ marginTop: 32 }}>
                <h3>Preview</h3>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginTop: 12 }}>
                  <h1 style={{ color: branding.accent_color, fontSize: 18, marginBottom: 8 }}>
                    {branding.logo_text || branding.app_name}
                  </h1>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button style={{ background: branding.accent_color, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
                      Primary Button
                    </button>
                    <button style={{ background: 'transparent', color: branding.accent_color, border: `1px solid ${branding.accent_color}`, borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
                      Secondary
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Connector Modal */}
      {selectedConnector && (
        <ConnectorModal
          connector={selectedConnector}
          onClose={() => setSelectedConnector(null)}
          onConnected={loadConnectors}
        />
      )}
    </div>
  );
}
