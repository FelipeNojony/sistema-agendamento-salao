import { useState, useEffect } from 'react';
import { api } from '../services/api';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

function getInitials(name = '') {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function DashboardPage({ selectedSalon, searchTerm, userName, onOpenBookingModal }) {
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedback, setFeedback] = useState(null);

  // Estados para Reagendamento e Auditoria
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [selectedNewSlot, setSelectedNewSlot] = useState(null);
  const [logsModal, setLogsModal] = useState(null);

  useEffect(() => {
    if (selectedSalon) loadAppointments();
  }, [selectedSalon]);

  async function loadAppointments() {
    try {
      const res = await api.getAppointments({ salonId: selectedSalon });
      setAppointments(res.appointments || []);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  // Métricas calculadas dinamicamente
  const confirmed = appointments.filter((a) => a.status === 'confirmed');
  const completed = appointments.filter((a) => a.status === 'completed');
  const cancelled = appointments.filter((a) => a.status === 'cancelled');
  const activeList = [...confirmed, ...completed];
  const totalRevenue = activeList.reduce((acc, a) => acc + Number(a.price_charged || 0), 0);
  const avgTicket = activeList.length > 0 ? totalRevenue / activeList.length : 0;

  // Agrupamento: Serviços por Colaborador (para o Gráfico Donut)
  const byCollaboratorMap = {};
  activeList.forEach((appt) => {
    const profName = appt.professional_name || 'Sem preferência';
    byCollaboratorMap[profName] = (byCollaboratorMap[profName] || 0) + 1;
  });

  const collabStats = Object.entries(byCollaboratorMap)
    .map(([name, count], idx) => ({
      name,
      count,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
    .sort((a, b) => b.count - a.count);

  const totalCollabServices = collabStats.reduce((sum, item) => sum + item.count, 0);

  // Cálculo dos arcos SVG do Donut
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  // Filtro da Tabela (Busca global + Filtro de status)
  const filteredAppointments = appointments.filter((appt) => {
    const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      appt.client_name.toLowerCase().includes(q) ||
      appt.client_phone.includes(q) ||
      (appt.service_name && appt.service_name.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  async function handleCancel(id) {
    if (!window.confirm('Deseja cancelar este agendamento?')) return;
    try {
      await api.cancelAppointment(id, 'Cancelado pelo painel');
      setFeedback({ type: 'success', text: 'Agendamento cancelado com sucesso.' });
      loadAppointments();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleLoadRescheduleSlots(appt, date) {
    setRescheduleDate(date);
    setSelectedNewSlot(null);
    if (!date) return;
    const res = await api.getAvailability(appt.salon_id, date, appt.service_id, appt.professional_id);
    setRescheduleSlots(res.available_slots || []);
  }

  async function handleConfirmReschedule() {
    if (!rescheduleAppt || !selectedNewSlot) return;
    try {
      await api.rescheduleAppointment(rescheduleAppt.id, selectedNewSlot.start_datetime);
      setFeedback({ type: 'success', text: 'Horário reagendado com sucesso!' });
      setRescheduleAppt(null);
      loadAppointments();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleViewLogs(id) {
    const res = await api.getAppointmentLogs(id);
    setLogsModal(res.logs);
  }

  return (
    <div>
      {/* Saudação + Botão Principal (Estilo Print 1) */}
      <div className="greeting-header">
        <div>
          <h1>
            Bem-vindo, <strong>{userName || 'Gestor'}!</strong> 👋
            </h1>
          <div className="greeting-sub">📅 Acompanhe a operação, equipe e agenda da unidade em tempo real.</div>
        </div>
        <button className="btn btn-primary" onClick={onOpenBookingModal}>
          + Novo Agendamento
        </button>
      </div>

      {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

      {/* 3 CARDS ANALÍTICOS SUPERIORES */}
      <div className="analytics-grid">
        {/* Card 1: Faturamento / Total */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span>Receita Estimada</span>
            <span>💰</span>
          </div>
          <div className="big-metric">
            <div className="value">R$ {totalRevenue.toFixed(0)}</div>
            <div className="label">Em serviços ativos</div>
          </div>
          <div className="metric-footer">
            <span>{activeList.length} atendimentos</span>
            <span className="trend-up">↗ Ativo</span>
          </div>
        </div>

        {/* Card 2: Serviços no Período (Quebra por Status) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span>Resumo de Agendamentos</span>
            <span>📊</span>
          </div>
          <div className="status-row">
            <div className="status-item">
              <div className="status-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                📅
              </div>
              <div>
                <div className="num">{confirmed.length}</div>
                <div className="lbl">Confirmados</div>
              </div>
            </div>

            <div className="status-item">
              <div className="status-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                ✓
              </div>
              <div>
                <div className="num">{completed.length}</div>
                <div className="lbl">Realizados</div>
              </div>
            </div>

            <div className="status-item">
              <div className="status-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                ✕
              </div>
              <div>
                <div className="num">{cancelled.length}</div>
                <div className="lbl">Cancelados</div>
              </div>
            </div>

            <div className="status-item">
              <div className="status-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                ★
              </div>
              <div>
                <div className="num">R${avgTicket.toFixed(0)}</div>
                <div className="lbl">Ticket Médio</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Serviços por Colaborador (Gráfico Donut SVG) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span>Serviços por Colaborador</span>
          </div>
          {collabStats.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sem dados suficientes ainda.</p>
          ) : (
            <div className="collab-split">
              <div className="collab-legend">
                {collabStats.map((item) => (
                  <div key={item.name} className="legend-item">
                    <span className="legend-dot" style={{ background: item.color }} />
                    <span>
                      <strong>{item.count}</strong> {item.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>

              <svg width="92" height="92" viewBox="0 0 92 92">
                {collabStats.map((item) => {
                  const percent = item.count / totalCollabServices;
                  const strokeDasharray = `${percent * circumference} ${circumference}`;
                  const strokeDashoffset = -cumulativePercent * circumference;
                  cumulativePercent += percent;

                  return (
                    <circle
                      key={item.name}
                      cx="46"
                      cy="46"
                      r={radius}
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth="11"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 46 46)"
                    />
                  );
                })}
                <text x="46" y="51" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a">
                  {totalCollabServices}
                </text>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* TABELA DE AGENDAMENTOS RECENTES */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-title">
            <span>Agendamentos recentes</span>
            <span className="count-pill">{filteredAppointments.length}</span>
          </div>

          <div className="filter-pills">
            <button
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
            <button
              className={`filter-pill ${statusFilter === 'confirmed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('confirmed')}
            >
              Confirmados
            </button>
            <button
              className={`filter-pill ${statusFilter === 'cancelled' ? 'active' : ''}`}
              onClick={() => setStatusFilter('cancelled')}
            >
              Cancelados
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente / Telefone</th>
                <th>Serviço</th>
                <th>Data e Horário</th>
                <th>Colaborador</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum agendamento encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>
                      <div className="client-cell">
                        <div className="client-initials">{getInitials(appt.client_name)}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{appt.client_name}</div>
                          <div className="client-phone">{appt.client_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{appt.service_name}</strong>
                    </td>
                    <td>📅 {new Date(appt.start_datetime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{appt.professional_name || 'Sem preferência'}</td>
                    <td>
                      <strong>R$ {Number(appt.price_charged).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span className={`status-badge status-${appt.status}`}>
                        {appt.status === 'confirmed' ? '● Confirmado' : appt.status === 'cancelled' ? '✕ Cancelado' : '✓ Concluído'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }} onClick={() => handleViewLogs(appt.id)}>
                          Logs
                        </button>
                        {appt.status === 'confirmed' && (
                          <>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => {
                                setRescheduleAppt(appt);
                                setRescheduleDate('');
                                setRescheduleSlots([]);
                              }}
                            >
                              Reagendar
                            </button>
                            <button className="btn btn-danger-ghost" onClick={() => handleCancel(appt.id)}>
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REAGENDAMENTO */}
      {rescheduleAppt && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>Reagendar: {rescheduleAppt.client_name}</h3>
              <button className="btn btn-outline" onClick={() => setRescheduleAppt(null)}>
                ✕
              </button>
            </div>
            <div className="form-group">
              <label>Nova Data</label>
              <input type="date" value={rescheduleDate} onChange={(e) => handleLoadRescheduleSlots(rescheduleAppt, e.target.value)} />
            </div>
            {rescheduleSlots.length > 0 && (
              <div className="slots-grid">
                {rescheduleSlots.map((s) => (
                  <button
                    key={s.start_datetime}
                    type="button"
                    className={`slot-btn ${selectedNewSlot?.start_datetime === s.start_datetime ? 'selected' : ''}`}
                    onClick={() => setSelectedNewSlot(s)}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
            {selectedNewSlot && (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }} onClick={handleConfirmReschedule}>
                Confirmar Reagendamento às {selectedNewSlot.time}
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO (AUDITORIA) */}
      {logsModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>Histórico de Alterações</h3>
              <button className="btn btn-outline" onClick={() => setLogsModal(null)}>
                ✕
              </button>
            </div>
            {logsModal.map((log) => (
              <div key={log.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.88rem' }}>
                <strong>{log.action.toUpperCase()}</strong> — {new Date(log.created_at).toLocaleString('pt-BR')}
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Alterado por: {log.changed_by}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}