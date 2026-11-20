import { useState } from 'react';
import { BookingPage } from './pages/BookingPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  const [view, setView] = useState('booking'); // 'booking' ou 'admin'

  return (
    <>
      <header className="navbar">
        <h1>Studio Beleza • Agendamentos</h1>
        <nav className="nav-tabs">
          <button
            className={`btn btn-outline ${view === 'booking' ? 'active' : ''}`}
            onClick={() => setView('booking')}
          >
            Área do Cliente
          </button>
          <button
            className={`btn btn-outline ${view === 'admin' ? 'active' : ''}`}
            onClick={() => setView('admin')}
          >
            Painel do Salão
          </button>
        </nav>
      </header>

      <main className="container">
        {view === 'booking' ? <BookingPage /> : <AdminPage />}
      </main>
    </>
  );
}