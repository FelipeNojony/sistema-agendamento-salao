import { useState, useEffect } from 'react';
import { api } from '../services/api';

function getInitials(name = '') {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function BookingPage({ initialSalonId = '' }) {
  const [subTab, setSubTab] = useState('new');
  const [salons, setSalons] = useState([]);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);

  const [selectedSalon, setSelectedSalon] = useState(initialSalonId);
  const [selectedService, setSelectedService] = useState('');
  const [selectedProf, setSelectedProf] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Meus Agendamentos
  const [searchPhone, setSearchPhone] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState(null);
  const [logsModal, setLogsModal] = useState(null);

  useEffect(() => {
    api.getSalons().then((res) => {
      const list = res.salons || [];
      setSalons(list);
      if (!selectedSalon && list.length > 0) {
        setSelectedSalon(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (initialSalonId) setSelectedSalon(initialSalonId);
  }, [initialSalonId]);

  useEffect(() => {
    if (!selectedSalon) return;
    setSelectedService('');
    setSelectedProf('');
    setSelectedSlot(null);
    api.getServices(selectedSalon).then((res) => setServices(res.services || []));
    api.getProfessionals(selectedSalon).then((res) => setProfessionals(res.professionals || []));
  }, [selectedSalon]);

  useEffect(() => {
    if (!selectedSalon || !selectedService || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    api
      .getAvailability(selectedSalon, date, selectedService, selectedProf)
      .then((res) => setSlots(res.available_slots || []))
      .catch((err) => setFeedback({ type: 'error', text: err.message }))
      .finally(() => setLoadingSlots(false));
  }, [selectedSalon, selectedService, selectedProf, date]);

  async function handleBook(e) {
    e.preventDefault();
    if (!selectedSlot) return;
    setFeedback(null);

    try {
      await api.createAppointment({
        salon_id: selectedSalon,
        professional_id: selectedProf || null,
        service_id: selectedService,
        client_name: clientName,
        client_phone: clientPhone,
        start_datetime: selectedSlot.start_datetime,
      });

      setFeedback({ type: 'success', text: 'Agendamento confirmado com sucesso! Você já pode consultá-lo na aba Meus Agendamentos.' });
      setSelectedSlot(null);
      setClientName('');
      const updated = await api.getAvailability(selectedSalon, date, selectedService, selectedProf);
      setSlots(updated.available_slots || []);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleSearchAppointments(e) {
    if (e) e.preventDefault();
    if (!searchPhone) return;
    const res = await api.getAppointments({ clientPhone: searchPhone });
    setMyAppointments(res.appointments || []);
  }

  async function handleCancel(id) {
    if (!window.confirm('Deseja realmente cancelar este horário?')) return;
    try {
      await api.cancelAppointment(id, 'Cancelado pelo cliente no portal');
      setFeedback({ type: 'success', text: 'Agendamento cancelado com sucesso.' });
      handleSearchAppointments();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function loadRescheduleSlots(appt, newDate) {
    setRescheduleDate(newDate);
    setSelectedRescheduleSlot(null);
    if (!newDate) return;
    const res = await api.getAvailability(appt.salon_id, newDate, appt.service_id, appt.professional_id);
    setRescheduleSlots(res.available_slots || []);
  }

  async function handleConfirmReschedule(id) {
    if (!selectedRescheduleSlot) return;
    try {
      await api.rescheduleAppointment(id, selectedRescheduleSlot.start_datetime);
      setFeedback({ type: 'success', text: 'Horário reagendado com sucesso!' });
      setRescheduleId(null);
      handleSearchAppointments();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  async function handleViewLogs(id) {
    const res = await api.getAppointmentLogs(id);
    setLogsModal(res.logs);
  }

  const activeSalonObj = salons.find((s) => s.id === selectedSalon);
  const activeServiceObj = services.find((s) => s.id === selectedService);
  const activeProfObj = professionals.find((p) => p.id === selectedProf);

  return (
    <div className="booking-wrapper">
      {/* Cabeçalho da Área do Cliente */}
      <div className="booking-topbar">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Agendamento Online</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Escolha o serviço, profissional e horário disponível em segundos
          </p>
        </div>

        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${subTab === 'new' ? 'active' : ''}`}
            onClick={() => setSubTab('new')}
          >
            + Novo Agendamento
          </button>
          <button
            type="button"
            className={`segmented-btn ${subTab === 'my-bookings' ? 'active' : ''}`}
            onClick={() => setSubTab('my-bookings')}
          >
            Meus Agendamentos
          </button>
        </div>
      </div>

      {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

      {subTab === 'new' ? (
        <form className="booking-grid" onSubmit={handleBook}>
          <div>
            {/* PASSO 1: UNIDADE */}
            <div className="step-card">
              <div className="step-title-row">
                <span className="step-number">1</span>
                <h3>Escolha a Unidade</h3>
              </div>

              <div className="option-grid">
                {salons.map((salon) => {
                  const isSelected = selectedSalon === salon.id;
                  return (
                    <button
                      type="button"
                      key={salon.id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSalon(salon.id)}
                    >
                      <div className="option-card-header">
                        <div>
                          <div className="option-card-title">{salon.name}</div>
                          <div className="option-card-sub">📍 {salon.address || 'Unidade Principal'}</div>
                        </div>
                        {isSelected && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PASSO 2: SERVIÇO */}
            <div className="step-card">
              <div className="step-title-row">
                <span className="step-number">2</span>
                <h3>Selecione o Serviço</h3>
              </div>

              {services.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Nenhum serviço cadastrado nesta unidade.
                </p>
              ) : (
                <div className="option-grid">
                  {services.map((srv) => {
                    const isSelected = selectedService === srv.id;
                    return (
                      <button
                        type="button"
                        key={srv.id}
                        className={`option-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedService(srv.id)}
                      >
                        <div className="option-card-header">
                          <div>
                            <div className="option-card-title">{srv.name}</div>
                            <div className="option-card-sub">{srv.description || 'Atendimento especializado'}</div>
                          </div>
                          {isSelected && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✓</span>}
                        </div>

                        <div className="option-card-footer">
                          <span className="duration-pill">⏱ {srv.duration_minutes} min</span>
                          <span className="price-highlight">R$ {Number(srv.price).toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PASSO 3: PROFISSIONAL */}
            {professionals.length > 0 && (
              <div className="step-card">
                <div className="step-title-row">
                  <span className="step-number">3</span>
                  <h3>Profissional de Preferência</h3>
                </div>

                <div className="option-grid">
                  <button
                    type="button"
                    className={`option-card prof-option ${selectedProf === '' ? 'selected' : ''}`}
                    onClick={() => setSelectedProf('')}
                  >
                    <div className="prof-badge-avatar">★</div>
                    <div>
                      <div className="option-card-title">Sem preferência</div>
                      <div className="option-card-sub">Qualquer profissional livre</div>
                    </div>
                  </button>

                  {professionals.map((prof) => {
                    const isSelected = selectedProf === prof.id;
                    return (
                      <button
                        type="button"
                        key={prof.id}
                        className={`option-card prof-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedProf(prof.id)}
                      >
                        <div className="prof-badge-avatar">{getInitials(prof.name)}</div>
                        <div>
                          <div className="option-card-title">{prof.name}</div>
                          <div className="option-card-sub">{prof.specialty || 'Especialista'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PASSO 4: DATA, HORÁRIO E IDENTIFICAÇÃO */}
            <div className="step-card">
              <div className="step-title-row">
                <span className="step-number">{professionals.length > 0 ? '4' : '3'}</span>
                <h3>Data, Horário e Seus Dados</h3>
              </div>

              <div className="form-group" style={{ maxWidth: '250px' }}>
                <label>Escolha a data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>

              {date && selectedService && (
                <div style={{ marginTop: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Horários disponíveis
                  </label>
                  {loadingSlots ? (
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Verificando agenda...</p>
                  ) : slots.length === 0 ? (
                    <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>
                      Nenhum horário livre encontrado para esta data. Tente selecionar outro dia.
                    </div>
                  ) : (
                    <div className="slots-grid">
                      {slots.map((slot) => (
                        <button
                          type="button"
                          key={slot.start_datetime}
                          className={`slot-btn ${selectedSlot?.start_datetime === slot.start_datetime ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedSlot && (
                <div
                  className="form-grid"
                  style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}
                >
                  <div className="form-group">
                    <label>Seu Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: Mariana Costa"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>WhatsApp / Telefone</label>
                    <input
                      type="tel"
                      placeholder="Ex: 11999998888"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RESUMO LATERAL FIXO */}
          <aside className="checkout-summary">
            <h3>
              <span>Resumo da Reserva</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>● Online</span>
            </h3>

            <div className="summary-line">
              <span>Unidade</span>
              <strong>{activeSalonObj?.name || '—'}</strong>
            </div>
            <div className="summary-line">
              <span>Serviço</span>
              <strong>{activeServiceObj?.name || 'Não selecionado'}</strong>
            </div>
            <div className="summary-line">
              <span>Profissional</span>
              <strong>{activeProfObj?.name || 'Sem preferência'}</strong>
            </div>
            <div className="summary-line">
              <span>Data</span>
              <strong>{date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</strong>
            </div>
            <div className="summary-line">
              <span>Horário</span>
              <strong>{selectedSlot ? selectedSlot.time : '—'}</strong>
            </div>
            <div className="summary-line">
              <span>Duração estimada</span>
              <strong>{activeServiceObj ? `${activeServiceObj.duration_minutes} min` : '—'}</strong>
            </div>

            <div className="summary-total-box">
              <span>Total a pagar</span>
              <strong>{activeServiceObj ? `R$ ${Number(activeServiceObj.price).toFixed(2)}` : 'R$ 0,00'}</strong>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.25rem', padding: '0.85rem' }}
              disabled={!selectedSlot}
            >
              {selectedSlot ? `Confirmar às ${selectedSlot.time}` : 'Selecione um horário'}
            </button>
          </aside>
        </form>
      ) : (
        /* ABA MEUS AGENDAMENTOS */
        <div className="step-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="step-title-row">
            <h3>Meus Agendamentos</h3>
          </div>

          <form onSubmit={handleSearchAppointments} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="tel"
              placeholder="Digite seu telefone cadastrado (ex: 11988887777)"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
              required
            />
            <button type="submit" className="btn btn-primary">
              Buscar Horários
            </button>
          </form>

          {myAppointments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
              Informe seu telefone acima para visualizar, reagendar ou cancelar suas reservas.
            </p>
          ) : (
            myAppointments.map((appt) => (
              <div
                key={appt.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  background: '#fafbfc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{appt.service_name}</strong>
                      <span className={`status-badge status-${appt.status}`}>
                        {appt.status === 'confirmed' ? '● Confirmado' : '✕ Cancelado'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      📅 {new Date(appt.start_datetime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} •{' '}
                      Profissional: <strong>{appt.professional_name || 'Qualquer'}</strong> • R${' '}
                      {Number(appt.price_charged).toFixed(2)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => handleViewLogs(appt.id)}>
                      Histórico
                    </button>
                    {appt.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setRescheduleId(appt.id);
                            setRescheduleSlots([]);
                          }}
                        >
                          Reagendar
                        </button>
                        <button type="button" className="btn btn-danger-ghost" onClick={() => handleCancel(appt.id)}>
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {rescheduleId === appt.id && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Escolha a nova data:</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => loadRescheduleSlots(appt, e.target.value)}
                      style={{ marginLeft: '0.5rem', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                    <div className="slots-grid">
                      {rescheduleSlots.map((s) => (
                        <button
                          key={s.start_datetime}
                          type="button"
                          className={`slot-btn ${selectedRescheduleSlot?.start_datetime === s.start_datetime ? 'selected' : ''}`}
                          onClick={() => setSelectedRescheduleSlot(s)}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                    {selectedRescheduleSlot && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ marginTop: '0.85rem' }}
                        onClick={() => handleConfirmReschedule(appt.id)}
                      >
                        Salvar Novo Horário ({selectedRescheduleSlot.time})
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

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
      )}
    </div>
  );
}