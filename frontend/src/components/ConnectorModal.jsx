import React, { useState } from 'react';
import { useToast } from './Toast';

const API_BASE = 'http://localhost:3002';

export default function ConnectorModal({ connector, onClose, onConnected }) {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const toast = useToast();

  if (!connector) return null;

  const schema = connector.config_schema || {};

  const handleConnect = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/connectors/${connector.type}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: connector.display_name, config }),
      });
      if (resp.ok) {
        toast.success(`Connected to ${connector.display_name}!`);
        onConnected();
      } else {
        const data = await resp.json();
        toast.error(data.detail || 'Connection failed');
      }
    } catch {
      toast.error('Connection failed');
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (!connector.config_id) return;
    try {
      await fetch(`${API_BASE}/api/connectors/${connector.config_id}`, { method: 'DELETE' });
      toast.success(`Disconnected from ${connector.display_name}`);
      onConnected();
      onClose();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleSync = async () => {
    if (!connector.config_id) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const resp = await fetch(`${API_BASE}/api/connectors/${connector.config_id}/sync`, {
        method: 'POST',
      });
      const data = await resp.json();
      if (resp.ok) {
        setSyncResult(data);
        toast.success(data.message);
        onConnected();
      } else {
        toast.error(data.detail || 'Sync failed');
      }
    } catch {
      toast.error('Sync failed - check server logs');
    }
    setSyncing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{connector.is_connected ? 'Configure' : 'Connect'} {connector.display_name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Connection Form */}
          {!connector.is_connected && (
            <>
              {Object.entries(schema).map(([key, field]) => (
                <div key={key} className="form-field">
                  <label>{field.label}{field.required && ' *'}</label>
                  {field.type === 'select' ? (
                    <select
                      value={config[key] || field.default || ''}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={config[key] || ''}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      placeholder={field.placeholder || field.label}
                      rows={4}
                    />
                  ) : (
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={config[key] || field.default || ''}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      placeholder={field.placeholder || field.label}
                    />
                  )}
                  {field.help && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{field.help}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Connected State - Show sync options */}
          {connector.is_connected && (
            <div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#4ade80', fontSize: 20 }}>●</span>
                  <span style={{ fontWeight: 600 }}>Connected</span>
                </div>
                {connector.last_sync && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Last synced: {new Date(connector.last_sync).toLocaleString()}
                  </p>
                )}
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Click "Sync Now" to fetch the latest data and index it into a knowledge base.
                The AI will then be able to search and answer questions about your {connector.display_name} data.
              </p>

              {syncing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
                  <div className="spinner" style={{ width: 24, height: 24 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Syncing...</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fetching and indexing data. This may take a minute.</div>
                  </div>
                </div>
              )}

              {syncResult && (
                <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>Sync Complete!</div>
                  <div style={{ fontSize: 13 }}>
                    <div>Documents indexed: <strong>{syncResult.documents_synced}</strong></div>
                    <div>Chunks created: <strong>{syncResult.chunks_created}</strong></div>
                    {syncResult.knowledge_base_name && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        Knowledge base: "{syncResult.knowledge_base_name}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {connector.is_connected ? (
            <>
              <button className="btn-danger" onClick={handleDisconnect}>Disconnect</button>
              <button className="btn-primary" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={handleConnect} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
