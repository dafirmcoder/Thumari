import React, { useState, useEffect } from 'react';
import { Landmark, Plus, Calculator, CheckCircle2, DollarSign, AlertCircle, Clock } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import { computeInstallments } from '../lib/loan-math.js';
import type { Loan, LoanProduct, Member } from '../types.js';

export const Loans: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>(store.getLoans());
  const [products, setProducts] = useState<LoanProduct[]>(store.getLoanProducts());
  const [members, setMembers] = useState<Member[]>(store.getMembers());
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [repayLoan, setRepayLoan] = useState<Loan | null>(null);
  const [repayAmountKes, setRepayAmountKes] = useState<number>(10000);

  // Application & Calculator State
  const [appMemberId, setAppMemberId] = useState<number>(1);
  const [appProductId, setAppProductId] = useState<number>(1);
  const [appPrincipalKes, setAppPrincipalKes] = useState<number>(100000);
  const [appTermMonths, setAppTermMonths] = useState<number>(12);
  const [appPurpose, setAppPurpose] = useState<string>('');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setLoans(store.getLoans());
      setProducts(store.getLoanProducts());
      setMembers(store.getMembers());
    });
    return unsub;
  }, []);

  const selectedProduct = products.find((p) => p.id === appProductId) || products[0]!;

  // Live Amortization Schedule Calculation
  const liveCalculation = computeInstallments({
    principalCents: Math.round(Number(appPrincipalKes || 0) * 100),
    monthlyRateBps: selectedProduct.interestRateBps,
    method: selectedProduct.interestMethod,
    termMonths: Number(appTermMonths || 1),
  });

  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    store.addLoan({
      memberId: Number(appMemberId),
      productId: Number(appProductId),
      principalCents: Math.round(Number(appPrincipalKes) * 100),
      termMonths: Number(appTermMonths),
      purpose: appPurpose,
    });
    setShowApplyModal(false);
    setAppPurpose('');
  };

  const handleDisburse = (loanId: number) => {
    store.updateLoanStatus(loanId, 'disbursed', {
      approvedAt: new Date().toISOString(),
      disbursedAt: new Date().toISOString(),
    });
  };

  const handleRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    store.recordLoanRepayment(repayLoan.id, Math.round(Number(repayAmountKes) * 100));
    setRepayLoan(null);
  };

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
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>🏦 Loan Products & Amortization</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Reducing balance and flat rate loan applications, automated schedules and repayments.
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Apply for Loan
        </button>
      </div>

      {/* Available Products Cards */}
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        {products.map((p) => (
          <div key={p.id} className="stat-box" style={{ background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#38bdf8' }}>{p.name}</div>
              <span
                className="badge"
                style={{
                  background: p.interestMethod === 'reducing' ? '#0284c7' : '#f59e0b',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                }}
              >
                {p.interestMethod}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Interest Rate: <strong>{(p.interestRateBps / 100).toFixed(1)}% / month</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Term: {p.minTermMonths} - {p.maxTermMonths} months &bull; Max {p.maxMultipleOfSavings}x savings
            </div>
          </div>
        ))}
      </div>

      {/* Loans Table */}
      <div className="card">
        <div className="card-title">
          <span>Loans Portfolio</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{loans.length} loans on record</span>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Loan No</th>
                <th>Member</th>
                <th>Product</th>
                <th>Principal</th>
                <th>Total Payable</th>
                <th>Balance</th>
                <th>Term</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No loans currently in database.
                  </td>
                </tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong style={{ color: '#38bdf8' }}>{l.loanNo}</strong>
                    </td>
                    <td>
                      <strong>{l.memberName}</strong>
                    </td>
                    <td>{l.productName}</td>
                    <td>{formatMoney(l.principalCents)}</td>
                    <td>{formatMoney(l.totalPayableCents)}</td>
                    <td style={{ fontWeight: 700, color: l.balanceCents > 0 ? '#fbbf24' : '#34d399' }}>
                      {formatMoney(l.balanceCents)}
                    </td>
                    <td>{l.termMonths} mo</td>
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
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {l.status === 'pending' && (
                          <button
                            onClick={() => handleDisburse(l.id)}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#10b981' }}
                          >
                            Disburse
                          </button>
                        )}
                        {l.status === 'disbursed' && (
                          <button
                            onClick={() => {
                              setRepayLoan(l);
                              setRepayAmountKes(Math.min(25000, l.balanceCents / 100));
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Repay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loan Application & Amortization Calculator Modal */}
      {showApplyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 680, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div className="card-title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator size={18} color="#38bdf8" /> Loan Application & Amortization Calculator
              </span>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLoan}>
              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Member Applicant *</label>
                  <select
                    className="form-control"
                    value={appMemberId}
                    onChange={(e) => setAppMemberId(Number(e.target.value))}
                    required
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.memberNo} — {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Loan Product *</label>
                  <select
                    className="form-control"
                    value={appProductId}
                    onChange={(e) => setAppProductId(Number(e.target.value))}
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.interestMethod}, {(p.interestRateBps / 100).toFixed(1)}%/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Principal Amount (KES) *</label>
                  <input
                    type="number"
                    step="1000"
                    className="form-control"
                    value={appPrincipalKes}
                    onChange={(e) => setAppPrincipalKes(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Repayment Term (Months) *</label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    className="form-control"
                    value={appTermMonths}
                    onChange={(e) => setAppTermMonths(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Loan Purpose / Remarks</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Purchase of farm inputs or school fees"
                  value={appPurpose}
                  onChange={(e) => setAppPurpose(e.target.value)}
                />
              </div>

              {/* Real-time Amortization Calculation Summary */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#38bdf8' }}>
                  Amortization Summary ({selectedProduct.interestMethod.toUpperCase()} ENGINE)
                </div>
                <div className="grid grid-3" style={{ gap: '0.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly Installment</div>
                    <strong style={{ fontSize: '1.1rem', color: '#fff' }}>
                      {formatMoney(liveCalculation.installments[0]?.totalCents || 0)}
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Interest</div>
                    <strong style={{ fontSize: '1.1rem', color: '#fbbf24' }}>
                      {formatMoney(liveCalculation.totalInterestCents)}
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Repayable</div>
                    <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>
                      {formatMoney(liveCalculation.totalPayableCents)}
                    </strong>
                  </div>
                </div>

                {/* Installment breakdown preview */}
                <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: '0.75rem' }}>
                  <table style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th>Mo</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Installment</th>
                        <th>Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveCalculation.installments.map((inst) => (
                        <tr key={inst.installmentNo}>
                          <td>#{inst.installmentNo}</td>
                          <td>{formatMoney(inst.principalCents)}</td>
                          <td>{formatMoney(inst.interestCents)}</td>
                          <td>
                            <strong>{formatMoney(inst.totalCents)}</strong>
                          </td>
                          <td>{formatMoney(inst.remainingBalanceCents || 0)}</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Submit Loan Application
                </button>
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
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

      {/* Repay Loan Modal */}
      {repayLoan && (
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
          <div className="card" style={{ maxWidth: 440, width: '100%' }}>
            <div className="card-title">
              <span>Record Repayment for {repayLoan.loanNo}</span>
              <button
                onClick={() => setRepayLoan(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRepay}>
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <div>
                  Member: <strong>{repayLoan.memberName}</strong>
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  Outstanding Balance:{' '}
                  <strong style={{ color: '#fbbf24' }}>{formatMoney(repayLoan.balanceCents)}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Amount (KES) *</label>
                <input
                  type="number"
                  step="100"
                  max={repayLoan.balanceCents / 100}
                  className="form-control"
                  value={repayAmountKes}
                  onChange={(e) => setRepayAmountKes(Number(e.target.value))}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Payment
                </button>
                <button
                  type="button"
                  onClick={() => setRepayLoan(null)}
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
