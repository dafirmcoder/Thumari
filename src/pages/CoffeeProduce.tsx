import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coffee, Camera, Plus, Search, CheckCircle2, TrendingUp, DollarSign } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import type { CoffeeProduce as ProduceType, CoffeeRate, Member } from '../types.js';

export const CoffeeProduce: React.FC = () => {
  const [produce, setProduce] = useState<ProduceType[]>(store.getCoffeeProduce());
  const [rates, setRates] = useState<CoffeeRate[]>(store.getCoffeeRates());
  const [members, setMembers] = useState<Member[]>(store.getMembers());
  const [memberFilter, setMemberFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setProduce(store.getCoffeeProduce());
      setRates(store.getCoffeeRates());
      setMembers(store.getMembers());
    });
    return unsub;
  }, []);

  const filteredProduce = produce.filter((p) => {
    return memberFilter === 'all' || p.memberId === memberFilter;
  });

  const totalKg = filteredProduce.reduce((sum, p) => sum + p.netKg, 0);
  const totalPayoutCents = filteredProduce.reduce((sum, p) => sum + p.payoutCents, 0);

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
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>☕ Coffee Produce Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Track member cherry deliveries, OCR factory receipts, cherry rates and seasonal payouts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            to="/coffee/scan"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#059669', borderColor: '#059669' }}
          >
            <Camera size={16} /> Scan Factory Receipt
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-box">
          <div className="stat-label">Total Coffee Delivered</div>
          <div className="stat-value" style={{ color: '#f97316' }}>
            {totalKg.toLocaleString()} kg
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Across {filteredProduce.length} factory weighings
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Total Crop Value / Payout</div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {formatMoney(totalPayoutCents)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Estimated seasonal payments
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Current Main Crop Rate</div>
          <div className="stat-value" style={{ color: '#38bdf8' }}>
            {formatMoney(rates[0]?.ratePerKgCents || 12000)} / kg
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {rates[0]?.season || '2025/2026 Main Season'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter by Member:</label>
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
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {filteredProduce.length} delivery records
          </div>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt Slip</th>
                <th>Member</th>
                <th>Grower No</th>
                <th>Factory / Society</th>
                <th>Net Weight</th>
                <th>Rate/kg</th>
                <th>Total Payout</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {filteredProduce.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No coffee produce records found. Tap <strong>Scan Factory Receipt</strong> above to add one.
                  </td>
                </tr>
              ) : (
                filteredProduce.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.deliveryDate)}</td>
                    <td>
                      <code style={{ color: '#38bdf8' }}>{p.receiptNo}</code>
                    </td>
                    <td>
                      <strong>{p.memberName}</strong>
                    </td>
                    <td>{p.growerNo || '—'}</td>
                    <td>
                      <div>{p.factoryName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.societyName}</div>
                    </td>
                    <td>
                      <strong style={{ color: '#f97316' }}>{p.netKg.toLocaleString()} kg</strong>
                    </td>
                    <td>{formatMoney(p.ratePerKgCents)}</td>
                    <td style={{ color: '#34d399', fontWeight: 600 }}>{formatMoney(p.payoutCents)}</td>
                    <td>
                      <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                        <CheckCircle2 size={14} /> OK
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
