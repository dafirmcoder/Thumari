import React, { useState, useEffect } from 'react';
import { PieChart, Calculator, DollarSign, CheckCircle2, Award } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import type { Member, Contribution, CoffeeProduce } from '../types.js';

export const Dividends: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(store.getMembers());
  const [contributions, setContributions] = useState<Contribution[]>(store.getContributions());
  const [produce, setProduce] = useState<CoffeeProduce[]>(store.getCoffeeProduce());

  // Dividend Calculator Settings
  const [financialYear, setFinancialYear] = useState(2025);
  const [surplusKes, setSurplusKes] = useState<number>(500000);
  const [payoutRatioPercent, setPayoutRatioPercent] = useState<number>(80);
  const [basis, setBasis] = useState<'savings' | 'produce'>('savings');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setMembers(store.getMembers());
      setContributions(store.getContributions());
      setProduce(store.getCoffeeProduce());
    });
    return unsub;
  }, []);

  const totalPoolKes = (surplusKes * payoutRatioPercent) / 100;

  // Calculate Member Stakes
  const memberDistributions = members.map((m) => {
    let stakeMetric = 0;
    if (basis === 'savings') {
      stakeMetric = contributions
        .filter((c) => c.memberId === m.id)
        .reduce((sum, c) => sum + c.amountCents / 100, 0);
    } else {
      stakeMetric = produce
        .filter((p) => p.memberId === m.id)
        .reduce((sum, p) => sum + p.netKg, 0);
    }
    return {
      member: m,
      stakeMetric,
    };
  });

  const totalMetric = memberDistributions.reduce((sum, item) => sum + item.stakeMetric, 0);

  const results = memberDistributions.map((item) => {
    const sharePercent = totalMetric > 0 ? (item.stakeMetric / totalMetric) * 100 : 0;
    const dividendKes = totalMetric > 0 ? (item.stakeMetric / totalMetric) * totalPoolKes : 0;
    return {
      member: item.member,
      metric: item.stakeMetric,
      sharePercent,
      dividendCents: Math.round(dividendKes * 100),
    };
  });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>🥧 Annual Dividend Calculator</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
          Compute member annual dividend distributions based on savings equity or coffee cherry delivery volumes.
        </p>
      </div>

      {/* Configuration Controls */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="grid grid-4" style={{ gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Financial Year</label>
            <select
              className="form-control"
              value={financialYear}
              onChange={(e) => setFinancialYear(Number(e.target.value))}
            >
              <option value={2026}>FY 2026</option>
              <option value={2025}>FY 2025</option>
              <option value={2024}>FY 2024</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Net Surplus (KES)</label>
            <input
              type="number"
              step="10000"
              className="form-control"
              value={surplusKes}
              onChange={(e) => setSurplusKes(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Payout Ratio (%)</label>
            <input
              type="number"
              min="10"
              max="100"
              className="form-control"
              value={payoutRatioPercent}
              onChange={(e) => setPayoutRatioPercent(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Distribution Basis</label>
            <select
              className="form-control"
              value={basis}
              onChange={(e) => setBasis(e.target.value as any)}
            >
              <option value="savings">Accumulated Savings</option>
              <option value="produce">Coffee Produce (kg)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-box">
          <div className="stat-label">Total Dividend Payout Pool</div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {formatMoney(Math.round(totalPoolKes * 100))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {payoutRatioPercent}% of {formatMoney(Math.round(surplusKes * 100))} surplus
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Eligible Members</div>
          <div className="stat-value">{members.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Active shareholding participants
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Total Pool Metric</div>
          <div className="stat-value" style={{ color: '#38bdf8' }}>
            {basis === 'savings'
              ? formatMoney(Math.round(totalMetric * 100))
              : `${totalMetric.toLocaleString()} kg`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Pro-rata calculation denominator
          </div>
        </div>
      </div>

      {/* Payout Distribution Register */}
      <div className="card">
        <div className="card-title">
          <span>Member Dividend Allocation Schedule</span>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Member No</th>
                <th>Member Name</th>
                <th>{basis === 'savings' ? 'Accumulated Savings' : 'Coffee Delivered'}</th>
                <th>Pro-rata Share</th>
                <th>Dividend Payout</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.member.id}>
                  <td>
                    <strong style={{ color: '#38bdf8' }}>{r.member.memberNo}</strong>
                  </td>
                  <td>
                    <strong>
                      {r.member.firstName} {r.member.lastName}
                    </strong>
                  </td>
                  <td>
                    {basis === 'savings'
                      ? formatMoney(Math.round(r.metric * 100))
                      : `${r.metric.toLocaleString()} kg`}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{r.sharePercent.toFixed(2)}%</span>
                  </td>
                  <td>
                    <strong style={{ color: '#34d399', fontSize: '1.05rem' }}>
                      {formatMoney(r.dividendCents)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
