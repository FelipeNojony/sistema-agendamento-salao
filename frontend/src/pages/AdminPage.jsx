import { useState, useEffect } from 'react';
import { api } from '../services/api';

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function AdminPage() {
    const [token, setToken] = useState(localStorage.getItem('salon_token'));
    const [isRegistering, setIsRegistering] = useState(false); // Alterna entre Login e Cadastro
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [feedback, setFeedback] = useState(null);

    const [salons, setSalons] = useState([]);
    const [selectedSalon, setSelectedSalon] = useState('');
    const [appointments, setAppointments] = useState([]);

    // Formulários administrativos
    const [salonForm, setSalonForm] = useState({ name: '', slug: '', address: '', phone: '' });
    const [serviceForm, setServiceForm] = useState({ name: '', duration_minutes: 30, price: 50 });
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
                // 1. Cria a conta no backend
                await api.register({ name, email, password });
            }

            // 2. Faz o login e salva o token JWT
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
            setFeedback({ type: 'success', text: 'Salão cadastrado!' });
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
            setServiceForm({ name: '', duration_minutes: 30, price: 50 });
            setFeedback({ type: 'success', text: 'Serviço adicionado!' });
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
            setFeedback({ type: 'success', text: 'Horário de funcionamento atualizado!' });
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
            setFeedback({ type: 'success', text: 'Bloqueio / pausa registrado!' });
        } catch (err) {
            setFeedback({ type: 'error', text: err.message });
        }
    }

    // TELA DE LOGIN / REGISTRO
    if (!token) {
        return (
            <form className="card" style={{ maxWidth: '420px', margin: '2rem auto' }} onSubmit={handleAuthSubmit}>
                <h2>{isRegistering ? 'Criar Conta Administrativa' : 'Acesso Administrativo'}</h2>
                {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

                {isRegistering && (
                    <div className="form-group">
                        <label>Seu Nome</label>
                        <input
                            type="text"
                            placeholder="Ex: Felipe Santos"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                )}

                <div className="form-group">
                    <label>E-mail do Administrador</label>
                    <input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Senha</label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    {isRegistering ? 'Cadastrar e Entrar' : 'Entrar no Painel'}
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

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <strong>Unidade Ativa:</strong>
                    <select value={selectedSalon} onChange={(e) => setSelectedSalon(e.target.value)}>
                        {salons.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <button className="btn btn-outline" onClick={handleLogout}>
                    Sair
                </button>
            </div>

            {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

            <div className="grid-2">
                {/* 1. Cadastrar Unidade */}
                <form className="card" onSubmit={handleCreateSalon}>
                    <h3>1. Nova Unidade / Salão</h3>
                    <div className="form-group">
                        <label>Nome do Salão</label>
                        <input value={salonForm.name} onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Slug (identificador único)</label>
                        <input
                            placeholder="ex: unidade-jardins"
                            value={salonForm.slug}
                            onChange={(e) => setSalonForm({ ...salonForm, slug: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Endereço</label>
                        <input value={salonForm.address} onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })} />
                    </div>
                    <button type="submit" className="btn btn-primary">
                        Cadastrar Salão
                    </button>
                </form>

                {/* 2. Cadastrar Serviço */}
                <form className="card" onSubmit={handleCreateService}>
                    <h3>2. Novo Serviço</h3>
                    <div className="form-group">
                        <label>Nome do Serviço</label>
                        <input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
                    </div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>Duração (minutos)</label>
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

                {/* 3. Cadastrar Profissional */}
                <form className="card" onSubmit={handleCreateProf}>
                    <h3>3. Novo Profissional</h3>
                    <div className="form-group">
                        <label>Nome</label>
                        <input value={profForm.name} onChange={(e) => setProfForm({ ...profForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Especialidade</label>
                        <input
                            placeholder="Ex: Manicure, Corte, Estética"
                            value={profForm.specialty}
                            onChange={(e) => setProfForm({ ...profForm, specialty: e.target.value })}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">
                        Cadastrar Profissional
                    </button>
                </form>

                {/* 4. Horários de Funcionamento e Dias Fechados */}
                <form className="card" onSubmit={handleSetHours}>
                    <h3>4. Horário Semanal / Dia Fechado</h3>
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
                        <label>Marcar este dia da semana como FECHADO</label>
                    </div>
                    <button type="submit" className="btn btn-primary">
                        Salvar Regra de Horário
                    </button>
                </form>
            </div>

            {/* 5. Bloqueios e Pausas */}
            <form className="card" onSubmit={handleCreateBlock}>
                <h3>5. Criar Bloqueio / Pausa / Feriado</h3>
                <div className="grid-2">
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
                </div>
                <div className="form-group">
                    <label>Motivo</label>
                    <input
                        placeholder="Ex: Feriado Municipal, Pausa Almoço"
                        value={blockForm.reason}
                        onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                    />
                </div>
                <button type="submit" className="btn btn-primary">
                    Registrar Bloqueio
                </button>
            </form>

            {/* 6. Agenda Geral da Unidade */}
            <div className="card">
                <h3>Agenda da Unidade ({appointments.length} registros)</h3>
                {appointments.map((appt) => (
                    <div key={appt.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                        <strong>{new Date(appt.start_datetime).toLocaleString('pt-BR')}</strong> — {appt.client_name} ({appt.client_phone}) •{' '}
                        {appt.service_name} <span className={`badge badge-${appt.status}`}>{appt.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}