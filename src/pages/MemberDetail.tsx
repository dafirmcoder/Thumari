import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, CreditCard, Calendar, Wallet, Landmark, Coffee, AlertTriangle } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import type { Member, Contribution, Loan, CoffeeProduce, Fine } from '../types.js';

export const MemberDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const memberId = Number(id);
  const [member, setMember] = useState<Member | undefined>(store.getMemberById(memberId));
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [produce, setProduce] = useState<CoffeeProduce[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Contribution | null>(null);

  useEffect(() => {
    const update = () => {
      setMember(store.getMemberById(memberId));
      setContributions(store.getContributions().filter((c) => c.memberId === memberId));
      setLoans(store.getLoans().filter((l) => l.memberId === memberId));
      setProduce(store.getCoffeeProduce().filter((p) => p.memberId === memberId));
      setFines(store.getFines().filter((f) => f.memberId === memberId));
    };
    update();
    const unsub = store.subscribe(update);
    return unsub;
  }, [memberId]);

  if (!member) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Member Not Found</h2>
        <Link to="/members" className="btn btn-secondary">
          &larr; Back to Member Directory
        </Link>
      </div>
    );
  }

  const totalSavingsCents = contributions.reduce((sum, c) => sum + c.amountCents, 0);
  const totalLoanBalanceCents = loans
    .filter((l) => l.status === 'disbursed')
    .reduce((sum, l) => sum + l.balanceCents, 0);
  const totalCoffeeKg = produce.reduce((sum, p) => sum + p.netKg, 0);
  const unpaidFinesCents = fines
    .filter((f) => f.status === 'unpaid')
    .reduce((sum, f) => sum + f.amountCents, 0);

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/members" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} /> Back to Members
        </Link>
      </div>

      {/* Member Profile Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1.5rem',
              }}
            >
              {member.firstName[0]}
              {member.lastName[0]}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
                  {member.firstName} {member.lastName}
                </h1>
                <span
                  className="badge"
                  style={{
                    background: member.status === 'active' ? '#10b981' : '#f59e0b',
                    textTransform: 'capitalize',
                  }}
                >
                  {member.status}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Member No: <strong style={{ color: '#38bdf8' }}>{member.memberNo}</strong> &bull; Joined:{' '}
                {formatDate(member.joinDate)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
            {member.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={14} color="var(--text-muted)" /> {member.phone}
              </div>
            )}
            {member.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={14} color="var(--text-muted)" /> {member.email}
              </div>
            )}
            {member.nationalId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={14} color="var(--text-muted)" /> ID: {member.nationalId}
              </div>
            )}
          </div>
        </div>

        {member.notes && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            {member.notes}
          </div>
        )}
      </div>

      {/* Member Financial Stats */}
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-box">
          <div className="stat-label">Total Accumulated Savings</div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {formatMoney(totalSavingsCents)}
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Active Loans Balance</div>
          <div className="stat-value">{formatMoney(totalLoanBalanceCents)}</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Coffee Cherry Delivered</div>
          <div className="stat-value" style={{ color: '#f97316' }}>
            {totalCoffeeKg.toLocaleString()} kg
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Unpaid Fines</div>
          <div className="stat-value" style={{ color: unpaidFinesCents > 0 ? '#ef4444' : '#38bdf8' }}>
            {formatMoney(unpaidFinesCents)}
          </div>
        </div>
      </div>

      {/* Tables: Contributions & Loans */}
      <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Contributions Ledger */}
        <div className="card">
          <div className="card-title">
            <span>Contributions Ledger</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{contributions.length} records</span>
          </div>

          {contributions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No contributions recorded for this member.</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id}>
                      <td>{formatDate(c.paidAt)}</td>
                      <td>{c.typeName}</td>
                      <td style={{ color: '#34d399', fontWeight: 600 }}>{formatMoney(c.amountCents)}</td>
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

        {/* Loans Ledger */}
        <div className="card">
          <div className="card-title">
            <span>Loan Portfolio</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{loans.length} applications</span>
          </div>

          {loans.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No loans on record.</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Loan No</th>
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
                      <td>{formatMoney(l.principalCents)}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(l.balanceCents)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              l.status === 'disbursed'
                                ? '#10b981'
                                : l.status === 'completed'
                                ? '#3b82f6'
                                : l.status === 'pending'
                                ? '#f59e0b'
                                : '#64748b',
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
