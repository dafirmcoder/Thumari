import React, { useState, useEffect } from 'react';
import { Receipt, Plus, DollarSign, Calendar, Tag } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import type { Expense } from '../types.js';

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>(store.getExpenses());
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [category, setCategory] = useState('Hall Rental');
  const [amountKes, setAmountKes] = useState<number>(2000);
  const [description, setDescription] = useState('');
  const [incurredAt, setIncurredAt] = useState(new Date().toISOString().split('T')[0]!);
  const [approvedBy, setApprovedBy] = useState('Group Administrator');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setExpenses(store.getExpenses());
    });
    return unsub;
  }, []);

  const totalExpenseCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    store.addExpense({
      category,
      amountCents: Math.round(Number(amountKes) * 100),
      description,
      incurredAt: `${incurredAt}T12:00:00Z`,
      approvedBy,
    });
    setShowAddModal(false);
    setDescription('');
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
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>🧾 Operating Expenses</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Administrative overheads, stationery, meeting hall rentals and bank charge disbursements.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Record Expense
        </button>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-box">
          <div className="stat-label">Total Recorded Expenses</div>
          <div className="stat-value" style={{ color: '#f87171' }}>
            {formatMoney(totalExpenseCents)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Across {expenses.length} disbursements
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Approved By</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No operating expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.incurredAt)}</td>
                    <td>
                      <span
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        {e.category}
                      </span>
                    </td>
                    <td>{e.description}</td>
                    <td>{e.approvedBy || 'Treasurer'}</td>
                    <td style={{ color: '#f87171', fontWeight: 600 }}>{formatMoney(e.amountCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
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
              <span>Record Operating Expense</span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense}>
              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="Hall Rental">Hall Rental</option>
                    <option value="Stationery & Printing">Stationery & Printing</option>
                    <option value="Bank Charges">Bank Charges</option>
                    <option value="Transport & Logistics">Transport & Logistics</option>
                    <option value="Refreshments">Refreshments</option>
                    <option value="Audit & Legal">Audit & Legal</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (KES) *</label>
                  <input
                    type="number"
                    step="10"
                    className="form-control"
                    value={amountKes}
                    onChange={(e) => setAmountKes(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={incurredAt}
                    onChange={(e) => setIncurredAt(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Authorized / Approved By</label>
                  <input
                    type="text"
                    className="form-control"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Particulars *</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Purpose of expense voucher..."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Expense
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
