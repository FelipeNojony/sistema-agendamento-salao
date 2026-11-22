import { useState, useEffect } from 'react';
import { api } from './services/api';
import { DashboardPage } from './pages/DashboardPage';
import { BookingPage } from './pages/BookingPage';

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function App() {
  // 1. Controle de Tema (Light / Dark) persistido no navegador
  const [theme, setTheme] = useState(() => localStorage.getItem('salon_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('salon_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  // 2. Separação estrita de rotas ('/admin' vs '/client') sincronizada com a URL
  const getRouteFromPath = () => {
    const path = window.location.pathname.toLowerCase();
    return path === '/admin' || path.startsWith('/admin/') ? 'admin' : 'client';
  };

  const [route, setRoute] = useState(getRouteFromPath);

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/client');
    }

    const handlePopState = () => setRoute(getRouteFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Estados de Autenticação e Gestão
  const [token, setToken] = useState(localStorage.getItem('salon_token'));
  const [activeNav, setActiveNav] = useState('dashboard');
  const [salons, setSalons] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState(() => localStorage.getItem('salon_selected_id') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickBooking, setShowQuickBooking] = useState(false);

  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [feedback, setFeedback] = useState(null);

  const [salonForm, setSalonForm] = useState({ name: '', slug: '', address: '', phone: '' });
  const [editingSalonId, setEditingSalonId] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', duration_minutes: 30, price: 60 });
  const [profForm, setProfForm] = useState({ name: '', specialty: '' });
  const [hoursForm, setHoursForm] = useState({ day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: false });
  const [blockForm, setBlockForm] = useState({ start_datetime: '', end_datetime: '', reason: '' });

  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem('salon_user_name');
    if (saved) return saved;
    const savedToken = localStorage.getItem('salon_token');
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        return payload.name || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  // Extrai apenas o primeiro nome (ex: "Felipe Santos" -> "Felipe")
  const firstName = userName ? userName.trim().split(/\s+/)[0] : 'Gestor';

  // Nome da unidade vinculada/selecionada para exibição fixa no cabeçalho
  const currentSalonName =
    salons.find((s) => s.id === selectedSalon)?.name || salons[0]?.name || 'Minha Unidade';

  useEffect(() => {
    loadSalons();
  }, [token]);

  async function loadSalons() {
    try {
      const res = await api.getSalons();
      const list = res.salons || [];
      setSalons(list);

      if (list.length > 0) {
        const stillExists = list.some((s) => s.id === selectedSalon);
        if (!selectedSalon || !stillExists) {
          setSelectedSalon(list[0].id);
          localStorage.setItem('salon_selected_id', list[0].id);
        }
      } else {
        setSelectedSalon('');
        localStorage.removeItem('salon_selected_id');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelectSalon(salonId) {
    setSelectedSalon(salonId);
    if (salonId) {
      localStorage.setItem('salon_selected_id', salonId);
    } else {
      localStorage.removeItem('salon_selected_id');
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setFeedback(null);
    try {
      let registeredName = '';
      if (isRegistering) {
        const regRes = await api.register(authForm);
        registeredName = regRes?.user?.name || authForm.name;
      }
      const res = await api.login({ email: authForm.email, password: authForm.password });
      localStorage.setItem('salon_token', res.token);
      setToken(res.token);

      if (selectedSalon) {
        localStorage.setItem('salon_selected_id', selectedSalon);
      }

      // Descobre o nome vindo da API, do cadastro ou de dentro do JWT
      let resolvedName = res?.user?.name || registeredName;
      if (!resolvedName && res.token) {
        try {
          const payload = JSON.parse(atob(res.token.split('.')[1]));
          resolvedName = payload.name || '';
        } catch {}
      }
      if (resolvedName) {
        localStorage.setItem('salon_user_name', resolvedName);
        setUserName(resolvedName);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  function handleLogout() {
    localStorage.removeItem('salon_token');
    localStorage.removeItem('salon_user_name');
    setToken(null);
    setUserName('');
  }

  async function handleDeleteSalon(salon) {
    const confirmed = window.confirm(
      `Tem certeza que deseja cancelar o cadastro da unidade "${salon.name}"?\nEssa ação removerá os dados vinculados a ela.`
    );
    if (!confirmed) return;

    setFeedback(null);
    try {
      await api.deleteSalon(salon.id);
      if (editingSalonId === salon.id) {
        setEditingSalonId(null);
        setSalonForm({ name: '', slug: '', address: '', phone: '' });
      }
      setFeedback({ type: 'success', text: `Cadastro da unidade "${salon.name}" removido com sucesso!` });
      await loadSalons();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  // ==========================================================================
  // AMBIENTE 1: PORTAL EXCLUSIVO DO CLIENTE (/client) - SEM VÍNCULO COM ADMIN
  // ==========================================================================
  if (route === 'client') {
    return (
      <div className="client-portal-shell">
        <header className="client-navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="sidebar-logo">S</div>
            <div>
              <strong style={{ fontSize: '1.1rem', display: 'block', lineHeight: 1.1 }}>SalonFlow</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Agendamento Online</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>

        <div style={{ padding: '0 1.25rem' }}>
          <BookingPage />
        </div>
      </div>
    );
  }

  // ==========================================================================
  // AMBIENTE 2A: TELA DE LOGIN / CADASTRO DO GESTOR (/admin sem token)
  // ==========================================================================
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <div className="dash-card" style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="sidebar-logo">S</div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Acesso Administrativo</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Painel de Gestão Multi-Salões</p>
            </div>
          </div>

          {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

          <form onSubmit={handleAuth}>
            {!isRegistering && (
              <div className="form-group">
                <label>Unidade / Salão</label>
                {salons.length > 0 ? (
                  <select
                    required
                    value={selectedSalon}
                    onChange={(e) => handleSelectSalon(e.target.value)}
                  >
                    {salons.map((s) => (
                      <option key={s.id} value={s.id}>
                        🏢 {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Nenhuma unidade cadastrada ainda. Entre para cadastrar a primeira.
                  </div>
                )}
              </div>
            )}

            {isRegistering && (
              <div className="form-group">
                <label>Nome do Gestor</label>
                <input
                  required
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  placeholder="Ex: Felipe Santos"
                />
              </div>
            )}
            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                required
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                placeholder="admin@salao.com"
              />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                required
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              {isRegistering ? 'Criar Conta e Entrar' : 'Entrar no Dashboard'}
            </button>
          </form>

          <button
            className="btn btn-outline"
            style={{ width: '100%', marginTop: '0.75rem' }}
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? 'Já tenho conta (Fazer Login)' : 'Criar nova conta'}
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // AMBIENTE 2B: DASHBOARD ADMINISTRATIVO AUTENTICADO (/admin com token)
  // ==========================================================================
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">S</div>
        <nav className="sidebar-nav">
          <button
            title="Dashboard"
            className={`sidebar-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveNav('dashboard')}
          >
            📊
          </button>
          <button
            title="Serviços e Colaboradores"
            className={`sidebar-item ${activeNav === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveNav('catalog')}
          >
            ✂️
          </button>
          <button
            title="Horários e Bloqueios"
            className={`sidebar-item ${activeNav === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveNav('schedule')}
          >
            🕒
          </button>
          <button
            title="Unidades / Multi-Salões"
            className={`sidebar-item ${activeNav === 'salons' ? 'active' : ''}`}
            onClick={() => setActiveNav('salons')}
          >
            🏢
          </button>
        </nav>
      </aside>

      <div className="main-area">
        <header
          className="topbar"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr minmax(280px, 460px) 1fr',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {/* ESQUERDA: Nome do Salão em destaque (negrito e fonte maior, sem dropdown) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', justifySelf: 'start' }}>
            <span style={{ fontSize: '1.4rem' }}>🏢</span>
            <strong
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {currentSalonName}
            </strong>
          </div>

          {/* CENTRO: Search Bar centralizada */}
          <div className="search-box" style={{ width: '100%', maxWidth: '100%', justifySelf: 'center' }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por cliente, telefone ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* DIREITA: Tema e Botão Sair */}
          <div className="topbar-right" style={{ justifySelf: 'end' }}>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            <button className="user-pill" onClick={handleLogout} title="Sair do painel">
              <div className="user-avatar">{firstName.slice(0, 2).toUpperCase()}</div>
              <span>Sair</span>
            </button>
          </div>
        </header>

        <main className="page-container">
          {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

          {activeNav === 'dashboard' && (
            <DashboardPage
              selectedSalon={selectedSalon}
              searchTerm={searchTerm}
              userName={firstName}
              onOpenBookingModal={() => setShowQuickBooking(true)}
            />
          )}

          {activeNav === 'catalog' && (
            <div className="form-grid">
              <form
                className="dash-card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api.createService(selectedSalon, {
                    ...serviceForm,
                    duration_minutes: Number(serviceForm.duration_minutes),
                    price: Number(serviceForm.price),
                  });
                  setServiceForm({ name: '', description: '', duration_minutes: 30, price: 60 });
                  setFeedback({ type: 'success', text: 'Serviço cadastrado com sucesso!' });
                }}
              >
                <h3 style={{ marginBottom: '1rem' }}>Cadastrar Novo Serviço</h3>
                <div className="form-group">
                  <label>Nome do Serviço</label>
                  <input required value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <input value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Duração (minutos)</label>
                    <input
                      type="number"
                      required
                      value={serviceForm.duration_minutes}
                      onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  Salvar Serviço
                </button>
              </form>

              <form
                className="dash-card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api.createProfessional(selectedSalon, profForm);
                  setProfForm({ name: '', specialty: '' });
                  setFeedback({ type: 'success', text: 'Colaborador adicionado à equipe!' });
                }}
              >
                <h3 style={{ marginBottom: '1rem' }}>Cadastrar Colaborador</h3>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input required value={profForm.name} onChange={(e) => setProfForm({ ...profForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Especialidade / Cargo</label>
                  <input
                    placeholder="Ex: Cabeleireiro, Manicure, Barbeiro"
                    value={profForm.specialty}
                    onChange={(e) => setProfForm({ ...profForm, specialty: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Salvar Colaborador
                </button>
              </form>
            </div>
          )}

          {activeNav === 'schedule' && (
            <div className="form-grid">
              <form
                className="dash-card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api.setBusinessHours(selectedSalon, {
                    ...hoursForm,
                    day_of_week: Number(hoursForm.day_of_week),
                  });
                  setFeedback({ type: 'success', text: 'Horário semanal atualizado!' });
                }}
              >
                <h3 style={{ marginBottom: '1rem' }}>Horário de Funcionamento / Dias Fechados</h3>
                <div className="form-group">
                  <label>Dia da Semana</label>
                  <select value={hoursForm.day_of_week} onChange={(e) => setHoursForm({ ...hoursForm, day_of_week: e.target.value })}>
                    {DAYS_OF_WEEK.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Abertura</label>
                    <input type="time" value={hoursForm.open_time} onChange={(e) => setHoursForm({ ...hoursForm, open_time: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Fechamento</label>
                    <input type="time" value={hoursForm.close_time} onChange={(e) => setHoursForm({ ...hoursForm, close_time: e.target.value })} />
                  </div>
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={hoursForm.is_closed}
                    onChange={(e) => setHoursForm({ ...hoursForm, is_closed: e.target.checked })}
                  />
                  <label>Unidade fechada neste dia</label>
                </div>
                <button type="submit" className="btn btn-primary">
                  Salvar Regra
                </button>
              </form>

              <form
                className="dash-card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api.createTimeOff(selectedSalon, {
                    start_datetime: new Date(blockForm.start_datetime).toISOString(),
                    end_datetime: new Date(blockForm.end_datetime).toISOString(),
                    reason: blockForm.reason,
                  });
                  setBlockForm({ start_datetime: '', end_datetime: '', reason: '' });
                  setFeedback({ type: 'success', text: 'Bloqueio registrado!' });
                }}
              >
                <h3 style={{ marginBottom: '1rem' }}>Bloqueios, Pausas e Feriados</h3>
                <div className="form-group">
                  <label>Início</label>
                  <input
                    type="datetime-local"
                    required
                    value={blockForm.start_datetime}
                    onChange={(e) => setBlockForm({ ...blockForm, start_datetime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Término</label>
                  <input
                    type="datetime-local"
                    required
                    value={blockForm.end_datetime}
                    onChange={(e) => setBlockForm({ ...blockForm, end_datetime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Motivo</label>
                  <input
                    placeholder="Ex: Pausa Almoço, Feriado"
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Criar Bloqueio
                </button>
              </form>
            </div>
          )}

          {activeNav === 'salons' && (
            <div className="form-grid">
              <form
                className="dash-card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedback(null);
                  try {
                    const cleanPhone = salonForm.phone.replace(/\D/g, '');
                    if (editingSalonId) {
                      await api.updateSalon(editingSalonId, { ...salonForm, phone: cleanPhone });
                      setFeedback({ type: 'success', text: 'Dados da unidade atualizados com sucesso!' });
                      setEditingSalonId(null);
                    } else {
                      await api.createSalon({ ...salonForm, phone: cleanPhone });
                      setFeedback({ type: 'success', text: 'Nova unidade cadastrada com WhatsApp vinculado!' });
                    }
                    setSalonForm({ name: '', slug: '', address: '', phone: '' });
                    loadSalons();
                  } catch (err) {
                    setFeedback({ type: 'error', text: err.message });
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>{editingSalonId ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}</h3>
                  {editingSalonId && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => {
                        setEditingSalonId(null);
                        setSalonForm({ name: '', slug: '', address: '', phone: '' });
                      }}
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label>Nome do Estabelecimento</label>
                  <input
                    required
                    placeholder="Ex: Studio Beleza Centro"
                    value={salonForm.name}
                    onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Identificador Único (Slug)</label>
                  <input
                    required
                    placeholder="ex: studio-centro"
                    value={salonForm.slug}
                    onChange={(e) => setSalonForm({ ...salonForm, slug: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp Oficial da Unidade (DDI + DDD + Número)</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 5511999999999"
                    value={salonForm.phone}
                    onChange={(e) => setSalonForm({ ...salonForm, phone: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    Usado pelo agente de IA no n8n para identificar automaticamente esta unidade.
                  </small>
                </div>
                <div className="form-group">
                  <label>Endereço</label>
                  <input
                    placeholder="Ex: Av. Paulista, 1000 - São Paulo"
                    value={salonForm.address}
                    onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  {editingSalonId ? 'Salvar Alterações' : 'Cadastrar Unidade'}
                </button>
              </form>

              {/* Lista das unidades já cadastradas */}
              <div className="dash-card">
                <h3 style={{ marginBottom: '1rem' }}>Unidades Ativas ({salons.length})</h3>
                {salons.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhuma unidade cadastrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {salons.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          padding: '1rem',
                          border: editingSalonId === s.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div>
                            <strong>{s.name}</strong>{' '}
                            <span className="status-badge status-confirmed" style={{ marginLeft: '0.4rem' }}>
                              ● Ativa
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                setEditingSalonId(s.id);
                                setSalonForm({
                                  name: s.name || '',
                                  slug: s.slug || '',
                                  address: s.address || '',
                                  phone: s.phone || '',
                                });
                              }}
                            >
                              ✏️ Editar
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger-ghost"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                              onClick={() => handleDeleteSalon(s)}
                              title="Cancelar cadastro desta unidade"
                            >
                              🗑️ Excluir
                            </button>
                          </div>
                        </div>

                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.45rem' }}>
                          📱 WhatsApp n8n: <strong>{s.phone || 'Não cadastrado'}</strong>
                        </p>
                        {s.address && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            📍 {s.address}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE NOVO AGENDAMENTO RÁPIDO DO GESTOR */}
      {showQuickBooking && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '860px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Novo Agendamento (Recepção)</h3>
              <button className="btn btn-outline" onClick={() => setShowQuickBooking(false)}>
                ✕ Fechar
              </button>
            </div>
            <BookingPage initialSalonId={selectedSalon} />
          </div>
        </div>
      )}
    </div>
  );
}