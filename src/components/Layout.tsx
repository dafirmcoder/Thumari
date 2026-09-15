import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Coffee,
  Landmark,
  Calendar,
  Receipt,
  Briefcase,
  PieChart,
  FileText,
  Download,
  LogOut,
  Smartphone,
  Menu,
  X,
  Camera,
} from 'lucide-react';
import { store } from '../services/store.js';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [user, setUser] = useState(store.getCurrentUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setUser(store.getCurrentUser());
    });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      unsub();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      navigate('/download');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleLogout = () => {
    store.logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/coffee/scan', label: 'Scan Coffee', icon: Camera, highlight: true },
    { to: '/members', label: 'Members', icon: Users },
    { to: '/contributions', label: 'Contributions', icon: Wallet },
    { to: '/coffee', label: 'Coffee Produce', icon: Coffee },
    { to: '/loans', label: 'Loans', icon: Landmark },
    { to: '/meetings', label: 'Meetings', icon: Calendar },
    { to: '/expenses', label: 'Expenses', icon: Receipt },
    { to: '/projects', label: 'Projects', icon: Briefcase },
    { to: '/dividends', label: 'Dividends', icon: PieChart },
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/download', label: 'Download App', icon: Download },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Top Navbar */}
      <header className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              padding: '0.25rem',
            }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <NavLink to="/dashboard" className="nav-brand">
            <img
              src="/images/logo.png"
              alt="Logo"
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span>Thumari</span>
            <span
              style={{
                fontSize: '0.65rem',
                background: '#0369a1',
                color: '#fff',
                padding: '0.1rem 0.4rem',
                borderRadius: 4,
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              PWA
            </span>
          </NavLink>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleInstallClick}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
          >
            <Smartphone size={14} />
            <span style={{ display: 'inline' }}>Install App</span>
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {user.role}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Log out"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  borderRadius: 6,
                  padding: '0.4rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm">
              Sign In
            </NavLink>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Desktop & Mobile Sidebar Drawer */}
        <nav
          style={{
            width: mobileMenuOpen ? '75%' : 240,
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--border-color)',
            padding: '1.25rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            transition: 'transform 0.2s ease-in-out',
            ...(mobileMenuOpen
              ? {
                  position: 'fixed',
                  top: 57,
                  bottom: 0,
                  left: 0,
                  zIndex: 90,
                  maxWidth: 280,
                  boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
                }
              : {
                  position: 'static',
                }),
          }}
        >

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.9rem',
                  color: isActive
                    ? '#38bdf8'
                    : item.highlight
                    ? '#34d399'
                    : 'var(--text-muted)',
                  background: isActive ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  border: item.highlight ? '1px dashed rgba(52, 211, 153, 0.3)' : 'none',
                })}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              top: 57,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 80,
            }}
          />
        )}

        {/* Main Content Area */}
        <main className="container" style={{ padding: '1.5rem 1rem 4rem 1rem' }}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0.5rem 0.25rem',
          zIndex: 70,
        }}
      >
        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '0.7rem',
            color: isActive ? '#38bdf8' : 'var(--text-muted)',
            gap: 2,
          })}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/coffee/scan"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '0.7rem',
            color: isActive ? '#34d399' : '#10b981',
            gap: 2,
            fontWeight: 700,
          })}
        >
          <Camera size={20} />
          <span>Scan</span>
        </NavLink>
        <NavLink
          to="/contributions"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '0.7rem',
            color: isActive ? '#38bdf8' : 'var(--text-muted)',
            gap: 2,
          })}
        >
          <Wallet size={20} />
          <span>Savings</span>
        </NavLink>
        <NavLink
          to="/loans"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '0.7rem',
            color: isActive ? '#38bdf8' : 'var(--text-muted)',
            gap: 2,
          })}
        >
          <Landmark size={20} />
          <span>Loans</span>
        </NavLink>
        <NavLink
          to="/members"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '0.7rem',
            color: isActive ? '#38bdf8' : 'var(--text-muted)',
            gap: 2,
          })}
        >
          <Users size={20} />
          <span>Members</span>
        </NavLink>
      </footer>
    </div>
  );
};
