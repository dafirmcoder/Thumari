import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, TrendingUp, CheckCircle2, DollarSign } from 'lucide-react';
import { store } from '../services/store.js';
import { formatMoney } from '../lib/money.js';
import type { Project } from '../types.js';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(store.getProjects());
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetBudgetKes, setTargetBudgetKes] = useState<number>(1000000);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setProjects(store.getProjects());
    });
    return unsub;
  }, []);

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    store.addProject({
      name,
      description,
      targetBudgetCents: Math.round(Number(targetBudgetKes) * 100),
      status: 'active',
      startDate: startDate || null,
      endDate: endDate || null,
    });
    setShowAddModal(false);
    setName('');
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
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>💼 Investment Projects</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Group capital investments, asset acquisition, budgets, expenditures and project dividends.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> New Investment Project
        </button>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        {projects.map((p) => {
          const progressPercent = Math.min(
            100,
            Math.round((p.currentSpentCents / (p.targetBudgetCents || 1)) * 100)
          );

          return (
            <div key={p.id} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#38bdf8' }}>{p.name}</h3>
                <span
                  className="badge"
                  style={{
                    background: p.status === 'active' ? '#10b981' : '#0284c7',
                    textTransform: 'capitalize',
                  }}
                >
                  {p.status}
                </span>
              </div>

              {p.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.75rem 0' }}>
                  {p.description}
                </p>
              )}

              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Budget Allocated / Spent:</span>
                  <strong>{progressPercent}%</strong>
                </div>
                <div
                  style={{
                    height: 8,
                    background: 'var(--bg-input)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: '#0284c7',
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Budget</div>
                  <strong style={{ color: '#fff' }}>{formatMoney(p.targetBudgetCents)}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Spent</div>
                  <strong style={{ color: '#34d399' }}>{formatMoney(p.currentSpentCents)}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Project Modal */}
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
              <span>Initiate Investment Project</span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProject}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Commercial Plot Purchase"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Budget (KES) *</label>
                <input
                  type="number"
                  step="10000"
                  className="form-control"
                  value={targetBudgetKes}
                  onChange={(e) => setTargetBudgetKes(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Objectives</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Asset description and expected returns..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Project
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
