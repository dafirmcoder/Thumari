import React, { useState, useEffect } from 'react';
import { Calendar, Plus, MapPin, Clock, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import type { Meeting, Fine } from '../types.js';

export const Meetings: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>(store.getMeetings());
  const [fines, setFines] = useState<Fine[]>(store.getFines());
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');
  const [agenda, setAgenda] = useState('');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setMeetings(store.getMeetings());
      setFines(store.getFines());
    });
    return unsub;
  }, []);

  const handleAddMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    store.addMeeting({
      title,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
      venue,
      agenda,
      status: 'scheduled',
    });
    setShowAddModal(false);
    setTitle('');
    setVenue('');
    setAgenda('');
  };

  const handlePayFine = (fineId: number) => {
    store.payFine(fineId);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>📅 Meetings & Fines Ledger</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Schedule group meetings, record attendance registers and track automated absence penalty fines.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Schedule Meeting
        </button>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        {/* Meetings List */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Scheduled & Past Meetings</h2>
          {meetings.map((m) => (
            <div key={m.id} className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#38bdf8' }}>{m.title}</h3>
                <span
                  className="badge"
                  style={{
                    background: m.status === 'scheduled' ? '#0284c7' : '#10b981',
                    textTransform: 'capitalize',
                  }}
                >
                  {m.status}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <Clock size={14} /> {formatDate(m.scheduledAt)}
                </div>
                {m.venue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} /> {m.venue}
                  </div>
                )}
              </div>

              {m.agenda && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-line',
                  }}
                >
                  <strong>Agenda:</strong>
                  <div>{m.agenda}</div>
                </div>
              )}

              {m.minutes && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    background: 'rgba(16, 185, 129, 0.05)',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    borderLeft: '3px solid #10b981',
                  }}
                >
                  <strong>Resolutions & Minutes:</strong>
                  <div>{m.minutes}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Attendance Fines Ledger */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} color="#f59e0b" /> Absence & Disciplinary Fines
          </h2>

          <div className="card">
            {fines.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No disciplinary fines recorded.</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Reason</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fines.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.memberName}</strong>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{f.reason}</td>
                        <td style={{ color: '#f87171', fontWeight: 600 }}>{formatMoney(f.amountCents)}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: f.status === 'paid' ? '#10b981' : '#ef4444',
                              textTransform: 'capitalize',
                            }}
                          >
                            {f.status}
                          </span>
                        </td>
                        <td>
                          {f.status === 'unpaid' && (
                            <button
                              onClick={() => handlePayFine(f.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ maxWidth: 500, width: '100%' }}>
            <div className="card-title">
              <span>Schedule New Meeting</span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMeeting}>
              <div className="form-group">
                <label className="form-label">Meeting Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. April 2026 Monthly General Meeting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Venue</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Social Hall, Kerugoya"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Agenda</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="List meeting discussion items..."
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Meeting
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
