import React, { useState, useRef, useEffect } from 'react';
import { useToast } from './Toast';

const API_BASE = 'http://localhost:3002';

export default function ChatInput({ onSend, disabled, onFileUpload, activeKbId }) {
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFile = async (file) => {
    if (!activeKbId) {
      toast.info('Select a Knowledge Base first to upload files');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const resp = await fetch(`${API_BASE}/api/knowledge/${activeKbId}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (resp.ok) {
        toast.success(`Uploaded ${file.name}`);
        if (onFileUpload) onFileUpload();
      } else {
        toast.error('Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="input-area">
      <div
        className={`input-wrapper ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <button
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          disabled={uploading}
        >
          {uploading ? '...' : '+'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={dragOver ? 'Drop file here...' : 'Send a message...'}
          rows={1}
          disabled={disabled}
        />
        <button className="send-btn" onClick={handleSubmit} disabled={disabled || !text.trim()}>
          &#x27A4;
        </button>
      </div>
    </div>
  );
}
