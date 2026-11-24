import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import ThemeCustomize from './components/ThemeCustomize';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            <App />
            <ThemeCustomize />
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'text-sm',
                style: {
                  borderRadius: '10px',
                  background: '#0f172a',
                  color: '#f8fafc',
                  padding: '10px 14px',
                },
                success: {
                  iconTheme: { primary: '#22c55e', secondary: '#0f172a' },
                },
                error: {
                  iconTheme: { primary: '#f87171', secondary: '#0f172a' },
                },
              }}
            />
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
