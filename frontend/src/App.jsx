import React, { useState, useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import CalendarPage from './pages/Calendar';
import EmailPage from './pages/EmailPage';
import BookingPage from './pages/BookingPage';
import AgentPage from './pages/Agent';
import Studio from './pages/Studio';
import Diffusion from './pages/Diffusion';

const GUEST_USER = { username: 'guest', role: 'admin' };

function getBookingUsername() {
  if (window.location.pathname.startsWith('/book/')) {
    return window.location.pathname.split('/book/')[1]?.replace(/\/$/, '') || null;
  }
  return null;
}

const bookingUsername = getBookingUsername();

function getInitialPage() {
  const path = window.location.pathname;
  if (path === '/calendar') return 'calendar';
  if (path === '/email') return 'email';
  if (path === '/admin') return 'admin';
  if (path === '/agent') return 'agent';
  if (path === '/studio') return 'studio';
  if (path === '/diffusion') return 'diffusion';
  return 'chat';
}

function MainApp() {
  const [page, setPageState] = useState(getInitialPage);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const user = GUEST_USER;

  const setPage = (newPage) => {
    const path = newPage === 'chat' ? '/' : `/${newPage}`;
    window.history.pushState({ page: newPage }, '', path);
    setPageState(newPage);
  };

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state?.page) setPageState(e.state.page);
      else setPageState(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ page: getInitialPage() }, '', window.location.pathname);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const commonProps = { user, theme, onToggleTheme: toggleTheme };

  return (
    <>
      {page === 'diffusion' ? (
        <Diffusion {...commonProps} onGoChat={() => setPage('chat')} onGoAdmin={() => setPage('admin')} onGoStudio={() => setPage('studio')} onGoAgent={() => setPage('agent')} />
      ) : page === 'studio' ? (
        <Studio {...commonProps} onGoChat={() => setPage('chat')} onGoAdmin={() => setPage('admin')} onGoCalendar={() => setPage('calendar')} />
      ) : page === 'agent' ? (
        <AgentPage {...commonProps} onGoChat={() => setPage('chat')} onGoCalendar={() => setPage('calendar')} onGoAdmin={() => setPage('admin')} />
      ) : page === 'calendar' ? (
        <CalendarPage {...commonProps} onGoChat={() => setPage('chat')} onGoAdmin={() => setPage('admin')} onGoEmail={() => setPage('email')} />
      ) : page === 'email' ? (
        <EmailPage {...commonProps} onGoChat={() => setPage('chat')} onGoCalendar={() => setPage('calendar')} onGoAdmin={() => setPage('admin')} />
      ) : page === 'admin' ? (
        <Admin {...commonProps} onGoChat={() => setPage('chat')} onGoCalendar={() => setPage('calendar')} onGoEmail={() => setPage('email')} />
      ) : (
        <Chat {...commonProps} onGoAdmin={() => setPage('admin')} onGoCalendar={() => setPage('calendar')} onGoEmail={() => setPage('email')} onGoAgent={() => setPage('agent')} onGoStudio={() => setPage('studio')} onGoDiffusion={() => setPage('diffusion')} />
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      {bookingUsername ? <BookingPage username={bookingUsername} /> : <MainApp />}
    </ToastProvider>
  );
}
