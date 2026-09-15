import React, { useState, useEffect } from 'react';
import { Plus, Wallet, Search, Filter, Printer, CheckCircle2 } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import type { Contribution, ContributionType, Member } from '../types.js';

export const Contributions: React.FC = () => {
  const [contributions, setContributions] = useState<Contribution[]>(store.getContributions());
  const [types, setTypes] = useState<ContributionType[]>(store.getContributionTypes());
  const [members, setMembers] = useState<Member[]>(store.getMembers());
  const [selectedReceipt, setSelectedReceipt] = useState<Contribution | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Filters
  const [memberFilter, setMemberFilter] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');

  // Form State
  const [formMemberId, setFormMemberId] = useState<number>(1);
  const [formTypeId, setFormTypeId] = useState<number>(1);
  const [formAmountKes, setFormAmountKes] = useState<number>(5000);
  const [formPaidAt, setFormPaidAt] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [formMethod, setFormMethod] = useState<'cash' | 'mpesa' | 'bank'>('mpesa');
  const [formReference, setFormReference] = useState<string>('');
  const [formPeriod, setFormPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [formNotes, setFormNotes] = useState<string>('');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setContributions(store.getContributions());
      setTypes(store.getContributionTypes());
      setMembers(store.getMembers());
    });
    return unsub;
  }, []);

  const filteredContributions = contributions.filter((c) => {
    const matchesMember = memberFilter === 'all' || c.memberId === memberFilter;
    const matchesType = typeFilter === 'all' || c.typeId === typeFilter;
    return matchesMember && matchesType;
  });

  const totalFilteredCents = filteredContributions.reduce((sum, c) => sum + c.amountCents, 0);

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    const created = store.addContribution({
      memberId: Number(formMemberId),
      typeId: Number(formTypeId),
      amountCents: Math.round(Number(formAmountKes) * 100),
      paidAt: `${formPaidAt}T12:00:00Z`,
      method: formMethod,
      reference: formReference || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
      period: formPeriod,
      notes: formNotes,
    });

    setShowAddModal(false);
    // Automatically preview receipt
    const member = members.find((m) => m.id === Number(formMemberId));
    const type = types.find((t) => t.id === Number(formTypeId));
    setSelectedReceipt({
      ...created,
      memberName: member ? `${member.firstName} ${member.lastName}` : 'Member',
      typeName: type?.name || 'Contribution',
    });
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
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>💰 Contributions Ledger</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Savings, welfare collections, share capital records and official printable receipts.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Record Contribution
        </button>
      </div>

      {/* Filter and Stats Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.memberNo} — {m.firstName} {m.lastName}
                </option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">All Contribution Types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing {filteredContributions.length} records &bull; Total:{' '}
            <strong style={{ color: '#34d399', fontSize: '1.1rem' }}>{formatMoney(totalFilteredCents)}</strong>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Type</th>
                <th>Period</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filteredContributions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No contributions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredContributions.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.paidAt)}</td>
                    <td>
                      <strong>{c.memberName}</strong>
                    </td>
                    <td>{c.typeName}</td>
                    <td>{c.period || '—'}</td>
                    <td>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: 4,
                        }}
                      >
                        {c.method}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{c.reference || '—'}</code>
                    </td>
                    <td style={{ color: '#34d399', fontWeight: 600 }}>{formatMoney(c.amountCents)}</td>
                    <td>
                      <button
                        onClick={() => setSelectedReceipt(c)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        <Printer size={12} /> Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contribution Modal */}
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
          <div className="card" style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-title">
              <span>Record Member Contribution</span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContribution}>
              <div className="form-group">
                <label className="form-label">Member *</label>
                <select
                  className="form-control"
                  value={formMemberId}
                  onChange={(e) => setFormMemberId(Number(e.target.value))}
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.memberNo} — {m.firstName} {m.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Contribution Type *</label>
                  <select
                    className="form-control"
                    value={formTypeId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setFormTypeId(id);
                      const t = types.find((type) => type.id === id);
                      if (t) setFormAmountKes(t.defaultAmountCents / 100);
                    }}
                    required
                  >
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (KES) *</label>
                  <input
                    type="number"
                    step="10"
                    className="form-control"
                    value={formAmountKes}
                    onChange={(e) => setFormAmountKes(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formPaidAt}
                    onChange={(e) => setFormPaidAt(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Period (YYYY-MM)</label>
                  <input
                    type="month"
                    className="form-control"
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Channel *</label>
                  <select
                    className="form-control"
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as any)}
                  >
                    <option value="mpesa">M-Pesa</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Ref / Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. QBC129384"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Optional remarks"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save & Print Receipt
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

      <ReceiptModal contribution={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
};
