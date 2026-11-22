import { useState, useEffect } from 'react';
import { api } from '../services/api';

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('salon_token'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [adminTab, setAdminTab] = useState('agenda'); // 'agenda', 'catalog', 'schedule', 'salons'

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [salons, setSalons] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState('');
  const [appointments, setAppointments] = useState([]);

  const [salonForm, setSalonForm] = useState({ name: '', slug: '', address: '', phone: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', duration_minutes: 30, price: 50 });
  const [profForm, setProfForm] = useState({ name: '', specialty: '' });
  const [hoursForm, setHoursForm] = useState({ day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: false });
  const [blockForm, setBlockForm] = useState({ start_datetime: '', end_datetime: '', reason: '' });

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  useEffect(() => {
    if (selectedSalon && token) {
      api.getAppointments({ salonId: selectedSalon }).then((res) => setAppointments(res.appointments));
    }
  }, [selectedSalon, token]);

  async function loadData() {
    const res = await api.getSalons();
    setSalons(res.salons);
    if (res.salons.length > 0 && !selectedSalon) {
      setSelectedSalon(res.salons[0].id);
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    try {
      if (isRegistering) {
        await api.register({ name, email, password });
      }
      const res = await api.login({ email, password });
      localStorage.setItem('salon_token', res.token);
      setToken(res.token);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  function handleLogout() {
    localStorage.removeItem('salon_token');
    setToken(null);
  }

  async function handleCreateSalon(e) {
    e.preventDefault();
    try {
      await api.createSalon(salonForm);
      setSalonForm({ name: '', slug: '', address: '', phone: '' });
      setFeedback({ type: 'success', text: 'Unidade cadastrada com sucesso!' });
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleCreateService(e) {
    e.preventDefault();
    try {
      await api.createService(selectedSalon, {
        ...serviceForm,
        duration_minutes: Number(serviceForm.duration_minutes),
        price: Number(serviceForm.price),
      });
      setServiceForm({ name: '', description: '', duration_minutes: 30, price: 50 });
      setFeedback({ type: 'success', text: 'Serviço adicionado ao catálogo!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleCreateProf(e) {
    e.preventDefault();
    try {
      await api.createProfessional(selectedSalon, profForm);
      setProfForm({ name: '', specialty: '' });
      setFeedback({ type: 'success', text: 'Profissional cadastrado!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleSetHours(e) {
    e.preventDefault();
    try {
      await api.setBusinessHours(selectedSalon, {
        ...hoursForm,
        day_of_week: Number(hoursForm.day_of_week),
      });
      setFeedback({ type: 'success', text: 'Regra de horário atualizada!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleCreateBlock(e) {
    e.preventDefault();
    try {
      await api.createTimeOff(selectedSalon, {
        start_datetime: new Date(blockForm.start_datetime).toISOString(),
        end_datetime: new Date(blockForm.end_datetime).toISOString(),
        reason: blockForm.reason,
      });
      setBlockForm({ start_datetime: '', end_datetime: '', reason: '' });
      setFeedback({ type: 'success', text: 'Bloqueio registrado na agenda!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  if (!token) {
    return (
      <form className="card" style={{ maxWidth: '440px', margin: '2rem auto' }} onSubmit={handleAuthSubmit}>
        <div className="section-header">
          <h3>{isRegistering ? 'Criar Conta Administrativa' : 'Portal do Gestor'}</h3>
        </div>
        {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

        {isRegistering && (
          <div className="form-group">
            <label>Seu Nome</label>
            <input type="text" placeholder="Ex: Felipe Santos" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}

        <div className="form-group">
          <label>E-mail</label>
          <input type="email" placeholder="gestor@salao.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="form-group">
          <label>Senha</label>
          <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          {isRegistering ? 'Cadastrar e Acessar' : 'Entrar no Painel'}
        </button>

        <button
          type="button"
          className="btn btn-outline"
          style={{ width: '100%', marginTop: '0.75rem' }}
          onClick={() => {
            setIsRegistering(!isRegistering);
            setFeedback(null);
          }}
        >
          {isRegistering ? 'Já tenho conta (Fazer Login)' : 'Não tem conta? Criar cadastro'}
        </button>
      </form>
    );
  }

  // Cálculo dos KPIs em tempo real
  const confirmedAppts = appointments.filter((a) => a.status === 'confirmed');
  const estimatedRevenue = confirmedAppts.reduce((sum, a) => sum + Number(a.price_charged || 0), 0);

  return (
    <div>
      {/* Barra Superior do Gestor */}
      <div
        className="card"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Unidade:</span>
          <select value={selectedSalon} onChange={(e) => setSelectedSalon(e.target.value)}>
            {salons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="nav-tabs">
          <button className={`nav-pill ${adminTab === 'agenda' ? 'active' : ''}`} onClick={() => setAdminTab('agenda')}>
            Agenda
          </button>
          <button className={`nav-pill ${adminTab === 'catalog' ? 'active' : ''}`} onClick={() => setAdminTab('catalog')}>
            Serviços & Equipe
          </button>
          <button className={`nav-pill ${adminTab === 'schedule' ? 'active' : ''}`} onClick={() => setAdminTab('schedule')}>
            Horários & Bloqueios
          </button>
          <button className={`nav-pill ${adminTab === 'salons' ? 'active' : ''}`} onClick={() => setAdminTab('salons')}>
            Unidades
          </button>
        </div>

        <button className="btn btn-outline" onClick={handleLogout}>
          Sair
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Agendamentos Confirmados</div>
          <div className="kpi-value">{confirmedAppts.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Receita Prevista</div>
          <div className="kpi-value" style={{ color: 'var(--accent-dark)' }}>
            R$ {estimatedRevenue.toFixed(2)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Histórico</div>
          <div className="kpi-value">{appointments.length}</div>
        </div>
      </div>

      {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

      {/* ABA 1: AGENDA */}
      {adminTab === 'agenda' && (
        <div className="card">
          <div className="section-header">
            <h3>Agenda da Unidade</h3>
          </div>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum agendamento registrado nesta unidade ainda.</p>
          ) : (
            appointments.map((appt) => (
              <div
                key={appt.id}
                style={{
                  padding: '1rem 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <strong>{new Date(appt.start_datetime).toLocaleString('pt-BR')}</strong> — {appt.client_name} (
                  {appt.client_phone})
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {appt.service_name} • Profissional: {appt.professional_name || 'Qualquer'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <strong>R$ {Number(appt.price_charged).toFixed(2)}</strong>
                  <span className={`badge badge-${appt.status}`}>{appt.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ABA 2: SERVIÇOS E EQUIPE */}
      {adminTab === 'catalog' && (
        <div className="grid-2">
          <form className="card" onSubmit={handleCreateService}>
            <div className="section-header">
              <h3>Cadastrar Serviço</h3>
            </div>
            <div className="form-group">
              <label>Nome do Serviço</label>
              <input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Descrição breve</label>
              <input
                placeholder="Ex: Inclui lavagem e finalização"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Duração (min)</label>
                <input
                  type="number"
                  value={serviceForm.duration_minutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Adicionar Serviço
            </button>
          </form>

          <form className="card" onSubmit={handleCreateProf}>
            <div className="section-header">
              <h3>Cadastrar Profissional</h3>
            </div>
            <div className="form-group">
              <label>Nome Completo</label>
              <input value={profForm.name} onChange={(e) => setProfForm({ ...profForm, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Especialidade</label>
              <input
                placeholder="Ex: Colorista, Manicure, Esteticista"
                value={profForm.specialty}
                onChange={(e) => setProfForm({ ...profForm, specialty: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Adicionar Profissional
            </button>
          </form>
        </div>
      )}

      {/* ABA 3: HORÁRIOS E BLOQUEIOS */}
      {adminTab === 'schedule' && (
        <div className="grid-2">
          <form className="card" onSubmit={handleSetHours}>
            <div className="section-header">
              <h3>Horário Semanal / Dia Fechado</h3>
            </div>
            <div className="form-group">
              <label>Dia da Semana</label>
              <select value={hoursForm.day_of_week} onChange={(e) => setHoursForm({ ...hoursForm, day_of_week: e.target.value })}>
                {DAYS_OF_WEEK.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Abertura</label>
                <input
                  type="time"
                  value={hoursForm.open_time}
                  onChange={(e) => setHoursForm({ ...hoursForm, open_time: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Fechamento</label>
                <input
                  type="time"
                  value={hoursForm.close_time}
                  onChange={(e) => setHoursForm({ ...hoursForm, close_time: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={hoursForm.is_closed}
                onChange={(e) => setHoursForm({ ...hoursForm, is_closed: e.target.checked })}
              />
              <label>Marcar este dia como FECHADO</label>
            </div>
            <button type="submit" className="btn btn-primary">
              Salvar Regra
            </button>
          </form>

          <form className="card" onSubmit={handleCreateBlock}>
            <div className="section-header">
              <h3>Bloqueio Pontual / Feriado / Pausa</h3>
            </div>
            <div className="form-group">
              <label>Início do Bloqueio</label>
              <input
                type="datetime-local"
                value={blockForm.start_datetime}
                onChange={(e) => setBlockForm({ ...blockForm, start_datetime: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Fim do Bloqueio</label>
              <input
                type="datetime-local"
                value={blockForm.end_datetime}
                onChange={(e) => setBlockForm({ ...blockForm, end_datetime: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Motivo</label>
              <input
                placeholder="Ex: Feriado Nacional, Pausa Almoço"
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Registrar Bloqueio
            </button>
          </form>
        </div>
      )}

      {/* ABA 4: UNIDADES */}
      {adminTab === 'salons' && (
        <form className="card" style={{ maxWidth: '520px' }} onSubmit={handleCreateSalon}>
          <div className="section-header">
            <h3>Cadastrar Nova Unidade</h3>
          </div>
          <div className="form-group">
            <label>Nome do Salão</label>
            <input value={salonForm.name} onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Slug (URL única)</label>
            <input
              placeholder="ex: unidade-jardins"
              value={salonForm.slug}
              onChange={(e) => setSalonForm({ ...salonForm, slug: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Endereço Completo</label>
            <input value={salonForm.address} onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">
            Cadastrar Salão
          </button>
        </form>
      )}
    </div>
  );
}