import React from 'react';
import { useToast } from './Toast';

const DEFAULT_SIG = {
  name: '', title: '', company: '', phone: '', website: '',
  linkedin: '', twitter: '',
  show_calendar_link: false, show_hubspot_link: false,
  show_linkedin: false, show_twitter: false,
  accent_color: '#7c83ff',
};

export default function EmailPreview({ signatureData, user, userSettings, onSignatureChange, onSignatureSave, signatureSaving }) {
  const toast = useToast();
  const sig = { ...DEFAULT_SIG, ...signatureData };
  const {
    name, title, company, phone, website,
    linkedin, twitter,
    show_calendar_link, show_hubspot_link,
    show_linkedin, show_twitter,
    accent_color,
  } = sig;

  const bookingLink = `${window.location.origin}/book/${user?.username || 'admin'}`;
  const hubspotLink = userSettings?.hubspot_meeting_link;

  const update = (key, value) => {
    onSignatureChange({ ...sig, [key]: value });
  };

  const handleCopyHtml = () => {
    const ac = accent_color || '#7c83ff';
    const parts = [];
    parts.push(`<div style="font-size:16px;font-weight:bold;color:${ac};">${name || 'Your Name'}</div>`);
    if (title) parts.push(`<div style="font-size:13px;color:#666;">${title}</div>`);
    if (company) parts.push(`<div style="font-size:13px;color:#999;margin-bottom:8px;">${company}</div>`);
    if (phone) parts.push(`<div style="font-size:12px;color:#555;">${phone}</div>`);
    if (website) parts.push(`<div style="font-size:12px;"><a href="${website}" style="color:${ac};text-decoration:none;">${website}</a></div>`);
    if (show_calendar_link) parts.push(`<div style="margin-top:8px;font-size:12px;"><a href="${bookingLink}" style="color:${ac};font-weight:500;text-decoration:none;">Schedule a meeting</a></div>`);
    if (show_hubspot_link && hubspotLink) parts.push(`<div style="font-size:12px;"><a href="${hubspotLink}" style="color:${ac};font-weight:500;text-decoration:none;">Book via HubSpot</a></div>`);
    if (show_linkedin && linkedin) parts.push(`<div style="font-size:12px;"><a href="${linkedin}" style="color:#0077b5;text-decoration:none;">LinkedIn</a></div>`);
    if (show_twitter && twitter) parts.push(`<div style="font-size:12px;"><a href="${twitter}" style="color:#1da1f2;text-decoration:none;">Twitter/X</a></div>`);

    const html = `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;"><tr><td style="border-top:2px solid ${ac};padding-top:12px;">${parts.join('\n')}</td></tr></table>`;
    navigator.clipboard.writeText(html);
    toast.success('Signature HTML copied!');
  };

  return (
    <div className="email-preview-area">
      {/* Signature Editor */}
      <div style={{ width: '100%', maxWidth: 680, marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Email Signature</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Edit your signature below. The preview updates live.</div>

        <div className="sig-form" style={{ overflow: 'visible', gap: 12 }}>
          {/* Your Info */}
          <div className="sig-form-section">
            <div className="sig-form-section-title">Your Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="sig-form-field">
                <label>Name</label>
                <input type="text" value={sig.name} onChange={e => update('name', e.target.value)} placeholder={user?.username || 'Your Name'} />
              </div>
              <div className="sig-form-field">
                <label>Title / Role</label>
                <input type="text" value={sig.title} onChange={e => update('title', e.target.value)} placeholder="Marketing Director" />
              </div>
              <div className="sig-form-field">
                <label>Company</label>
                <input type="text" value={sig.company} onChange={e => update('company', e.target.value)} placeholder="50 Words" />
              </div>
              <div className="sig-form-field">
                <label>Phone</label>
                <input type="tel" value={sig.phone} onChange={e => update('phone', e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div className="sig-form-field" style={{ gridColumn: 'span 2' }}>
                <label>Website</label>
                <input type="url" value={sig.website} onChange={e => update('website', e.target.value)} placeholder="https://yourcompany.com" />
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="sig-form-section">
            <div className="sig-form-section-title">Quick Links</div>
            <div className="sig-toggle-row">
              <span className="sig-toggle-label">Calendar / Availability Link</span>
              <button className={`sig-toggle ${sig.show_calendar_link ? 'on' : ''}`} onClick={() => update('show_calendar_link', !sig.show_calendar_link)} />
            </div>
            <div className="sig-toggle-row">
              <span className="sig-toggle-label">HubSpot Meeting Link</span>
              <button className={`sig-toggle ${sig.show_hubspot_link ? 'on' : ''}`} onClick={() => update('show_hubspot_link', !sig.show_hubspot_link)} />
            </div>
            <div className="sig-toggle-row">
              <span className="sig-toggle-label">LinkedIn</span>
              <button className={`sig-toggle ${sig.show_linkedin ? 'on' : ''}`} onClick={() => update('show_linkedin', !sig.show_linkedin)} />
            </div>
            {sig.show_linkedin && (
              <input type="url" value={sig.linkedin} onChange={e => update('linkedin', e.target.value)} placeholder="https://linkedin.com/in/you" style={{ marginTop: -4 }} />
            )}
            <div className="sig-toggle-row">
              <span className="sig-toggle-label">Twitter / X</span>
              <button className={`sig-toggle ${sig.show_twitter ? 'on' : ''}`} onClick={() => update('show_twitter', !sig.show_twitter)} />
            </div>
            {sig.show_twitter && (
              <input type="url" value={sig.twitter} onChange={e => update('twitter', e.target.value)} placeholder="https://x.com/you" style={{ marginTop: -4 }} />
            )}
          </div>

          {/* Style */}
          <div className="sig-form-section">
            <div className="sig-form-section-title">Accent Color</div>
            <div className="sig-color-row">
              <input type="color" value={sig.accent_color} onChange={e => update('accent_color', e.target.value)} />
              <input type="text" className="sig-color-hex" value={sig.accent_color} onChange={e => update('accent_color', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="sig-save-btn" onClick={onSignatureSave} disabled={signatureSaving}>
              {signatureSaving ? 'Saving...' : 'Save Signature'}
            </button>
            <button className="sig-save-btn" style={{ background: 'var(--bg-active)', color: 'var(--text-primary)' }} onClick={handleCopyHtml}>
              Copy HTML
            </button>
          </div>
        </div>
      </div>

      {/* Live Email Preview */}
      <div style={{ width: '100%', maxWidth: 680, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Live Preview
        </div>
      </div>
      <div className="email-preview-card">
        {/* Header fields */}
        <div className="email-preview-fields">
          <div className="email-field">
            <span className="email-field-label">From:</span>
            <span>{name || user?.username || 'Your Name'} &lt;{user?.username || 'you'}@company.com&gt;</span>
          </div>
          <div className="email-field">
            <span className="email-field-label">To:</span>
            <span>recipient@example.com</span>
          </div>
          <div className="email-field">
            <span className="email-field-label">Subject:</span>
            <span>Following up on our conversation</span>
          </div>
        </div>

        {/* Email body */}
        <div className="email-body-text">
          <p>Hi there,</p>
          <p>Thanks for taking the time to chat earlier. I wanted to follow up on the points we discussed and share some additional resources that might be helpful.</p>
          <p>Looking forward to hearing from you!</p>
          <p>Best regards</p>
        </div>

        {/* Signature divider */}
        <div className="sig-divider" style={{ borderTopColor: accent_color }} />

        {/* Signature */}
        <div className="sig-block">
          <div className="sig-name" style={{ color: accent_color }}>
            {name || 'Your Name'}
          </div>
          {title && <div className="sig-title">{title}</div>}
          {company && <div className="sig-company">{company}</div>}

          <div className="sig-contact-row">
            {phone && <span>{phone}</span>}
            {website && (
              <a href={website} style={{ color: accent_color }}>{website.replace(/^https?:\/\//, '')}</a>
            )}
          </div>

          {(show_calendar_link || (show_hubspot_link && hubspotLink)) && (
            <div className="sig-links">
              {show_calendar_link && (
                <a href={bookingLink} style={{ color: accent_color }}>Schedule a meeting</a>
              )}
              {show_hubspot_link && hubspotLink && (
                <a href={hubspotLink} style={{ color: accent_color }}>Book via HubSpot</a>
              )}
            </div>
          )}

          {((show_linkedin && linkedin) || (show_twitter && twitter)) && (
            <div className="sig-social">
              {show_linkedin && linkedin && (
                <a href={linkedin} style={{ color: '#0077b5' }}>LinkedIn</a>
              )}
              {show_twitter && twitter && (
                <a href={twitter} style={{ color: '#1da1f2' }}>Twitter/X</a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
