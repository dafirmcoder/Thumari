import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Members } from './pages/Members.js';
import { MemberDetail } from './pages/MemberDetail.js';
import { Contributions } from './pages/Contributions.js';
import { CoffeeProduce } from './pages/CoffeeProduce.js';
import { CoffeeScanner } from './pages/CoffeeScanner.js';
import { Loans } from './pages/Loans.js';
import { Meetings } from './pages/Meetings.js';
import { Expenses } from './pages/Expenses.js';
import { Projects } from './pages/Projects.js';
import { Dividends } from './pages/Dividends.js';
import { Reports } from './pages/Reports.js';
import { DownloadPage } from './pages/Download.js';
import { Login } from './pages/Login.js';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<MemberDetail />} />
              <Route path="/contributions" element={<Contributions />} />
              <Route path="/coffee" element={<CoffeeProduce />} />
              <Route path="/coffee/scan" element={<CoffeeScanner />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/dividends" element={<Dividends />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/download" element={<DownloadPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
};
