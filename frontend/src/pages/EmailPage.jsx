import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import EmailPreview from '../components/EmailPreview';
import { useToast } from '../components/Toast';

const API_BASE = 'http://localhost:3002';

export default function EmailPage({ onGoChat, onGoCalendar, onGoAdmin, user, onLogout, theme, onToggleTheme }) {
  const [conversations, setConversations] = useState([]);
  const [signatureData, setSignatureData] = useState({
    name: '', title: '', company: '', phone: '', website: '',
    linkedin: '', twitter: '',
    show_calendar_link: false, show_hubspot_link: false,
    show_linkedin: false, show_twitter: false,
    accent_color: '#7c83ff',
  });
  const [userSettings, setUserSettings] = useState({});
  const [signatureSaving, setSignatureSaving] = useState(false);
  const toast = useToast();

  const loadConversations = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/chat/conversations`);
      const data = await resp.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
  }, []);

  const loadUserSettings = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/user/settings`);
      const data = await resp.json();
      setUserSettings(data);
      if (data.email_signature) {
        setSignatureData(prev => ({ ...prev, ...data.email_signature }));
      }
      if (!data.email_signature?.name && user?.username) {
        setSignatureData(prev => ({ ...prev, name: prev.name || user.username }));
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    loadConversations();
    loadUserSettings();
  }, [loadConversations, loadUserSettings]);

  const saveSignature = async () => {
    setSignatureSaving(true);
    try {
      await fetch(`${API_BASE}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userSettings,
          email_signature: signatureData,
        }),
      });
      toast.success('Signature saved');
    } catch {
      toast.error('Failed to save signature');
    }
    setSignatureSaving(false);
  };

  return (
    <div className="app-layout">
      <Sidebar
        conversations={conversations}
        activeId={null}
        onSelect={() => onGoChat()}
        onNewChat={onGoChat}
        onGoAdmin={onGoAdmin}
        onGoCalendar={onGoCalendar}
        onGoEmail={null}
        onRefresh={loadConversations}
        user={user}
        onLogout={onLogout}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <div className="main-area">
        <EmailPreview
          signatureData={signatureData}
          user={user}
          userSettings={userSettings}
          onSignatureChange={setSignatureData}
          onSignatureSave={saveSignature}
          signatureSaving={signatureSaving}
        />
      </div>
    </div>
  );
}
