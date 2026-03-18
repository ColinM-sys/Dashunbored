import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useToast } from './Toast';

const SCHEDULE_REGEX = /<!-- SCHEDULE_MEETING (\{.*?\}) -->/s;

function ScheduleCard({ data, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false);

  const startDate = new Date(data.start_time);
  const endDate = new Date(data.end_time);
  const duration = Math.round((endDate - startDate) / 60000);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(data);
    setConfirming(false);
  };

  return (
    <div className="schedule-card">
      <div className="schedule-card-header">Schedule Meeting</div>
      <div className="schedule-card-body">
        <div className="schedule-card-row">
          <span className="schedule-card-label">Title</span>
          <span>{data.title}</span>
        </div>
        <div className="schedule-card-row">
          <span className="schedule-card-label">Date</span>
          <span>{startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="schedule-card-row">
          <span className="schedule-card-label">Time</span>
          <span>{startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({duration} min)</span>
        </div>
        {data.invitees?.length > 0 && (
          <div className="schedule-card-row">
            <span className="schedule-card-label">Invitees</span>
            <span>{data.invitees.join(', ')}</span>
          </div>
        )}
        {data.create_zoom && (
          <div className="schedule-card-row">
            <span className="schedule-card-label">Zoom</span>
            <span>Will be created automatically</span>
          </div>
        )}
      </div>
      <div className="schedule-card-actions">
        <button className="schedule-card-cancel" onClick={onCancel} disabled={confirming}>Cancel</button>
        <button className="schedule-card-confirm" onClick={handleConfirm} disabled={confirming}>
          {confirming ? 'Scheduling...' : 'Confirm & Send'}
        </button>
      </div>
    </div>
  );
}

export default function ChatMessage({ role, content, isStreaming, onRegenerate, onEdit, messageId, onScheduleMeeting }) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [cardDismissed, setCardDismissed] = useState(false);
  const toast = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const handleEdit = () => {
    if (onEdit && editText.trim() !== content) {
      onEdit(messageId, editText.trim());
    }
    setEditing(false);
  };

  // Parse SCHEDULE_MEETING blocks from assistant messages
  const scheduleMatch = role === 'assistant' && !isStreaming ? SCHEDULE_REGEX.exec(content) : null;
  let scheduleData = null;
  let textBeforeCard = content;
  let textAfterCard = '';

  if (scheduleMatch) {
    try {
      scheduleData = JSON.parse(scheduleMatch[1]);
      const matchIndex = scheduleMatch.index;
      textBeforeCard = content.substring(0, matchIndex).trim();
      textAfterCard = content.substring(matchIndex + scheduleMatch[0].length).trim();
    } catch {
      scheduleData = null;
    }
  }

  return (
    <div
      className="message"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`message-avatar ${role}`}>
        {role === 'user' ? 'U' : 'AI'}
      </div>
      <div className="message-body">
        {editing ? (
          <div className="message-edit">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="message-edit-actions">
              <button className="btn-primary" onClick={handleEdit}>Save & Send</button>
              <button onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={`message-content ${isStreaming ? 'streaming' : ''}`}>
            {scheduleData && !cardDismissed ? (
              <>
                {textBeforeCard && <ReactMarkdown>{textBeforeCard}</ReactMarkdown>}
                <ScheduleCard
                  data={scheduleData}
                  onConfirm={async (data) => {
                    if (onScheduleMeeting) {
                      await onScheduleMeeting(data);
                    }
                    setCardDismissed(true);
                  }}
                  onCancel={() => setCardDismissed(true)}
                />
                {textAfterCard && <ReactMarkdown>{textAfterCard}</ReactMarkdown>}
              </>
            ) : (
              <ReactMarkdown>{scheduleData ? (textBeforeCard + '\n\n' + textAfterCard).trim() || content : content}</ReactMarkdown>
            )}
          </div>
        )}

        {showActions && !isStreaming && !editing && (
          <div className="message-actions">
            <button onClick={handleCopy} title="Copy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            {role === 'user' && onEdit && (
              <button onClick={() => { setEditText(content); setEditing(true); }} title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            )}
            {role === 'assistant' && onRegenerate && (
              <button onClick={onRegenerate} title="Regenerate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
