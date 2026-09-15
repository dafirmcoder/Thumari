import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, ArrowRight, User } from 'lucide-react';
import { store } from '../services/store.js';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@thumari.local');
  const [password, setPassword] = useState('Admin@12345');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.login(email);
    navigate('/dashboard');
  };

  const handleDemoAdmin = () => {
    store.login('admin@thumari.local');
    navigate('/dashboard');
  };

  const handleDemoTreasurer = () => {
    store.login('treasurer@thumari.local');
    navigate('/dashboard');
  };

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img
          src="/images/logo.png"
          alt="Thumari"
          style={{ width: 56, height: 56, borderRadius: 14, margin: '0 auto 1rem auto', objectFit: 'contain' }}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Sign In to Thumari</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
          Group Savings & Loan Management System
        </p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontWeight: 700,
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Sign In</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Quick Demo Credentials
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleDemoAdmin}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: '0.8rem' }}
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={handleDemoTreasurer}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: '0.8rem' }}
            >
              💼 Treasurer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
