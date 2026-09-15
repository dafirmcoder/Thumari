import React, { useState, useEffect } from 'react';
import { FileText, Calendar, BarChart3, Coffee, Landmark, TrendingUp, DollarSign } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import type { Member, Contribution, CoffeeProduce, Expense, Loan } from '../types.js';

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monthly' | 'annual' | 'coffee' | 'accounts'>('monthly');
  const [members, setMembers] = useState<Member[]>(store.getMembers());
  const [contributions, setContributions] = useState<Contribution[]>(store.getContributions());
  const [produce, setProduce] = useState<CoffeeProduce[]>(store.getCoffeeProduce());
  const [expenses, setExpenses] = useState<Expense[]>(store.getExpenses());
  const [loans, setLoans] = useState<Loan[]>(store.getLoans());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setMembers(store.getMembers());
      setContributions(store.getContributions());
      setProduce(store.getCoffeeProduce());
      setExpenses(store.getExpenses());
      setLoans(store.getLoans());
    });
    return unsub;
  }, []);

  // Monthly Calculations
  const months = ['2026-01', '2026-02', '2026-03'];
  const [selectedMonth, setSelectedMonth] = useState('2026-02');
  const monthlyContributions = contributions.filter((c) => (c.period || c.paidAt.slice(0, 7)) === selectedMonth);
  const totalMonthlyCents = monthlyContributions.reduce((sum, c) => sum + c.amountCents, 0);

  // Annual Matrix Calculations
  const allMonths = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const matrixData = members.map((m) => {
    const monthAmounts = allMonths.map((mo) => {
      const targetPeriod = `2026-${mo}`;
      return contributions
        .filter((c) => c.memberId === m.id && (c.period || c.paidAt.slice(0, 7)) === targetPeriod)
        .reduce((sum, c) => sum + c.amountCents, 0);
    });
    const memberTotal = monthAmounts.reduce((sum, val) => sum + val, 0);
    return {
      member: m,
      monthAmounts,
      memberTotal,
    };
  });

  // Coffee Produce Leaderboard
  const memberCoffeeYields = members
    .map((m) => {
      const memberDeliveries = produce.filter((p) => p.memberId === m.id);
      const totalKg = memberDeliveries.reduce((sum, d) => sum + d.netKg, 0);
      const totalPayout = memberDeliveries.reduce((sum, d) => sum + d.payoutCents, 0);
      return {
        member: m,
        totalKg,
        totalPayout,
        deliveryCount: memberDeliveries.length,
      };
    })
    .sort((a, b) => b.totalKg - a.totalKg);

  // Financial Accounts / Income Statement
  const totalSavingsInflow = contributions.reduce((sum, c) => sum + c.amountCents, 0);
  const totalLoanInterestInflow = loans.reduce((sum, l) => sum + l.totalInterestCents, 0);
  const totalOperatingOutflows = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const totalLoanDisbursed = loans
    .filter((l) => ['disbursed', 'completed'].includes(l.status))
    .reduce((sum, l) => sum + l.principalCents, 0);
  const netOperatingSurplus = totalLoanInterestInflow - totalOperatingOutflows;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>📊 Financial & Produce Reports</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
          Consolidated monthly summaries, 12-month contribution matrices, coffee leaderboards and financial statements.
        </p>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('monthly')}
          className={`btn btn-sm ${activeTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0.375rem 0.375rem 0 0' }}
        >
          Monthly Summary
        </button>
        <button
          onClick={() => setActiveTab('annual')}
          className={`btn btn-sm ${activeTab === 'annual' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0.375rem 0.375rem 0 0' }}
        >
          Annual Matrix (12-Mo)
        </button>
        <button
          onClick={() => setActiveTab('coffee')}
          className={`btn btn-sm ${activeTab === 'coffee' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0.375rem 0.375rem 0 0' }}
        >
          Coffee Produce Yields
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`btn btn-sm ${activeTab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0.375rem 0.375rem 0 0' }}
        >
          Financial Accounts
        </button>
      </div>

      {/* Tab 1: Monthly Summary */}
      {activeTab === 'monthly' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Select Month:</label>
                <select
                  className="form-control"
                  style={{ width: 'auto' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="2026-03">March 2026</option>
                  <option value="2026-02">February 2026</option>
                  <option value="2026-01">January 2026</option>
                </select>
              </div>

              <div>
                Total Collected:{' '}
                <strong style={{ color: '#34d399', fontSize: '1.1rem' }}>
                  {formatMoney(totalMonthlyCents)}
                </strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Type</th>
                    <th>Payment Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyContributions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No contributions recorded for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    monthlyContributions.map((c) => (
                      <tr key={c.id}>
                        <td>{formatDate(c.paidAt)}</td>
                        <td>
                          <strong>{c.memberName}</strong>
                        </td>
                        <td>{c.typeName}</td>
                        <td style={{ textTransform: 'uppercase' }}>{c.method}</td>
                        <td style={{ color: '#34d399', fontWeight: 600 }}>{formatMoney(c.amountCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Annual Contributions Matrix */}
      {activeTab === 'annual' && (
        <div className="card">
          <div className="card-title">
            <span>2026 Member Contributions Matrix</span>
          </div>

          <div className="table-responsive">
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Jan</th>
                  <th>Feb</th>
                  <th>Mar</th>
                  <th>Apr</th>
                  <th>May</th>
                  <th>Jun</th>
                  <th>Jul</th>
                  <th>Aug</th>
                  <th>Sep</th>
                  <th>Oct</th>
                  <th>Nov</th>
                  <th>Dec</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row) => (
                  <tr key={row.member.id}>
                    <td>
                      <strong>
                        {row.member.firstName} {row.member.lastName}
                      </strong>
                    </td>
                    {row.monthAmounts.map((amt, idx) => (
                      <td key={idx} style={{ color: amt > 0 ? '#34d399' : 'var(--text-muted)' }}>
                        {amt > 0 ? (amt / 100).toLocaleString() : '—'}
                      </td>
                    ))}
                    <td>
                      <strong style={{ color: '#38bdf8' }}>{formatMoney(row.memberTotal)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Coffee Produce Leaderboard */}
      {activeTab === 'coffee' && (
        <div className="card">
          <div className="card-title">
            <span>Coffee Cherry Deliveries & Farmer Rankings</span>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Member No</th>
                  <th>Member Name</th>
                  <th>Batches Delivered</th>
                  <th>Total Net Yield (KG)</th>
                  <th>Total Payout (KES)</th>
                </tr>
              </thead>
              <tbody>
                {memberCoffeeYields.map((yieldData, index) => (
                  <tr key={yieldData.member.id}>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'inherit',
                        }}
                      >
                        #{index + 1}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#38bdf8' }}>{yieldData.member.memberNo}</strong>
                    </td>
                    <td>
                      <strong>
                        {yieldData.member.firstName} {yieldData.member.lastName}
                      </strong>
                    </td>
                    <td>{yieldData.deliveryCount} batches</td>
                    <td>
                      <strong style={{ color: '#f97316', fontSize: '1.05rem' }}>
                        {yieldData.totalKg.toLocaleString()} kg
                      </strong>
                    </td>
                    <td style={{ color: '#34d399', fontWeight: 600 }}>
                      {formatMoney(yieldData.totalPayout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Financial Accounts / Income Statement */}
      {activeTab === 'accounts' && (
        <div className="grid grid-2" style={{ gap: '1.5rem' }}>
          <div className="card">
            <div className="card-title">
              <span style={{ color: '#34d399' }}>Cash Inflows</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Member Savings & Welfare:</span>
                <strong>{formatMoney(totalSavingsInflow)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Loan Interest Receivable:</span>
                <strong>{formatMoney(totalLoanInterestInflow)}</strong>
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <strong>Total Inflows:</strong>
                <strong style={{ color: '#34d399' }}>
                  {formatMoney(totalSavingsInflow + totalLoanInterestInflow)}
                </strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span style={{ color: '#f87171' }}>Cash Outflows</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Operating Overheads & Rentals:</span>
                <strong>{formatMoney(totalOperatingOutflows)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Loans Disbursed to Members:</span>
                <strong>{formatMoney(totalLoanDisbursed)}</strong>
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <strong>Total Outflows:</strong>
                <strong style={{ color: '#f87171' }}>
                  {formatMoney(totalOperatingOutflows + totalLoanDisbursed)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
