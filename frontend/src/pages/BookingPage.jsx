import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3002';

export default function BookingPage({ username }) {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/availability/${username}`)
      .then(r => {
        if (!r.ok) throw new Error('User not found');
        return r.json();
      })
      .then(data => {
        setAvailability(data);
        // Auto-select first available date
        if (data.available_slots?.length > 0) {
          setSelectedDate(data.available_slots[0].date);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [username]);

  const handleBook = async () => {
    if (!selectedSlot || !name.trim() || !email.trim()) return;
    setBooking(true);
    try {
      const resp = await fetch(`${API_BASE}/api/availability/${username}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          message: message.trim(),
        }),
      });
      if (resp.ok) {
        const result = await resp.json();
        setConfirmed(result);
      } else {
        const err = await resp.json().catch(() => ({}));
        alert(err.detail || 'Booking failed. The slot may no longer be available.');
      }
    } catch {
      alert('Booking failed. Please try again.');
    }
    setBooking(false);
  };

  // Group slots by date
  const slotsByDate = {};
  const availableDates = [];
  if (availability?.available_slots) {
    for (const slot of availability.available_slots) {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
        availableDates.push(slot.date);
      }
      slotsByDate[slot.date].push(slot);
    }
  }

  const slotsForDate = selectedDate ? (slotsByDate[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="booking-page">
        <div className="booking-loading"><div className="spinner" /><p>Loading availability...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="booking-page">
        <div className="booking-error">
          <h2>User not found</h2>
          <p>The scheduling link may be incorrect.</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="booking-page">
        <div className="booking-confirmed">
          <div className="booking-confirmed-icon">&#10003;</div>
          <h2>Booking Confirmed!</h2>
          <p>Your meeting with <strong>{username}</strong> has been scheduled.</p>
          <div className="booking-confirmed-details">
            <div><strong>Title:</strong> {confirmed.event_title}</div>
            <div><strong>Time:</strong> {new Date(confirmed.start_time).toLocaleString()} - {new Date(confirmed.end_time).toLocaleTimeString()}</div>
            {confirmed.zoom_link && (
              <div><strong>Zoom:</strong> <a href={confirmed.zoom_link} target="_blank" rel="noopener noreferrer">{confirmed.zoom_link}</a></div>
            )}
          </div>
          <p style={{ marginTop: 16, color: '#888' }}>A confirmation email has been sent to your inbox.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="booking-container">
        {/* Left: User info + date picker */}
        <div className="booking-sidebar">
          <div className="booking-user-info">
            <div className="booking-avatar">{username[0]?.toUpperCase()}</div>
            <h2>{username}</h2>
            {availability.org && <p className="booking-org">{availability.org}</p>}
          </div>
          <h3 className="booking-section-title">Select a Date</h3>
          <div className="booking-date-list">
            {availableDates.map(date => {
              const d = new Date(date + 'T00:00:00');
              const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
              const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const slotCount = slotsByDate[date].length;
              return (
                <div
                  key={date}
                  className={`booking-date-item ${date === selectedDate ? 'active' : ''}`}
                  onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                >
                  <span className="booking-date-day">{dayName}</span>
                  <span className="booking-date-text">{monthDay}</span>
                  <span className="booking-date-slots">{slotCount} slots</span>
                </div>
              );
            })}
            {availableDates.length === 0 && (
              <p style={{ color: '#888', fontSize: 14, padding: 12 }}>No available times in the next 2 weeks.</p>
            )}
          </div>
        </div>

        {/* Right: Time slots + booking form */}
        <div className="booking-main">
          {selectedDate && (
            <>
              <h3 className="booking-section-title">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <div className="booking-time-grid">
                {slotsForDate.map((slot, i) => (
                  <button
                    key={i}
                    className={`booking-time-btn ${selectedSlot === slot ? 'active' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.start} - {slot.end}
                  </button>
                ))}
              </div>
            </>
          )}

          {selectedSlot && (
            <div className="booking-form">
              <h3 className="booking-section-title">Your Details</h3>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="booking-input"
              />
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="booking-input"
              />
              <textarea
                placeholder="Message (optional)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="booking-input"
                rows={3}
              />
              <button
                className="booking-confirm-btn"
                onClick={handleBook}
                disabled={booking || !name.trim() || !email.trim()}
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
