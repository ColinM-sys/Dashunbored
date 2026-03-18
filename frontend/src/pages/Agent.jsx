import React, { useState, useRef, useEffect } from 'react';

const API_BASE = 'http://localhost:3002';

const QUICK_PROMPTS = [
  {
    label: 'Shot list from brief',
    category: 'Photography',
    prompt: 'Search my asset library for the client brief, any Lightroom album metadata, and past campaign references synced from Adobe CC. Then build a complete shoot-day shot list: each shot numbered, subject/scene description, camera angle, lens recommendation (focal length + aperture), lighting setup (key light position, fill ratio, background treatment), and one sentence of on-set art direction. Format it as a table I can print and hand to my team.',
  },
  {
    label: 'Lightroom develop settings',
    category: 'Photography',
    prompt: 'Search my assets for the client brief, any CC Library color swatches or brand palette synced from Adobe Creative Cloud, and reference image notes. Then write a complete Lightroom Develop panel direction for this gallery: target white balance temp/tint range, Exposure and Contrast targets, how to treat highlights and shadows (lifted? crushed?), Tone Curve style, HSL targets for skin tones and key background colors (with actual slider values), Color Grading split-tone approach, and export presets for web (sRGB, 2000px long edge) and print (AdobeRGB, full res).',
  },
  {
    label: 'Figma component audit',
    category: 'Design',
    prompt: 'Search my asset library for all Figma files and components synced from Figma, plus any brand guidelines or design system docs. Then produce a component audit: list every component by name, flag any that are missing descriptions, identify naming inconsistencies, highlight any color or text styles that do not match the brand tokens, and give me a prioritized cleanup checklist I can work through in Figma before the next dev handoff.',
  },
  {
    label: 'Premiere sequence plan',
    category: 'Video',
    prompt: 'Search my asset library for any Frame.io project data, review comments, and creative brief or script notes. Then give me a complete Adobe Premiere Pro setup plan for this project: sequence preset (resolution, frame rate, codec), bin and folder naming structure, color management pipeline (which log profile, which LUT to apply as an adjustment layer, Lumetri Color scope targets), Essential Sound panel targets for dialogue and music, and a cut checklist from ingesting the Frame.io footage to delivering the final export.',
  },
  {
    label: 'CC Library mood board',
    category: 'Design',
    prompt: 'Search my asset library for any Adobe CC Library data (colors, character styles, graphics) and the client brief. Then generate a complete mood board brief I can build in Figma using those library assets: the exact CC Library color swatches to use and where, which character styles map to headline/body/caption roles, 5 specific image types to source from Adobe Stock with exact search terms, typography pairing recommendation using Adobe Fonts (give me the actual font names), and 3 campaign or photographer references with a one-sentence reason each fits this project.',
  },
  {
    label: 'Frame.io review response',
    category: 'Video',
    prompt: 'Search my asset library for all Frame.io review comments across the current project. Then organize the feedback by clip, group similar notes together, flag any conflicting requests from different reviewers, and produce a revision action plan: for each note, say which clip it is on, what the reviewer asked for, what the Premiere Pro or After Effects action is to fix it (specific panel and setting), and whether it is a quick fix (under 5 min) or a structural change. Also flag any comments that need a client decision before I proceed.',
  },
];

function ScoreBar({ score }) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 30, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

