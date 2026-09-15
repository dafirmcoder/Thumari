import React from 'react';
import { X, Printer } from 'lucide-react';
import { formatMoney } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import type { Contribution } from '../types.js';

interface ReceiptModalProps {
  contribution: Contribution | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ contribution, onClose }) => {
  if (!contribution) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0284c7', fontSize: '1.5rem', fontWeight: 800 }}>THUMARI CHAMA</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Official Contribution Receipt</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            borderTop: '2px dashed #e2e8f0',
            borderBottom: '2px dashed #e2e8f0',
            padding: '1rem 0',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Receipt Ref:</span>
            <strong>{contribution.reference || `REC-${contribution.id.toString().padStart(5, '0')}`}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Date & Time:</span>
            <span>{formatDate(contribution.paidAt)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Member Name:</span>
            <strong>{contribution.memberName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Contribution Type:</span>
            <span>{contribution.typeName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Payment Method:</span>
            <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{contribution.method}</span>
          </div>
          {contribution.period && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Target Period:</span>
              <span>{contribution.period}</span>
            </div>
          )}
          {contribution.notes && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Notes:</span>
              <span>{contribution.notes}</span>
            </div>
          )}
        </div>

        <div
          style={{
            background: '#f8fafc',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Amount Received
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
            {formatMoney(contribution.amountCents)}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
          Thank you for your active participation and prompt contributions to Thumari Chama.
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handlePrint}
            style={{
              flex: 1,
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.65rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Printer size={16} />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: '#e2e8f0',
              color: '#334155',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.65rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
