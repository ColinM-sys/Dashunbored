import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ModelSelector from '../components/ModelSelector';
import useWebSocket from '../hooks/useWebSocket';
import { useToast } from '../components/Toast';

const API_BASE = 'http://localhost:3002';

const APP_EMOJIS = {
  // Creative
  adobe_cc: '🅰', figma: '🎨', frameio: '🎬', behance: '✦',
  stable_diffusion: '🖼', unsplash: '📷', notion: '📓',
  // Storage
  email: '✉️', dropbox: '📦', google_drive: '🔵', sharepoint: '🟦',
  slack: '💬', teams: '👥', database: '🗄️', web_scraper: '🌐',
  hubspot: '🟠', aws_s3: '🪣', azure_blob: '🔷',
};

const APP_CATEGORIES = ['creative', 'storage', 'communication', 'business'];
const CATEGORY_LABELS = {
  creative: '🎨 Creative Tools',
  storage: '☁️ Storage & Files',
  communication: '💬 Communication',
  business: '🏢 Business',
};

const FILE_ICONS = {
  pdf: '\ud83d\udcc4', docx: '\ud83d\udcc4', doc: '\ud83d\udcc4', txt: '\ud83d\udcdd',
  csv: '\ud83d\udcca', json: '\ud83d\udcca', md: '\ud83d\udcdd', html: '\ud83c\udf10',
  default: '\ud83d\udcc1',
};

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']);
const DOC_EXTS = new Set(['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'json', 'jsonl', 'html', 'htm', 'xlsx', 'pptx']);

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

export default function Chat({ onGoAdmin, onGoCalendar, onGoEmail, onGoAgent, onGoStudio, onGoDiffusion, user, onLogout, theme, onToggleTheme }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKBs, setSelectedKBs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Homepage widget data
  const [history, setHistory] = useState([]);
  const [images, setImages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [emailPreview, setEmailPreview] = useState(null);
  const [docSources, setDocSources] = useState([]);
  const [docFilter, setDocFilter] = useState('all');
  const [imgSources, setImgSources] = useState([]);
  const [imgFilter, setImgFilter] = useState('all');
  const [weekOffset, setWeekOffset] = useState(0); // slider offset for calendar days
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailReplyText, setEmailReplyText] = useState('');
  const [emailReplySending, setEmailReplySending] = useState(false);
  const [emailDrafting, setEmailDrafting] = useState(false);
  const [showAllEmails, setShowAllEmails] = useState(false);
  const [allEmails, setAllEmails] = useState(null);
  const [allEmailsLoading, setAllEmailsLoading] = useState(false);
  const [homeDragOver, setHomeDragOver] = useState(false);
  const [homeUploading, setHomeUploading] = useState(false);
  const [pinnedApps, setPinnedApps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pinnedApps') || '["email","dropbox","google_drive","web_scraper"]'); }
    catch { return ['email', 'dropbox', 'google_drive', 'web_scraper']; }
  });
  const [allApps, setAllApps] = useState([]);
  const [showAppPicker, setShowAppPicker] = useState(false);
  // Web search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // Team chat
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [teamMessages, setTeamMessages] = useState([]);
  const [teamChatInput, setTeamChatInput] = useState('');
  // Org selector for scheduling
  const [userOrgs, setUserOrgs] = useState([]);
  const [weekEvents, setWeekEvents] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(() => {
    return parseInt(localStorage.getItem('activeOrgId') || '0') || null;
  });

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const { sendMessage, stopStreaming, isStreaming } = useWebSocket();
  const toast = useToast();

  const loadConversations = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/chat/conversations`);
      const data = await resp.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
  }, []);

  const loadMessages = useCallback(async (convoId) => {
    const resp = await fetch(`${API_BASE}/api/chat/conversations/${convoId}/messages`);
    const data = await resp.json();
    setMessages(data.messages || []);
  }, []);

  const loadKBs = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/knowledge`);
      const data = await resp.json();
      setKnowledgeBases(data.knowledge_bases || []);
    } catch { /* ignore */ }
  }, []);

  const loadUserOrgs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const resp = await fetch(`${API_BASE}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const orgs = data.organizations || [];
        setUserOrgs(orgs);
        // Auto-select first org if none selected
        if (!activeOrgId && orgs.length > 0) {
          setActiveOrgId(orgs[0].id);
        }
      }
    } catch { /* ignore */ }
  }, [activeOrgId]);

  const loadWeekEvents = useCallback(async (orgId) => {
    if (!orgId) { setWeekEvents([]); return; }
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/orgs/${orgId}/events/week`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setWeekEvents(data.events || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadHomepageData = useCallback(async () => {
    try {
      const [histResp, imgResp, docResp, emailResp, appsResp] = await Promise.all([
        fetch(`${API_BASE}/api/homepage/history`),
        fetch(`${API_BASE}/api/homepage/images`),
        fetch(`${API_BASE}/api/homepage/documents`),
        fetch(`${API_BASE}/api/connectors/email/preview`),
        fetch(`${API_BASE}/api/homepage/apps`),
      ]);
      const [histData, imgData, docData, emailData, appsData] = await Promise.all([
        histResp.json(), imgResp.json(), docResp.json(), emailResp.json(), appsResp.json(),
      ]);
      setHistory(histData.history || []);
      setImages(imgData.images || []);
      setImgSources(imgData.sources || []);
      setDocuments(docData.documents || []);
      setDocSources(docData.sources || []);
      setEmailPreview(emailData);
      setAllApps(appsData.apps || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadConversations(), loadKBs(), loadHomepageData(), loadUserOrgs()]).then(() => setLoading(false));
  }, [loadConversations, loadKBs, loadHomepageData]);

  useEffect(() => {
    if (activeConvo) loadMessages(activeConvo);
    else setMessages([]);
  }, [activeConvo, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    localStorage.setItem('pinnedApps', JSON.stringify(pinnedApps));
  }, [pinnedApps]);

  useEffect(() => {
    if (activeOrgId) {
      localStorage.setItem('activeOrgId', String(activeOrgId));
      loadWeekEvents(activeOrgId);
    }
  }, [activeOrgId, loadWeekEvents]);

  const handleNewChat = async () => {
    const resp = await fetch(`${API_BASE}/api/chat/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, title: 'New Chat' }),
    });
    const data = await resp.json();
    setActiveConvo(data.id);
    setMessages([]);
    loadConversations();
  };

  const createConvoAndSend = async (text) => {
    const resp = await fetch(`${API_BASE}/api/chat/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, title: 'New Chat' }),
    });
    const data = await resp.json();
    setActiveConvo(data.id);
    sendChat(data.id, text);
    loadConversations();
  };

  const sendChat = (convoId, text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setStreamingContent('');
    sendMessage(
      convoId, text, selectedKBs, null,
      (token) => setStreamingContent(prev => prev + token),
      () => {
        setStreamingContent(prev => {
          if (prev) setMessages(m => [...m, { role: 'assistant', content: prev }]);
          return '';
        });
        loadConversations();
      },
      (err) => {
        setMessages(m => [...m, { role: 'assistant', content: `Error: ${err}` }]);
        setStreamingContent('');
        toast.error(err);
      }
    );
  };

  const handleSend = (text) => {
    if (!activeConvo) createConvoAndSend(text);
    else sendChat(activeConvo, text);
  };

  const handleRegenerate = () => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => {
      const newMsgs = [...prev];
      while (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') newMsgs.pop();
      return newMsgs;
    });
    sendChat(activeConvo, lastUserMsg.content);
  };

  const handleEditMessage = (msgId, newContent) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx >= 0) { setMessages(messages.slice(0, idx)); sendChat(activeConvo, newContent); }
    else handleSend(newContent);
  };

  const handleWebSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await resp.json();
      setSearchResults(data);
    } catch {
      toast.error('Search failed');
    }
    setSearching(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const resp = await fetch(`${API_BASE}/api/homepage/images/upload`, { method: 'POST', body: formData });
      if (resp.ok) {
        toast.success('Image uploaded');
        loadHomepageData();
      }
    } catch {
      toast.error('Upload failed');
    }
    e.target.value = '';
  };

  const handleEmailClick = async (index) => {
    setEmailLoading(true);
    setEmailReplyText('');
    try {
      const resp = await fetch(`${API_BASE}/api/connectors/email/${index}`);
      if (resp.ok) {
        setSelectedEmail(await resp.json());
      } else {
        toast.error('Failed to load email');
      }
    } catch {
      toast.error('Failed to load email');
    }
    setEmailLoading(false);
  };

  const handleEmailDraftReply = () => {
    if (!selectedEmail) return;
    setEmailDrafting(true);
    const senderName = selectedEmail.from?.split('<')[0]?.trim() || 'them';
    const draft = `Hi ${senderName},\n\nThank you for your email. I've reviewed the details and wanted to follow up.\n\n[Your response here]\n\nBest regards`;
    // Simulate AI drafting delay
    setTimeout(() => {
      setEmailReplyText(draft);
      setEmailDrafting(false);
    }, 800);
  };

  const handleEmailSendReply = async () => {
    if (!emailReplyText.trim() || !selectedEmail) return;
    setEmailReplySending(true);
    try {
      const resp = await fetch(`${API_BASE}/api/connectors/email/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedEmail.from,
          subject: `Re: ${selectedEmail.subject}`,
          body: emailReplyText,
        }),
      });
      if (resp.ok) {
        toast.success('Reply sent!');
        setSelectedEmail(null);
        setEmailReplyText('');
      } else {
        toast.error('Failed to send reply');
      }
    } catch {
      toast.error('Failed to send reply');
    }
    setEmailReplySending(false);
  };

  const handleShowAllEmails = async () => {
    setShowAllEmails(true);
    if (allEmails) return; // already loaded
    setAllEmailsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/connectors/email/all`);
      if (resp.ok) {
        setAllEmails(await resp.json());
      } else {
        toast.error('Failed to load emails');
      }
    } catch {
      toast.error('Failed to load emails');
    }
    setAllEmailsLoading(false);
  };

  const handleHomeDrop = async (e) => {
    e.preventDefault();
    setHomeDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = IMAGE_EXTS.has(ext);
    const isDoc = DOC_EXTS.has(ext);

    if (!isImage && !isDoc) {
      toast.info(`Unsupported file type: .${ext}`);
      return;
    }

    setHomeUploading(true);

    // Try to upload to active connector first (for both images and docs)
    try {
      const kbResp = await fetch(`${API_BASE}/api/connectors/active-kb`);
      const kbData = await kbResp.json();

      if (kbData.kb_id) {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${API_BASE}/api/knowledge/${kbData.kb_id}/upload`, { method: 'POST', body: formData });
        if (resp.ok) {
          toast.success(`Uploaded ${file.name} to ${kbData.kb_name}`);
          loadHomepageData();
          loadKBs();
          setHomeUploading(false);
          return;
        }
      }

      // No active connector — fallback to local gallery for images
      if (isImage) {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${API_BASE}/api/homepage/images/upload`, { method: 'POST', body: formData });
        if (resp.ok) { toast.success('Image saved locally'); loadHomepageData(); }
        else toast.error('Image upload failed');
      } else {
        toast.info('No active connector. Connect one in Admin > Connectors first.');
      }
    } catch {
      toast.error('Upload failed');
    }
    setHomeUploading(false);
  };

  const togglePinApp = (appId) => {
    setPinnedApps(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  };

  const handleScheduleMeeting = async (scheduleData) => {
    if (!activeOrgId) {
      toast.error('Select an organization first to schedule meetings.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/orgs/${activeOrgId}/events/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: scheduleData.title,
          start_time: scheduleData.start_time,
          end_time: scheduleData.end_time,
          invitee_emails: scheduleData.invitees || [],
          create_zoom: scheduleData.create_zoom ?? true,
        }),
      });
      if (resp.ok) {
        const result = await resp.json();
        const inviteCount = result.invites_sent || 0;
        let msg = 'Meeting scheduled!';
        if (result.zoom_join_url) msg += ' Zoom link created.';
        if (inviteCount > 0) msg += ` Invite sent to ${inviteCount} recipient${inviteCount > 1 ? 's' : ''}.`;
        toast.success(msg);
      } else {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to schedule meeting');
      }
    } catch {
      toast.error('Failed to schedule meeting');
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>
      </div>
    );
  }

  const showEmptyState = !activeConvo && messages.length === 0;
  const hasEmails = emailPreview?.connected && emailPreview?.emails?.length > 0;
  const pinnedAppData = allApps.filter(a => pinnedApps.includes(a.id));

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        conversations={conversations}
        activeId={activeConvo}
        onSelect={(id) => { setActiveConvo(id); setSidebarOpen(false); }}
        onNewChat={() => { setActiveConvo(null); setMessages([]); setSidebarOpen(false); loadHomepageData(); }}
        onGoAdmin={onGoAdmin}
        onGoCalendar={onGoCalendar}
        onGoEmail={onGoEmail}
        onGoAgent={onGoAgent}
        onGoStudio={onGoStudio}
        onGoDiffusion={onGoDiffusion}
        onRefresh={loadConversations}
        user={user}
        onLogout={onLogout}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isOpen={sidebarOpen}
      />
      <div className="main-area">
        <div className="chat-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>&#9776;</button>
          <ModelSelector value={model} onChange={setModel} />
          <div className="header-right">
            {userOrgs.length > 0 && (
              <select
                className="org-select"
                value={activeOrgId || ''}
                onChange={(e) => setActiveOrgId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">No Organization</option>
                {userOrgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
            {knowledgeBases.length > 0 && (
              <select
                className="kb-select"
                value={selectedKBs.length === knowledgeBases.length && selectedKBs.length > 0 ? 'all' : (selectedKBs[0] || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setSelectedKBs(knowledgeBases.map(kb => kb.id));
                  } else {
                    setSelectedKBs(val ? [parseInt(val)] : []);
                  }
                }}
              >
                <option value="">No Knowledge Base</option>
                <option value="all">All Sources ({knowledgeBases.reduce((s, kb) => s + kb.total_chunks, 0)} chunks)</option>
                {knowledgeBases.map(kb => (
                  <option key={kb.id} value={kb.id}>{kb.name} ({kb.total_chunks} chunks)</option>
                ))}
              </select>
            )}
            {isStreaming && (
              <button className="stop-btn" onClick={stopStreaming}>Stop</button>
            )}
          </div>
        </div>


        {showEmptyState ? (
          <div
            className={`home-screen ${homeDragOver ? 'home-drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setHomeDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHomeDragOver(false); }}
            onDrop={handleHomeDrop}
          >
            {homeDragOver && (
              <div className="home-drop-overlay">
                <div className="home-drop-text">Drop file here</div>
                <div className="home-drop-hint">Images → gallery &nbsp;|&nbsp; Documents → active connector</div>
              </div>
            )}
            {homeUploading && (
              <div className="home-upload-indicator">Uploading...</div>
            )}
            {/* Logo */}
            <div className="home-logo-section">
              <img src="/logo.svg" alt="DashBored" className="empty-logo" />
            </div>

            {/* Calendar Slider - standalone section */}
            <div className="home-week-bar">
                <div className="week-bar-header">
                  <div className="widget-bubble-title" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={onGoCalendar}>
                    Upcoming
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 400, textTransform: 'none' }}>View full calendar &rarr;</span>
                  </div>
                  <div className="week-bar-arrows">
                    <button
                      className="week-arrow-btn"
                      onClick={(e) => { e.stopPropagation(); setWeekOffset(Math.max(0, weekOffset - 4)); }}
                      disabled={weekOffset === 0}
                    >&lsaquo;</button>
                    {weekOffset > 0 && (
                      <button
                        className="week-arrow-btn today-btn"
                        onClick={(e) => { e.stopPropagation(); setWeekOffset(0); }}
                      >Today</button>
                    )}
                    <button
                      className="week-arrow-btn"
                      onClick={(e) => { e.stopPropagation(); setWeekOffset(weekOffset + 4); }}
                      disabled={weekOffset >= 24}
                    >&rsaquo;</button>
                  </div>
                </div>
                <div className="week-slider-grid">
                  {[0, 1, 2, 3].map(i => {
                    const dayIndex = weekOffset + i;
                    const d = new Date();
                    d.setDate(d.getDate() + dayIndex);
                    const isToday = dayIndex === 0;
                    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
                    const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    const dayStr = d.toISOString().split('T')[0];
                    const dayEvents = weekEvents.filter(ev => ev.start_time && ev.start_time.startsWith(dayStr));
                    return (
                      <div key={dayIndex} className={`week-slider-day ${isToday ? 'today' : ''}`} onClick={onGoCalendar}>
                        <div className="week-slider-day-header">
                          <span className="week-slider-day-name">{isToday ? 'Today' : dayName}</span>
                          <span className="week-slider-day-date">{monthDay}</span>
                        </div>
                        <div className="week-slider-events">
                          {dayEvents.length === 0 && (
                            <div className="week-slider-empty">No events</div>
                          )}
                          {dayEvents.slice(0, 5).map((ev, j) => (
                            <div key={j} className="week-slider-event" style={{ borderLeftColor: ev.color || 'var(--accent)' }}>
                              <div className="week-slider-event-time">
                                {new Date(ev.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                              </div>
                              <div className="week-slider-event-title">{ev.title}</div>
                            </div>
                          ))}
                          {dayEvents.length > 5 && (
                            <div className="week-slider-more">+{dayEvents.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>

            {/* Images + Documents panels */}
            <div className="widget-border-frame">
              <div className="widget-row">
                {/* Images Bubble */}
                <div className="widget-bubble">
                  <div className="widget-bubble-title">
                    <select
                      value={imgFilter}
                      onChange={(e) => setImgFilter(e.target.value)}
                      className="doc-filter-select"
                    >
                      <option value="all">All Images</option>
                      {imgSources.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button className="widget-action-btn" onClick={() => imageInputRef.current?.click()}>+</button>
                    <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                  </div>
                  <div className="widget-bubble-content">
                    {(() => {
                      const filtered = images.filter(img => imgFilter === 'all' || img.source_type === imgFilter);
                      if (filtered.length === 0) {
                        return <p className="widget-empty">{images.length > 0 ? 'No images from this source' : 'No images yet'}</p>;
                      }
                      const localImages = filtered.filter(img => img.url);
                      const serviceImages = filtered.filter(img => !img.url);
                      return (
                        <>
                          {localImages.length > 0 && (
                            <div className="image-grid">
                              {localImages.slice(0, 6).map((img) => (
                                <div key={img.filename} className="image-thumb">
                                  <img src={`${API_BASE}${img.url}`} alt={img.filename} />
                                </div>
                              ))}
                            </div>
                          )}
                          {serviceImages.slice(0, 5).map((img, i) => (
                            <div key={i} className="widget-item">
                              <div className="widget-item-title">{getFileIcon(img.filename)} {img.filename}</div>
                              <div className="widget-item-sub">{img.knowledge_base || img.source_type}</div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Documents Bubble */}
                <div className="widget-bubble">
                  <div className="widget-bubble-title">
                    <select
                      value={docFilter}
                      onChange={(e) => setDocFilter(e.target.value)}
                      className="doc-filter-select"
                    >
                      <option value="all">All Documents</option>
                      {docSources.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="widget-bubble-content">
                    {documents.length === 0 ? (
                      <p className="widget-empty">No documents yet</p>
                    ) : (
                      documents
                        .filter(d => docFilter === 'all' || d.source_type === docFilter)
                        .slice(0, 5)
                        .map((d) => (
                          <div key={d.id} className="widget-item">
                            <div className="widget-item-title">{getFileIcon(d.filename)} {d.filename}</div>
                            <div className="widget-item-sub">{d.knowledge_base} &middot; {d.chunk_count} chunks</div>
                          </div>
                        ))
                    )}
                    {documents.filter(d => docFilter === 'all' || d.source_type === docFilter).length === 0 && documents.length > 0 && (
                      <p className="widget-empty">No documents from this source</p>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Email Preview - standalone centered section */}
            <div className="chat-email-widget">
              <div className="chat-email-header">
                <div className="chat-email-tabs">
                  <span
                    className={`chat-email-tab ${!showAllEmails ? 'active' : ''}`}
                    onClick={() => setShowAllEmails(false)}
                  >Recent Emails</span>
                  <span className="chat-email-tab-divider">/</span>
                  <span
                    className={`chat-email-tab ${showAllEmails ? 'active' : ''}`}
                    onClick={handleShowAllEmails}
                  >All Emails</span>
                </div>
                {hasEmails && (
                  <span className="chat-email-account">{emailPreview.provider} &mdash; {emailPreview.account}</span>
                )}
              </div>
              {showAllEmails ? (
                allEmailsLoading ? (
                  <div className="widget-empty"><div className="spinner" style={{ margin: '20px auto' }} /></div>
                ) : allEmails?.emails?.length > 0 ? (
                  <div className="chat-email-inbox">
                    {allEmails.emails.map((em, i) => (
                      <div key={i} className="chat-email-inbox-row clickable" onClick={() => handleEmailClick(i)}>
                        <div className="chat-email-inbox-left">
                          <span className="chat-email-from">{em.from.split('<')[0].trim()}</span>
                          <span className="chat-email-subject">{em.subject}</span>
                          <span className="chat-email-snippet">{em.preview}</span>
                        </div>
                        <span className="chat-email-date">
                          {em.date ? new Date(em.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="widget-empty">No emails found.</p>
                )
              ) : hasEmails ? (
                <div className="chat-email-list">
                  {emailPreview.emails.slice(0, 10).map((em, i) => (
                    <div key={i} className="chat-email-row clickable" onClick={() => handleEmailClick(i)}>
                      <div className="chat-email-row-top">
                        <span className="chat-email-from">{em.from.split('<')[0].trim()}</span>
                        <span className="chat-email-date">
                          {em.date ? new Date(em.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <div className="chat-email-subject">{em.subject}</div>
                      <div className="chat-email-snippet">{em.preview}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="widget-empty">No email connected. Go to Admin &gt; Connectors to set up Gmail or Outlook.</p>
              )}
            </div>

            {/* App Squares */}
            <div className="app-squares-section">
              <div className="app-squares-header">
                <span className="app-squares-title">APPS/API INPUTS</span>
              </div>
              {APP_CATEGORIES.map(cat => {
                const catApps = allApps.filter(a => a.category === cat);
                if (!catApps.length) return null;
                return (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 2 }}>
                      {CATEGORY_LABELS[cat] || cat.toUpperCase()}
                    </div>
                    <div className="app-squares-grid">
                      {catApps.map((app) => (
                        <div
                          key={app.id}
                          className="app-square"
                          onClick={() => {
                            if (app.id === 'stable_diffusion' && onGoDiffusion) onGoDiffusion();
                            else if (app.id === 'email' && onGoEmail) onGoEmail();
                            else onGoAdmin && onGoAdmin();
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="app-square-emoji">{APP_EMOJIS[app.id] || app.emoji}</div>
                          <div className="app-square-name">{app.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((m, i) => (
              <ChatMessage
                key={m.id || i}
                role={m.role}
                content={m.content}
                messageId={m.id}
                onRegenerate={m.role === 'assistant' && i === messages.length - 1 ? handleRegenerate : null}
                onEdit={m.role === 'user' ? handleEditMessage : null}
                onScheduleMeeting={handleScheduleMeeting}
              />
            ))}
            {streamingContent && (
              <ChatMessage role="assistant" content={streamingContent} isStreaming={true} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          activeKbId={selectedKBs[0] || null}
          onFileUpload={loadKBs}
        />

        {/* Email Modal */}
        {selectedEmail && (
          <div className="modal-overlay" onClick={() => { setSelectedEmail(null); setEmailReplyText(''); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <h3>{selectedEmail.subject}</h3>
                <button className="modal-close" onClick={() => { setSelectedEmail(null); setEmailReplyText(''); }}>&times;</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                  <div><strong>From:</strong> {selectedEmail.from}</div>
                  <div><strong>To:</strong> {selectedEmail.to}</div>
                  <div><strong>Date:</strong> {selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : ''}</div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {selectedEmail.body}
                </div>

                {/* Reply Section */}
                <div className="email-reply-section">
                  <div className="email-reply-label">Reply</div>
                  <textarea
                    className="email-reply-textarea"
                    placeholder="Type your reply..."
                    value={emailReplyText}
                    onChange={(e) => setEmailReplyText(e.target.value)}
                  />
                  <div className="email-reply-actions">
                    <button
                      className="btn-draft"
                      onClick={handleEmailDraftReply}
                      disabled={emailDrafting}
                    >
                      {emailDrafting ? 'Drafting...' : 'AI Draft Reply'}
                    </button>
                    <button
                      className="btn-send-reply"
                      onClick={handleEmailSendReply}
                      disabled={!emailReplyText.trim() || emailReplySending}
                    >
                      {emailReplySending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {emailLoading && (
          <div className="modal-overlay">
            <div className="spinner" />
          </div>
        )}

        {/* Team Chat Bubble */}
        <button
          className={`team-chat-fab ${showTeamChat ? 'active' : ''}`}
          onClick={() => setShowTeamChat(!showTeamChat)}
          title="Team Chat"
        >
          {showTeamChat ? '\u2715' : '\ud83d\udcac'}
        </button>
        {showTeamChat && (
          <div className="team-chat-panel">
            <div className="team-chat-header">
              <span className="team-chat-title">Team Chat</span>
              <span className="team-chat-status">{userOrgs[0]?.name || 'Organization'}</span>
            </div>
            <div className="team-chat-messages">
              {teamMessages.map((msg, i) => (
                <div key={i} className={`team-msg ${msg.user === (user?.username || 'admin') ? 'self' : ''}`}>
                  <div className="team-msg-meta">
                    <span className="team-msg-user">{msg.user}</span>
                    <span className="team-msg-time">{msg.time}</span>
                  </div>
                  <div className="team-msg-text">{msg.text}</div>
                </div>
              ))}
            </div>
            <div className="team-chat-input">
              <input
                type="text"
                placeholder="Message your team..."
                value={teamChatInput}
                onChange={(e) => setTeamChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && teamChatInput.trim()) {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                    setTeamMessages(prev => [...prev, { user: user?.username || 'admin', text: teamChatInput.trim(), time: timeStr }]);
                    setTeamChatInput('');
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
