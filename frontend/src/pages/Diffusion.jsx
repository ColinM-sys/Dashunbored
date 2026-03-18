import React, { useState, useRef } from 'react';

const COMFY_BASE = process.env.REACT_APP_COMFY_URL || 'http://100.121.201.104:8188';

const STYLES = [
  { label: 'None', value: '' },
  { label: 'Photorealistic', value: 'photorealistic, 8k, professional photography, sharp focus' },
  { label: 'Cinematic', value: 'cinematic, film grain, dramatic lighting, widescreen' },
  { label: 'Studio Portrait', value: 'studio portrait, softbox lighting, clean background, professional' },
  { label: 'Editorial', value: 'editorial fashion photography, high fashion, magazine quality' },
  { label: 'Golden Hour', value: 'golden hour, warm light, bokeh, outdoor photography' },
  { label: 'Black & White', value: 'black and white photography, high contrast, dramatic shadows' },
  { label: 'Concept Art', value: 'concept art, digital painting, detailed, artstation' },
  { label: 'Watercolor', value: 'watercolor painting, soft edges, artistic, painterly' },
];

const SIZES = [
  { label: 'Square (1024×1024)', w: 1024, h: 1024 },
  { label: 'Portrait (768×1024)', w: 768, h: 1024 },
  { label: 'Landscape (1024×768)', w: 1024, h: 768 },
  { label: 'Wide (1216×832)', w: 1216, h: 832 },
];

export default function Diffusion({ onGoChat, onGoAdmin, onGoCalendar, onGoStudio, onGoAgent, theme, onToggleTheme }) {
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('blurry, low quality, watermark, text, deformed');
  const [style, setStyle] = useState('');
  const [size, setSize] = useState(SIZES[0]);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(7);
  const [images, setImages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const promptRef = useRef();

  const fullPrompt = [prompt, style].filter(Boolean).join(', ');

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError('');

    // ComfyUI workflow for basic txt2img
    const workflow = {
      "3": { "class_type": "KSampler", "inputs": { "cfg": cfg, "denoise": 1, "latent_image": ["5", 0], "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": Math.floor(Math.random() * 99999999), "steps": steps } },
      "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "v1-5-pruned-emaonly.ckpt" } },
      "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": size.h, "width": size.w } },
      "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": fullPrompt } },
      "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": negPrompt } },
      "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
      "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "dashunbored", "images": ["8", 0] } }
    };

    try {
      const queueResp = await fetch(`${COMFY_BASE}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!queueResp.ok) throw new Error('ComfyUI not reachable — is it running on port 8188?');
      const { prompt_id } = await queueResp.json();

      // Poll for completion
      let output = null;
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const histResp = await fetch(`${COMFY_BASE}/history/${prompt_id}`);
        const hist = await histResp.json();
        if (hist[prompt_id]?.outputs?.['9']?.images) {
          output = hist[prompt_id].outputs['9'].images;
          break;
        }
      }

      if (!output) throw new Error('Generation timed out');

      const newImages = output.map(img => ({
        url: `${COMFY_BASE}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`,
        prompt: fullPrompt,
        size: `${size.w}×${size.h}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
      setImages(prev => [...newImages, ...prev]);
      setSelected(newImages[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>

      {/* Left panel — controls */}
      <div style={{ width: 320, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onGoChat} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
          <span style={{ fontSize: 16, fontWeight: 700 }}>🖼 Generate</span>
          <button onClick={onToggleTheme} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>{theme === 'dark' ? '☀' : '🌙'}</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Prompt */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>PROMPT</label>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what you want to generate..."
              rows={4}
              style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generate(); }}
            />
          </div>

          {/* Style */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>STYLE</label>
            <select value={style} onChange={e => setStyle(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13 }}>
              {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Size */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>SIZE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SIZES.map(s => (
                <button key={s.label} onClick={() => setSize(s)}
                  style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, border: `1px solid ${size === s ? 'var(--accent)' : 'var(--border)'}`, background: size === s ? 'var(--accent)22' : 'var(--bg-secondary)', color: size === s ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Steps & CFG */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>STEPS: {steps}</label>
              <input type="range" min={10} max={50} value={steps} onChange={e => setSteps(+e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>CFG: {cfg}</label>
              <input type="range" min={1} max={15} value={cfg} onChange={e => setCfg(+e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Negative prompt */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>NEGATIVE PROMPT</label>
            <textarea value={negPrompt} onChange={e => setNegPrompt(e.target.value)} rows={2}
              style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {error && <div style={{ background: '#ff444422', border: '1px solid #ff4444', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ff6666' }}>{error}</div>}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={generate} disabled={generating || !prompt.trim()}
            style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: generating ? 'var(--bg-hover)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}>
            {generating ? '⏳ Generating...' : '✦ Generate  ⌘↵'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0' }}>
            Powered by ComfyUI · Stable Diffusion
          </p>
        </div>
      </div>

      {/* Right panel — output */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Selected image preview */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 24, background: 'var(--bg-primary)' }}>
          {generating ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 14 }}>Generating your image...</div>
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>{steps} steps · {size.w}×{size.h}</div>
            </div>
          ) : selected ? (
            <div style={{ textAlign: 'center', maxHeight: '100%' }}>
              <img src={selected.url} alt={selected.prompt} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', borderRadius: 12, boxShadow: '0 8px 40px #0006' }} />
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>{selected.prompt}</div>
              <a href={selected.url} download="dashunbored-gen.png"
                style={{ display: 'inline-block', marginTop: 8, padding: '6px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, textDecoration: 'none' }}>
                ↓ Download
              </a>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.3 }}>🖼</div>
              <div style={{ fontSize: 14 }}>Enter a prompt and click Generate</div>
            </div>
          )}
        </div>

        {/* History strip */}
        {images.length > 0 && (
          <div style={{ height: 100, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto', background: 'var(--bg-secondary)', alignItems: 'center' }}>
            {images.map((img, i) => (
              <img key={i} src={img.url} alt={img.prompt} onClick={() => setSelected(img)}
                style={{ height: 80, width: 80, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: selected === img ? '2px solid var(--accent)' : '2px solid transparent', flexShrink: 0 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
