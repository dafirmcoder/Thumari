import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle2, ShieldCheck, Zap, Globe, ArrowRight } from 'lucide-react';

export const DownloadPage: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      alert('To install Thumari on this device, tap your browser menu (⋮ or Share icon) and choose "Add to Home screen" or "Install App".');
    }
  };

  return (
    <div style={{ maxWidth: 750, margin: '0 auto', textAlign: 'center', padding: '1rem 0' }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.4)',
        }}
      >
        <Smartphone size={40} color="#fff" />
      </div>

      <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Download Thumari for Android & Web</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', margin: '0.5rem auto 2rem auto', maxWidth: 540 }}>
        Experience Thumari as an installable standalone application with offline support, live camera OCR receipt scanning and real-time push alerts.
      </p>

      {/* Primary Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
        <button
          onClick={handleInstallPwa}
          className="btn btn-primary"
          style={{
            padding: '0.85rem 1.75rem',
            fontSize: '1rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#0284c7',
          }}
        >
          <Zap size={18} /> Install Web App (PWA)
        </button>

        <a
          href="/static/downloads/thumari-release.apk"
          download="thumari-release.apk"
          className="btn btn-secondary"
          style={{
            padding: '0.85rem 1.75rem',
            fontSize: '1rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          onClick={(e) => {
            alert('Android APK download will start! You can install the APK directly on your phone.');
          }}
        >
          <Download size={18} /> Direct APK Download
        </a>
      </div>

      {/* Feature Pillars */}
      <div className="grid grid-3" style={{ gap: '1rem', textAlign: 'left', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: '#10b981', marginBottom: '0.5rem' }}>
            <Zap size={24} />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>Instant Launch</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Launches in full screen without the browser URL bar, just like a native Android app.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: '#38bdf8', marginBottom: '0.5rem' }}>
            <Globe size={24} />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>Offline Access</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Works in rural farm locations with poor connectivity using Service Worker caching.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>
            <ShieldCheck size={24} />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>Camera OCR</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Scan cherry receipts directly on Android hardware with client-side OCR parsing.
          </p>
        </div>
      </div>

      {/* Installation Instructions */}
      <div className="card" style={{ textAlign: 'left', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>How to Install on Your Phone:</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div>
              <strong>Chrome / Edge on Android:</strong> Tap the <strong>Install Web App</strong> button above or tap the browser menu (⋮) and select <em>"Install app"</em>.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              2
            </div>
            <div>
              <strong>Safari on iPhone / iPad:</strong> Tap the <strong>Share</strong> button (box with upward arrow) at the bottom, scroll down and tap <em>"Add to Home Screen"</em>.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <strong>Android APK:</strong> Tap <strong>Direct APK Download</strong>, open the downloaded <code>.apk</code> file and tap <em>Install</em>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
