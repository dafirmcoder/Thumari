import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { store } from '../services/store.js';
import { extractReceiptData, type ExtractedReceiptData } from '../lib/ocr-receipt.js';
import { formatMoney } from '../lib/money.js';
import type { Member } from '../types.js';


export const CoffeeScanner: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(store.getMembers());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [ocrResult, setOcrResult] = useState<ExtractedReceiptData | null>(null);

  // Form Fields for Confirmation
  const [memberId, setMemberId] = useState<number>(1);
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [receiptNo, setReceiptNo] = useState('');
  const [societyName, setSocietyName] = useState("Rung'eto Farmers Co-op Society");
  const [factoryName, setFactoryName] = useState('Kii Factory');
  const [growerNo, setGrowerNo] = useState('');
  const [grossKg, setGrossKg] = useState<number>(0);
  const [tareKg, setTareKg] = useState<number>(0);
  const [netKg, setNetKg] = useState<number>(0);
  const [ratePerKg, setRatePerKg] = useState<number>(120);
  const [notes, setNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setMembers(store.getMembers());
    });
    return unsub;
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setOcrResult(null);
        setSavedSuccess(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunOcr = async () => {
    if (!selectedImage) return;

    setScanning(true);
    setProgress(10);
    setStatusMessage('Initializing OCR engine...');

    try {
      const extracted = await extractReceiptData(
        selectedImage,
        members as any,
        (prog: number, status: string) => {
          setProgress(Math.round(prog * 100));
          setStatusMessage(status);
        }

      );

      setOcrResult(extracted);
      setStatusMessage('Receipt successfully analyzed!');

      // Populate form
      if (extracted.matchedMemberId) {
        setMemberId(extracted.matchedMemberId);
      }
      if (extracted.receiptNo) {
        setReceiptNo(extracted.receiptNo);
      } else {
        setReceiptNo(`RCP-${Math.floor(1000 + Math.random() * 9000)}`);
      }
      if (extracted.receiptDate) {
        setDeliveryDate(extracted.receiptDate);
      }
      if (extracted.societyName) {
        setSocietyName(extracted.societyName);
      }
      if (extracted.factoryName) {
        setFactoryName(extracted.factoryName);
      }
      if (extracted.factoryGrowerNo) {
        setGrowerNo(extracted.factoryGrowerNo);
      }
      if (extracted.grossKg) {
        setGrossKg(extracted.grossKg);
      }
      if (extracted.tareKg) {
        setTareKg(extracted.tareKg);
      }
      if (extracted.netKg) {
        setNetKg(extracted.netKg);
      } else if (extracted.grossKg && extracted.tareKg) {
        setNetKg(Math.max(0, extracted.grossKg - extracted.tareKg));
      }
      if (extracted.ratePerKg) {
        setRatePerKg(extracted.ratePerKg);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setStatusMessage('OCR reading encountered an issue. You can enter details manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleLoadSampleReceipt = () => {
    // Generate sample receipt canvas
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 24px monospace';
      ctx.fillText("RUNG'ETO FARMERS CO-OP SOCIETY", 40, 50);
      ctx.font = 'bold 20px monospace';
      ctx.fillText('KII FACTORY - CHERRY RECEIPT', 80, 85);
      ctx.font = '16px monospace';
      ctx.fillText('=========================================', 30, 115);
      ctx.fillText(`Receipt No: RCP-KII-${Math.floor(1000 + Math.random() * 9000)}`, 40, 150);
      ctx.fillText(`Date: ${new Date().toISOString().split('T')[0]}`, 40, 180);
      ctx.fillText('Grower No: FCS-0142', 40, 210);
      ctx.fillText('Member: JOHN MAINA', 40, 240);
      ctx.fillText('-----------------------------------------', 30, 270);
      ctx.fillText('Cherry Type: MAIN CROP AA/AB', 40, 300);
      ctx.fillText('Gross Weight:   415.0 KG', 40, 340);
      ctx.fillText('Tare Weight:      5.0 KG', 40, 370);
      ctx.fillText('Net Weight:     410.0 KG', 40, 400);
      ctx.fillText('Rate / KG:    KES 120.00', 40, 430);
      ctx.fillText('-----------------------------------------', 30, 460);
      ctx.fillText('ESTIMATED PAYOUT: KES 49,200.00', 40, 500);
      ctx.fillText('=========================================', 30, 540);
      ctx.font = 'italic 14px monospace';
      ctx.fillText('Weighed By: Clerk N. Gitau', 40, 580);
      ctx.fillText('Thank you for delivering quality cherry!', 40, 610);
    }
    const sampleDataUrl = canvas.toDataURL('image/png');
    setSelectedImage(sampleDataUrl);
    setOcrResult(null);
    setSavedSuccess(false);
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveNetKg = netKg > 0 ? netKg : Math.max(0, grossKg - tareKg);
    const payoutCents = Math.round(effectiveNetKg * ratePerKg * 100);

    store.addCoffeeProduce({
      memberId: Number(memberId),
      deliveryDate,
      receiptNo: receiptNo || `RCP-${Date.now().toString().slice(-4)}`,
      societyName,
      factoryName,
      growerNo,
      grossKg,
      tareKg,
      netKg: effectiveNetKg,
      ratePerKgCents: Math.round(ratePerKg * 100),
      payoutCents,
      receiptImageUrl: selectedImage,
      notes,
      verified: true,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      navigate('/coffee');
    }, 1500);
  };

  return (
    <div style={{ maxWidth: 850, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>📷 Scan Coffee Delivery Receipt</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
          Capture or upload factory delivery slips for automated OCR data extraction and payment calculations.
        </p>
      </div>

      {savedSuccess && (
        <div className="flash-alert flash-success" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={20} />
          <span>Coffee delivery receipt saved successfully! Redirecting to Produce Ledger...</span>
        </div>
      )}

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        {/* Step 1: Capture / Upload */}
        <div className="card">
          <div className="card-title">
            <span>1. Capture or Select Receipt</span>
          </div>

          <div
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              marginBottom: '1rem',
            }}
          >
            {selectedImage ? (
              <img
                src={selectedImage}
                alt="Receipt preview"
                style={{
                  maxHeight: 280,
                  maxWidth: '100%',
                  borderRadius: '0.375rem',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                <Camera size={48} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                <p style={{ margin: '0.25rem 0', fontWeight: 500 }}>Upload Receipt Image</p>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>Supports JPG, PNG photos taken with phone camera</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
            >
              <Upload size={14} /> Choose File
              <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>

            <button
              type="button"
              onClick={handleLoadSampleReceipt}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <FileText size={14} /> Load Demo Slip
            </button>
          </div>

          {selectedImage && (
            <button
              onClick={handleRunOcr}
              disabled={scanning}
              className="btn btn-primary"
              style={{
                width: '100%',
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {scanning ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Processing OCR ({progress}%)...
                </>
              ) : (
                <>
                  <Camera size={16} /> Run OCR Scanner
                </>
              )}
            </button>
          )}

          {scanning && (
            <div style={{ marginTop: '1rem' }}>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-input)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: '#0284c7',
                    width: `${progress}%`,
                    transition: 'width 0.2s',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {statusMessage}
              </div>
            </div>
          )}

          {ocrResult && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ fontWeight: 600, color: '#34d399', marginBottom: '0.25rem' }}>
                OCR Confidence: {ocrResult.confidence}%
              </div>
              <div>Matched Member: <strong>{ocrResult.matchedMemberName || 'None'}</strong></div>
              <div>Net Weight: <strong>{ocrResult.netKg || (ocrResult.grossKg && ocrResult.tareKg ? ocrResult.grossKg - ocrResult.tareKg : 0)} KG</strong></div>
            </div>
          )}
        </div>

        {/* Step 2: Confirmation & Save */}
        <div className="card">
          <div className="card-title">
            <span>2. Confirm & Save Produce Delivery</span>
          </div>

          <form onSubmit={handleSaveDelivery}>
            <div className="form-group">
              <label className="form-label">Member / Grower *</label>
              <select
                className="form-control"
                value={memberId}
                onChange={(e) => setMemberId(Number(e.target.value))}
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNo} — {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-2" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Receipt Slip No *</label>
                <input
                  type="text"
                  className="form-control"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="e.g. RCP-KII-8492"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Co-op Society</label>
                <input
                  type="text"
                  className="form-control"
                  value={societyName}
                  onChange={(e) => setSocietyName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Factory</label>
                <input
                  type="text"
                  className="form-control"
                  value={factoryName}
                  onChange={(e) => setFactoryName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-3" style={{ gap: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label">Gross (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={grossKg || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setGrossKg(val);
                    setNetKg(Math.max(0, val - tareKg));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tare (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={tareKg || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setTareKg(val);
                    setNetKg(Math.max(0, grossKg - val));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Net Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={netKg || ''}
                  onChange={(e) => setNetKg(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payout Rate per KG (KES)</label>
              <input
                type="number"
                step="0.5"
                className="form-control"
                value={ratePerKg}
                onChange={(e) => setRatePerKg(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div
              style={{
                padding: '0.75rem',
                background: 'var(--bg-input)',
                borderRadius: '0.375rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Payout:</span>
              <strong style={{ fontSize: '1.25rem', color: '#34d399' }}>
                {formatMoney(Math.round((netKg || (grossKg - tareKg)) * ratePerKg * 100))}
              </strong>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
            >
              ✓ Confirm & Record Delivery
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
