import React, { useState } from 'react';

const API_BASE = 'http://localhost:3002';

export default function KnowledgeBaseSelect({ knowledgeBases, selectedIds, onToggle }) {
  return (
    <select
      className="kb-select"
      multiple
      value={selectedIds.map(String)}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
        onToggle(selected);
      }}
      style={{ minWidth: 150, height: 32 }}
    >
      <option value="" disabled>Knowledge Base</option>
      {knowledgeBases.map((kb) => (
        <option key={kb.id} value={kb.id}>{kb.name} ({kb.total_chunks} chunks)</option>
      ))}
    </select>
  );
}

export function KnowledgeBaseAdmin({ knowledgeBases, onRefresh }) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [uploadKbId, setUploadKbId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const createKB = async () => {
    if (!newName.trim()) return;
    await fetch(`${API_BASE}/api/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    setNewName('');
    setNewDesc('');
    onRefresh();
  };

  const deleteKB = async (id) => {
    await fetch(`${API_BASE}/api/knowledge/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const uploadFile = async (kbId, file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`${API_BASE}/api/knowledge/${kbId}/upload`, {
      method: 'POST',
      body: formData,
    });
    setUploading(false);
    onRefresh();
  };

  const handleDrop = (e, kbId) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(kbId, files[0]);
    }
  };

  return (
    <div className="admin-section">
      <h3>Knowledge Bases</h3>

      <div className="form-row">
        <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        <button className="btn-primary" onClick={createKB}>Create</button>
      </div>

      <div className="kb-list">
        {knowledgeBases.map((kb) => (
          <div key={kb.id} className="kb-item">
            <div className="info">
              <h4>{kb.name}</h4>
              <p>{kb.document_count} documents | {kb.total_chunks} chunks</p>
            </div>
            <div className="kb-actions">
              <label className="btn-primary" style={{ cursor: 'pointer' }}>
                {uploading ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files[0]) uploadFile(kb.id, e.target.files[0]);
                  }}
                />
              </label>
              <button className="delete" onClick={() => deleteKB(kb.id)}>Delete</button>
            </div>
          </div>
        ))}
        {knowledgeBases.length === 0 && (
          <p style={{ color: '#606080', fontSize: 13 }}>No knowledge bases yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
