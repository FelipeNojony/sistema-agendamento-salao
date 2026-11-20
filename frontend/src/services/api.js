const API_URL = 'http://localhost:3333';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('salon_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
}

export const api = {
  // Autenticação
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  // Salões, Serviços e Profissionais
  getSalons: () => request('/salons'),
  createSalon: (body) => request('/salons', { method: 'POST', body: JSON.stringify(body) }),
  getServices: (salonId) => request(`/salons/${salonId}/services`),
  createService: (salonId, body) => request(`/salons/${salonId}/services`, { method: 'POST', body: JSON.stringify(body) }),
  getProfessionals: (salonId) => request(`/salons/${salonId}/professionals`),
  createProfessional: (salonId, body) => request(`/salons/${salonId}/professionals`, { method: 'POST', body: JSON.stringify(body) }),

  // Horários e Bloqueios
  setBusinessHours: (salonId, body) => request(`/salons/${salonId}/business-hours`, { method: 'POST', body: JSON.stringify(body) }),
  createTimeOff: (salonId, body) => request(`/salons/${salonId}/time-offs`, { method: 'POST', body: JSON.stringify(body) }),

  // Disponibilidade e Agendamentos
  getAvailability: (salonId, date, serviceId, professionalId) => {
    const params = new URLSearchParams({ date, serviceId });
    if (professionalId) params.append('professionalId', professionalId);
    return request(`/salons/${salonId}/availability?${params.toString()}`);
  },
  createAppointment: (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  getAppointments: (filters) => {
    const params = new URLSearchParams(filters);
    return request(`/appointments?${params.toString()}`);
  },
  rescheduleAppointment: (id, new_start_datetime) =>
    request(`/appointments/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify({ new_start_datetime }) }),
  cancelAppointment: (id, reason) =>
    request(`/appointments/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  getAppointmentLogs: (id) => request(`/appointments/${id}/logs`),
};