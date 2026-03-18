import React from 'react';

export default function ConnectorCard({ connector }) {
  return (
    <div className="connector-card">
      <div className="name">{connector.display_name}</div>
      <div className="desc">{connector.description}</div>
      <span className={`status ${connector.is_connected ? 'connected' : 'disconnected'}`}>
        {connector.is_connected ? 'Connected' : 'Not Connected'}
      </span>
    </div>
  );
}