function ScoreDisplay({ result, onReset }) {
  const overallColor = result.overall_score >= 75 ? '#16a34a' : result.overall_score >= 50 ? '#d97706' : '#dc2626';
  const categories = result.scores ? Object.entries(result.scores) : [];

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Overall score */}
      <div style={{ textAlign: 'center', marginBottom: 24, padding: '24px', background: 'var(--bg-secondary)', borderRadius: 12 }}>
        <div style={{ fontSize: 64, fontWeight: 900, color: overallColor, lineHeight: 1 }}>{result.overall_score}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>out of 100</div>
        {result.verdict && <p style={{ margin: '12px 0 0', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>{result.verdict}</p>}
        {result.best_platform && <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 20, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>Best for: {result.best_platform}</div>}
      </div>

      {/* Category scores */}
      {categories.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Breakdown</p>
          {categories.map(([key, cat]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cat.label}</span>
              </div>
              <ScoreBar score={cat.score} />
              {cat.note && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{cat.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Strengths */}
      {result.strengths?.length > 0 && (
        <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(22,163,74,0.06)', borderRadius: 8, borderLeft: '3px solid #16a34a' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Strengths</p>
          {result.strengths.map((s, i) => <p key={i} style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-primary)' }}>• {s}</p>)}
        </div>
      )}

      {/* Improvements */}
      {result.improvements?.length > 0 && (
        <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(220,38,38,0.06)', borderRadius: 8, borderLeft: '3px solid #dc2626' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Improvements</p>
          {result.improvements.map((s, i) => <p key={i} style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-primary)' }}>• {s}</p>)}
        </div>
      )}

      {/* Caption tip */}
      {result.caption_tip && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(124,58,237,0.06)', borderRadius: 8, borderLeft: '3px solid #7c3aed' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caption Tip</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>{result.caption_tip}</p>
        </div>
      )}

      <button onClick={onReset} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14 }}>
        Score Another Photo
      </button>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

export default function AgentPage({ user, onGoChat, onGoCalendar, onGoAdmin, onLogout, theme, onToggleTheme }) {
  const [prompt, setPrompt] = useState('');
  const [taskName, setTaskName] = useState('');
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'score'
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('user_api_key') || '');
  const [showKeyBanner, setShowKeyBanner] = useState(false);
  const [scoreImage, setScoreImage] = useState(null);
  const [scorePreview, setScorePreview] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreError, setScoreError] = useState(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const fetchTasks = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/agent/tasks`);
      const data = await r.json();
      setTasks(data);
    } catch {}
  };

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setScoreImage(file);
    setScoreResult(null);
    setScoreError(null);
    const reader = new FileReader();
    reader.onload = (e) => setScorePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleImageFile(e.dataTransfer.files[0]);
  };

  const submitScore = async () => {
    if (!scoreImage || scoring) return;
    setScoring(true);
    setScoreResult(null);
    setScoreError(null);
    const form = new FormData();
    form.append('file', scoreImage);
    try {
      const scoreHeaders = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      if (userApiKey) scoreHeaders['X-User-API-Key'] = userApiKey;
      const r = await fetch(`${API_BASE}/api/agent/score-image`, {
        method: 'POST',
        headers: scoreHeaders,
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Score failed');
      setScoreResult(data);
    } catch (e) {
      setScoreError(e.message);
    }
    setScoring(false);
  };

  const runAgent = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setEvents([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const agentHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
      if (userApiKey) agentHeaders['X-User-API-Key'] = userApiKey;
      const resp = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: agentHeaders,
        body: JSON.stringify({ prompt: prompt.trim(), task_name: taskName.trim() || 'Creative Task' }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json();
        setEvents([{ type: 'error', message: err.detail || 'Agent error' }]);
        setRunning(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              setEvents(prev => [...prev, event]);
            } catch {}
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setEvents(prev => [...prev, { type: 'error', message: e.message }]);
      }
    }

    setRunning(false);
    fetchTasks();
  };

  const stopAgent = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const renderEvent = (ev, i) => {
    switch (ev.type) {
      case 'turn':
        return <div key={i} className="agent-turn-badge">Turn {ev.turn}</div>;
      case 'text':
        return (
          <div key={i} className={`agent-text ${ev.text.includes('## Creative Output') ? 'agent-output-highlight' : ''}`}>
            <pre>{ev.text}</pre>
          </div>
        );
      case 'tool_call':
        return (
          <div key={i} className="agent-tool-call">
            <span className="agent-tool-icon">⚙</span>
            <strong>{ev.tool}</strong>
            <span className="agent-tool-input">{JSON.stringify(ev.input)}</span>
          </div>
        );
      case 'tool_result':
        return (
          <div key={i} className="agent-tool-result">
            <span className="agent-tool-icon">↩</span>
            <span>{ev.result}</span>
          </div>
        );
      case 'done':
        return <div key={i} className="agent-done">Agent finished</div>;
      case 'error':
        return <div key={i} className="agent-error">Error: {ev.message}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <div className="sidebar open">
        <div className="sidebar-header">
          <span className="sidebar-db-badge" onClick={onGoChat} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>DU</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>Creative Agent</span>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>Quick prompts</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {['Photography', 'Design', 'Video'].map(cat => (
            <div key={cat}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 12px 4px', margin: 0 }}>{cat}</p>
              {QUICK_PROMPTS.filter(qp => qp.category === cat).map((qp, i) => (
                <button
                  key={i}
                  className="chat-item"
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6, padding: '8px 12px', marginBottom: 2 }}
                  onClick={() => { setPrompt(qp.prompt); setTaskName(qp.label); setActiveTab('agent'); }}
                >
                  <span className="chat-item-title">{qp.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Launch</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { label: 'Lightroom', url: 'https://lightroom.adobe.com' },
              { label: 'Photoshop', url: 'https://photoshop.adobe.com' },
              { label: 'Illustrator', url: 'https://illustrator.adobe.com' },
              { label: 'Premiere', url: 'https://creativecloud.adobe.com/apps/all/desktop' },
              { label: 'After Effects', url: 'https://creativecloud.adobe.com/apps/all/desktop' },
              { label: 'Adobe Fonts', url: 'https://fonts.adobe.com' },
              { label: 'Adobe Color', url: 'https://color.adobe.com' },
              { label: 'Adobe Stock', url: 'https://stock.adobe.com' },
              { label: 'Behance', url: 'https://www.behance.net' },
              { label: 'Frame.io', url: 'https://app.frame.io' },
              { label: 'Figma', url: 'https://figma.com' },
              { label: 'CC Libraries', url: 'https://creativecloud.adobe.com/libraries' },
            ].map(app => (
              <a
                key={app.label}
                href={app.url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', padding: '5px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', textDecoration: 'none', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
              >
                {app.label}
              </a>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button onClick={onToggleTheme}>{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
          {onGoChat && <button onClick={onGoChat}>Chat</button>}
          {onGoCalendar && <button onClick={onGoCalendar}>Calendar</button>}
          {user?.role === 'admin' && <button onClick={onGoAdmin}>Admin</button>}
          <button onClick={onLogout}>Logout ({user?.username})</button>
        </div>
      </div>

      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setActiveTab('agent')} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: activeTab === 'agent' ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'var(--bg-secondary)', color: activeTab === 'agent' ? '#fff' : 'var(--text-secondary)' }}>
              Creative Agent
            </button>
            <button onClick={() => setActiveTab('score')} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: activeTab === 'score' ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'var(--bg-secondary)', color: activeTab === 'score' ? '#fff' : 'var(--text-secondary)' }}>
              Photo Scorer
            </button>
          </div>
          {activeTab === 'agent' && (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
              Autonomous AI that searches your assets, browses the web, and produces creative direction.
            </p>
          )}
          {activeTab === 'score' && (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
              Upload a photo and get an instant score on how well it will perform when posted.
            </p>
          )}
        </div>

        {/* API Key Banner */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: userApiKey ? 'rgba(22,163,74,0.06)' : 'rgba(234,179,8,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: userApiKey ? '#16a34a' : '#a16207', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {userApiKey ? '✓ Using your API key' : '⚠ Using shared key'}
          </span>
          {showKeyBanner ? (
            <>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                defaultValue={userApiKey}
                onBlur={e => {
                  const val = e.target.value.trim();
                  setUserApiKey(val);
                  localStorage.setItem('user_api_key', val);
                  setShowKeyBanner(false);
                }}
                autoFocus
                style={{ flex: 1, minWidth: 200, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace' }}
              />
              <button onClick={() => setShowKeyBanner(false)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {userApiKey ? 'Charges go to your account.' : 'Enter your own Anthropic key so you control the charges.'}
              </span>
              <button onClick={() => setShowKeyBanner(true)} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {userApiKey ? 'Change key' : 'Enter API key'}
              </button>
              {userApiKey && <button onClick={() => { setUserApiKey(''); localStorage.removeItem('user_api_key'); }} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap' }}>Remove</button>}
            </>
          )}
        </div>

        {activeTab === 'agent' && <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {events.length === 0 && !running && (
              <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
                <p style={{ fontSize: 16, margin: 0 }}>Describe a creative challenge and the agent will research and respond.</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>Or pick a quick prompt from the sidebar.</p>
              </div>
            )}
            {events.map(renderEvent)}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
            <input
              type="text"
              placeholder="Task name (optional)"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                placeholder="Describe your creative challenge..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAgent(); } }}
                rows={3}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, resize: 'none', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={running ? stopAgent : runAgent}
                  disabled={!running && !prompt.trim()}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: running ? '#dc2626' : 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', minWidth: 80 }}
                >
                  {running ? 'Stop' : 'Run'}
                </button>
              </div>
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 11 }}>Enter to run · Shift+Enter for new line · Agent uses up to 10 turns</p>
          </div>
        </>}

        {activeTab === 'score' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '32px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, background: scorePreview ? 'transparent' : 'var(--bg-secondary)', transition: 'border-color 0.2s' }}
            >
              {scorePreview ? (
                <img src={scorePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, objectFit: 'contain' }} />
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>Drop a photo here or click to upload</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>JPEG, PNG, WebP · Max 20MB</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageFile(e.target.files[0])} />
            </div>

            {scorePreview && !scoring && !scoreResult && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button onClick={submitScore} style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff' }}>
                  Score This Photo
                </button>
                <button onClick={() => { setScoreImage(null); setScorePreview(null); setScoreResult(null); }} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Clear
                </button>
              </div>
            )}

            {scoring && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                <p style={{ margin: 0 }}>Analyzing your photo...</p>
              </div>
            )}

            {scoreError && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 16 }}>
                {scoreError}
              </div>
            )}

            {scoreResult && <ScoreDisplay result={scoreResult} onReset={() => { setScoreImage(null); setScorePreview(null); setScoreResult(null); }} />}
          </div>
        )}
      </div>

      <style>{`
        .agent-turn-badge { display: inline-block; background: var(--bg-secondary); color: var(--text-secondary); font-size: 11px; padding: 2px 10px; border-radius: 12px; margin: 12px 0 6px; border: 1px solid var(--border); }
        .agent-text { margin-bottom: 12px; }
        .agent-text pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 14px; color: var(--text-primary); margin: 0; line-height: 1.6; }
        .agent-output-highlight { background: var(--bg-secondary); border-left: 3px solid #7c3aed; padding: 12px 16px; border-radius: 0 8px 8px 0; }
        .agent-tool-call { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; background: rgba(124,58,237,0.08); border-radius: 6px; margin: 4px 0; font-size: 13px; color: var(--text-secondary); }
        .agent-tool-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
        .agent-tool-input { margin-left: 4px; font-family: monospace; font-size: 12px; opacity: 0.7; word-break: break-all; }
        .agent-tool-result { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; background: rgba(37,99,235,0.06); border-radius: 6px; margin: 4px 0; font-size: 12px; color: var(--text-secondary); font-family: monospace; word-break: break-all; }
        .agent-done { color: #16a34a; font-size: 13px; font-weight: 600; margin: 12px 0; }
        .agent-error { color: #dc2626; font-size: 13px; margin: 12px 0; padding: 10px; background: rgba(220,38,38,0.08); border-radius: 6px; }
      `}</style>
    </div>
  );
}
