import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Plus, ArrowUpRight, TrendingUp, Users, Wallet, Landmark, AlertCircle, Coffee } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import type { Contribution } from '../types.js';

export const Dashboard: React.FC = () => {
  const [kpis, setKpis] = useState(store.getKPIs());
  const [contributions, setContributions] = useState(store.getContributions().slice(0, 5));
  const [loans, setLoans] = useState(store.getLoans().slice(0, 5));
  const [user, setUser] = useState(store.getCurrentUser());
  const [selectedReceipt, setSelectedReceipt] = useState<Contribution | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setKpis(store.getKPIs());
      setContributions(store.getContributions().slice(0, 5));
      setLoans(store.getLoans().slice(0, 5));
      setUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'disbursed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'completed':
        return '#3b82f6';
      case 'rejected':
      case 'defaulted':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  return (
    <div>
      {/* Header & Quick Action Buttons */}
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
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Thumari Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Group Savings, Coffee Produce & Loan Management
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            to="/coffee/scan"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#059669', borderColor: '#059669' }}
          >
            <Camera size={16} /> Scan Coffee Receipt
          </Link>
          <Link
            to="/contributions"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={16} /> Record Contribution
          </Link>
          <Link
            to="/loans"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Landmark size={16} /> Apply Loan
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Active Members</div>
            <Users size={18} color="#38bdf8" />
          </div>
          <div className="stat-value">{kpis.activeMemberCount}</div>
        </div>

        <div className="stat-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Total Group Savings</div>
            <Wallet size={18} color="#34d399" />
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {formatMoney(kpis.totalSavingsCents)}
          </div>
        </div>

        <div className="stat-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Active Loans Balance</div>
            <Landmark size={18} color="#fbbf24" />
          </div>
          <div className="stat-value">{formatMoney(kpis.totalOutstandingLoanCents)}</div>
        </div>

        <div className="stat-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Total Coffee Deliveries</div>
            <Coffee size={18} color="#f97316" />
          </div>
          <div className="stat-value" style={{ color: '#f97316' }}>
            {kpis.totalCoffeeKg.toLocaleString()} kg
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Payout: {formatMoney(kpis.totalCoffeePayoutCents)}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Recent Contributions */}
        <div className="card">
          <div className="card-title">
            <span>Recent Contributions</span>
            <Link to="/contributions" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 2 }}>
              View All <ArrowUpRight size={14} />
            </Link>
          </div>

          {contributions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No contributions recorded yet.</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.memberName}</strong>
                      </td>
                      <td>{c.typeName}</td>
                      <td style={{ color: '#34d399', fontWeight: 600 }}>{formatMoney(c.amountCents)}</td>
                      <td>{formatDate(c.paidAt)}</td>
                      <td>
                        <button
                          onClick={() => setSelectedReceipt(c)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Loans */}
        <div className="card">
          <div className="card-title">
            <span>Loan Applications & Status</span>
            <Link to="/loans" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 2 }}>
              View All <ArrowUpRight size={14} />
            </Link>
          </div>

          {loans.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No active or pending loans.</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Loan No</th>
                    <th>Member</th>
                    <th>Principal</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.loanNo}</strong>
                      </td>
                      <td>{l.memberName}</td>
                      <td>{formatMoney(l.principalCents)}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(l.balanceCents)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: getStatusBadgeColor(l.status),
                            textTransform: 'capitalize',
                          }}
                        >
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ReceiptModal contribution={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
};
