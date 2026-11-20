import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function BookingPage() {
  const [subTab, setSubTab] = useState('new'); // 'new' ou 'my-bookings'
  const [salons, setSalons] = useState([]);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);

  // Estados do formulário de agendamento
  const [selectedSalon, setSelectedSalon] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedProf, setSelectedProf] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Estados da aba "Meus Agendamentos"
  const [searchPhone, setSearchPhone] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState(null);
  const [logsModal, setLogsModal] = useState(null);

  // 1. Carrega os salões ao abrir a página
  useEffect(() => {
    api.getSalons().then((res) => {
      setSalons(res.salons);
      if (res.salons.length > 0) setSelectedSalon(res.salons[0].id);
    });
  }, []);

  // 2. Carrega serviços e profissionais quando o salão muda
  useEffect(() => {
    if (!selectedSalon) return;
    api.getServices(selectedSalon).then((res) => setServices(res.services));
    api.getProfessionals(selectedSalon).then((res) => setProfessionals(res.professionals));
  }, [selectedSalon]);

  // 3. Consulta disponibilidade automaticamente quando salão, serviço ou data mudam
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

  // Criar agendamento
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

      setFeedback({ type: 'success', text: 'Agendamento confirmado com sucesso!' });
      setSelectedSlot(null);
      setClientName('');
      // Atualiza a lista de horários livres imediatamente
      const updated = await api.getAvailability(selectedSalon, date, selectedService, selectedProf);
      setSlots(updated.available_slots || []);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  // Buscar agendamentos do cliente pelo telefone
  async function handleSearchAppointments(e) {
    if (e) e.preventDefault();
    if (!searchPhone) return;
    const res = await api.getAppointments({ clientPhone: searchPhone });
    setMyAppointments(res.appointments);
  }

  // Cancelar agendamento
  async function handleCancel(id) {
    if (!window.confirm('Deseja realmente cancelar este horário?')) return;
    try {
      await api.cancelAppointment(id, 'Cancelado pelo cliente no portal');
      setFeedback({ type: 'success', text: 'Agendamento cancelado.' });
      handleSearchAppointments();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  // Buscar horários livres para reagendamento
  async function loadRescheduleSlots(appt, newDate) {
    setRescheduleDate(newDate);
    setSelectedRescheduleSlot(null);
    if (!newDate) return;
    const res = await api.getAvailability(appt.salon_id, newDate, appt.service_id, appt.professional_id);
    setRescheduleSlots(res.available_slots || []);
  }

  // Confirmar reagendamento
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

  // Abrir histórico de alterações
  async function handleViewLogs(id) {
    const res = await api.getAppointmentLogs(id);
    setLogsModal(res.logs);
  }

  return (
    <div>
      <div className="nav-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`btn btn-outline ${subTab === 'new' ? 'active' : ''}`} onClick={() => setSubTab('new')}>
          Novo Agendamento
        </button>
        <button
          className={`btn btn-outline ${subTab === 'my-bookings' ? 'active' : ''}`}
          onClick={() => setSubTab('my-bookings')}
        >
          Meus Agendamentos
        </button>
      </div>

      {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

      {subTab === 'new' ? (
        <form className="card" onSubmit={handleBook}>
          <h2>Reserve seu horário</h2>

          <div className="grid-2">
            <div className="form-group">
              <label>Unidade / Salão</label>
              <select value={selectedSalon} onChange={(e) => setSelectedSalon(e.target.value)} required>
                <option value="">Selecione...</option>
                {salons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Serviço</label>
              <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} required>
                <option value="">Escolha um serviço...</option>
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} — {srv.duration_minutes} min (R$ {srv.price})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Profissional (Opcional)</label>
              <select value={selectedProf} onChange={(e) => setSelectedProf(e.target.value)}>
                <option value="">Sem preferência</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.specialty ? `(${p.specialty})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Data desejada</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          {date && selectedService && (
            <div className="form-group">
              <label>Horários disponíveis</label>
              {loadingSlots ? (
                <p>Calculando horários livres...</p>
              ) : slots.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Nenhum horário disponível nesta data.
                </p>
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
            <div className="grid-2" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-group">
                <label>Seu Nome Completo</label>
                <input
                  type="text"
                  placeholder="Ex: Ana Paula"
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

          {selectedSlot && (
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Confirmar Agendamento às {selectedSlot.time}
            </button>
          )}
        </form>
      ) : (
        <div className="card">
          <h2>Consultar Meus Agendamentos</h2>
          <form onSubmit={handleSearchAppointments} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="tel"
              placeholder="Digite seu telefone (ex: 11988887777)"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" className="btn btn-primary">
              Buscar
            </button>
          </form>

          {myAppointments.map((appt) => (
            <div
              key={appt.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{appt.service_name}</strong>{' '}
                  <span className={`badge badge-${appt.status}`}>{appt.status}</span>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {new Date(appt.start_datetime).toLocaleString('pt-BR')} • Profissional:{' '}
                    {appt.professional_name || 'Qualquer'} • R$ {appt.price_charged}
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
                      <button type="button" className="btn btn-danger" onClick={() => handleCancel(appt.id)}>
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {rescheduleId === appt.id && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                  <label>Escolha a nova data:</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => loadRescheduleSlots(appt, e.target.value)}
                    style={{ marginLeft: '0.5rem' }}
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
                      style={{ marginTop: '0.75rem' }}
                      onClick={() => handleConfirmReschedule(appt.id)}
                    >
                      Salvar Novo Horário ({selectedRescheduleSlot.time})
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {logsModal && (
            <div className="card" style={{ background: '#f5f2ed', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>Histórico de Alterações (Auditoria)</h3>
                <button className="btn btn-outline" onClick={() => setLogsModal(null)}>
                  Fechar
                </button>
              </div>
              {logsModal.map((log) => (
                <p key={log.id} style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  • <strong>{log.action.toUpperCase()}</strong> em {new Date(log.created_at).toLocaleString('pt-BR')} (por{' '}
                  {log.changed_by})
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}