import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3002';

export default function ModelSelector({ value, onChange }) {
  const [models, setModels] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/models`)
      .then(r => r.json())
      .then(data => setModels(data.models || []))
      .catch(() => {});
  }, []);

  return (
    <select className="model-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {models.map((m) => (
        <option key={m.name} value={m.name}>{m.name}</option>
      ))}
      {models.length === 0 && <option>Loading models...</option>}
    </select>
  );
}
