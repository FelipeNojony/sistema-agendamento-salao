import { pool, query } from '../config/db.js';

// ============================================================================
// FUNÇÕES AUXILIARES DE TEMPO (Padrão Sênior: trabalhar com minutos inteiros)
// ============================================================================

// Converte "09:30:00" ou "09:30" para 570 minutos
function timeStringToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Converte 570 minutos de volta para "09:30"
function minutesToTimeString(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Verifica se dois intervalos [startA, endA) e [startB, endB) se sobrepõem
function hasOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export async function appointmentRoutes(fastify) {
  // ==========================================================================
  // 1. CONSULTA DE DISPONIBILIDADE (O Cérebro do Sistema)
  // Exemplo de chamada: GET /salons/:salonId/availability?date=2026-11-25&serviceId=UUID&professionalId=UUID
  // ==========================================================================
  fastify.get('/salons/:salonId/availability', async (request, reply) => {
    const { salonId } = request.params;
    const { date, serviceId, professionalId } = request.query;

    if (!date || !serviceId) {
      return reply.status(400).send({
        error: 'Os parâmetros query "date" (YYYY-MM-DD) e "serviceId" são obrigatórios.',
      });
    }

    try {
      // 1. Busca a duração do serviço escolhido
      const serviceRes = await query(
        'SELECT duration_minutes FROM services WHERE id = $1 AND salon_id = $2 AND active = TRUE',
        [serviceId, salonId]
      );
      if (serviceRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Serviço não encontrado ou inativo.' });
      }
      const serviceDuration = serviceRes.rows[0].duration_minutes;

      // 2. Descobre o dia da semana (0 = Domingo ... 6 = Sábado) usando fuso de SP (-03:00)
      const targetDate = new Date(`${date}T00:00:00-03:00`);
      const dayOfWeek = targetDate.getUTCDay();

      // 3. Busca o horário de funcionamento (prioriza o horário do profissional, se não houver, pega o do salão)
      const hoursRes = await query(
        `SELECT * FROM business_hours 
         WHERE salon_id = $1 AND day_of_week = $2 
         AND (professional_id = $3 OR professional_id IS NULL)
         ORDER BY professional_id NULLS LAST LIMIT 1`,
        [salonId, dayOfWeek, professionalId || null]
      );

      const schedule = hoursRes.rows[0];
      if (!schedule || schedule.is_closed) {
        return reply.send({ date, available_slots: [], message: 'Estabelecimento fechado neste dia.' });
      }

      // Define início e fim do dia em Timestamp exato (-03:00 São Paulo)
      const dayStart = new Date(`${date}T00:00:00-03:00`);
      const dayEnd = new Date(`${date}T23:59:59-03:00`);

      // 4. Busca bloqueios e pausas (time_offs) que afetam o salão ou o profissional neste dia
      const timeOffsRes = await query(
        `SELECT start_datetime, end_datetime FROM time_offs
         WHERE salon_id = $1 
         AND (professional_id = $2 OR professional_id IS NULL)
         AND start_datetime < $4 AND end_datetime > $3`,
        [salonId, professionalId || null, dayStart.toISOString(), dayEnd.toISOString()]
      );

      // 5. Busca agendamentos já confirmados neste dia
      const appointmentsRes = await query(
        `SELECT start_datetime, end_datetime FROM appointments
         WHERE salon_id = $1 
         AND status = 'confirmed'
         AND ($2::uuid IS NULL OR professional_id = $2)
         AND start_datetime < $4 AND end_datetime > $3`,
        [salonId, professionalId || null, dayStart.toISOString(), dayEnd.toISOString()]
      );

      // 6. Gera os slots possíveis e filtra os ocupados
      const openMinutes = timeStringToMinutes(schedule.open_time);
      const closeMinutes = timeStringToMinutes(schedule.close_time);
      const slotStep = 30; // Grade oferece horários a cada 30 minutos (pode ser ajustado)
      const now = new Date();
      const availableSlots = [];

      for (let currentMin = openMinutes; currentMin + serviceDuration <= closeMinutes; currentMin += slotStep) {
        const slotTimeStr = minutesToTimeString(currentMin);
        const slotStart = new Date(`${date}T${slotTimeStr}:00-03:00`);
        const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);

        // Ignora horários que já passaram se a consulta for para hoje
        if (slotStart <= now) continue;

        // Verifica colisão com bloqueios/pausas
        const blockedByTimeOff = timeOffsRes.rows.some((block) =>
          hasOverlap(slotStart, slotEnd, new Date(block.start_datetime), new Date(block.end_datetime))
        );
        if (blockedByTimeOff) continue;

        // Verifica colisão com agendamentos existentes
        const blockedByAppointment = appointmentsRes.rows.some((appt) =>
          hasOverlap(slotStart, slotEnd, new Date(appt.start_datetime), new Date(appt.end_datetime))
        );
        if (blockedByAppointment) continue;

        availableSlots.push({
          time: slotTimeStr,
          start_datetime: slotStart.toISOString(),
          end_datetime: slotEnd.toISOString(),
        });
      }

      return reply.send({
        date,
        service_duration_minutes: serviceDuration,
        available_slots: availableSlots,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao calcular disponibilidade.' });
    }
  });


  // ==========================================================================
  // 2. CRIAR AGENDAMENTO (Com Transação + Trava Anti-Duplicidade + Log)
  // ==========================================================================
  fastify.post('/appointments', async (request, reply) => {
    const {
      salon_id,
      professional_id = null,
      service_id,
      client_name,
      client_phone,
      client_email = null,
      start_datetime,
      notes = null,
    } = request.body;

    if (!salon_id || !service_id || !client_name || !client_phone || !start_datetime) {
      return reply.status(400).send({ error: 'Campos obrigatórios ausentes.' });
    }

    const client = await pool.connect(); // Pega uma conexão exclusiva para a transação

    try {
      await client.query('BEGIN'); // Inicia a transação

      // 1. Busca preço e duração atuais do serviço
      const serviceRes = await client.query(
        'SELECT duration_minutes, price FROM services WHERE id = $1 AND salon_id = $2 AND active = TRUE',
        [service_id, salon_id]
      );
      if (serviceRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Serviço inválido ou inativo.' });
      }

      const { duration_minutes, price } = serviceRes.rows[0];
      const startDate = new Date(start_datetime);
      const endDate = new Date(startDate.getTime() + duration_minutes * 60000);

      // 2. Verifica se existe algum bloqueio (time_off) nesse período
      const blockCheck = await client.query(
        `SELECT id FROM time_offs 
         WHERE salon_id = $1 
         AND (professional_id = $2 OR professional_id IS NULL)
         AND start_datetime < $4 AND end_datetime > $3`,
        [salon_id, professional_id, startDate.toISOString(), endDate.toISOString()]
      );
      if (blockCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: 'Este horário está bloqueado por uma pausa ou feriado.' });
      }

      // 3. Insere o agendamento (se houver colisão simultânea, o PostgreSQL dispara erro 23P01)
      const insertRes = await client.query(
        `INSERT INTO appointments 
         (salon_id, professional_id, service_id, client_name, client_phone, client_email, start_datetime, end_datetime, price_charged, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          salon_id,
          professional_id,
          service_id,
          client_name,
          client_phone,
          client_email,
          startDate.toISOString(),
          endDate.toISOString(),
          price,
          notes,
        ]
      );
      const appointment = insertRes.rows[0];

      // 4. Registra no histórico de alterações (Auditoria)
      await client.query(
        `INSERT INTO appointment_logs (appointment_id, action, new_data, changed_by)
         VALUES ($1, 'created', $2, $3)`,
        [appointment.id, JSON.stringify(appointment), `client:${client_phone}`]
      );

      await client.query('COMMIT'); // Confirma tudo no banco de uma só vez!
      return reply.status(201).send({ appointment });
    } catch (error) {
      await client.query('ROLLBACK'); // Desfaz qualquer alteração se algo falhar

      // 23P01 = Exclusion Violation (nossa trava anti-duplicidade do PostgreSQL entrou em ação!)
      if (error.code === '23P01') {
        return reply.status(409).send({
          error: 'Desculpe, este horário acabou de ser reservado por outro cliente.',
        });
      }

      request.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao criar agendamento.' });
    } finally {
      client.release(); // Devolve a conexão para o pool (ESSENCIAL para não travar o servidor)
    }
  });


  // ==========================================================================
  // 3. CONSULTA DE AGENDAMENTOS (Por salão, data ou telefone do cliente)
  // ==========================================================================
  fastify.get('/appointments', async (request, reply) => {
    const { salonId, date, clientPhone } = request.query;

    try {
      let sql = `
        SELECT a.*, s.name AS service_name, p.name AS professional_name
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        LEFT JOIN professionals p ON a.professional_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (salonId) {
        params.push(salonId);
        sql += ` AND a.salon_id = $${params.length}`;
      }
      if (clientPhone) {
        params.push(clientPhone);
        sql += ` AND a.client_phone = $${params.length}`;
      }
      if (date) {
        params.push(`${date}T00:00:00-03:00`, `${date}T23:59:59-03:00`);
        sql += ` AND a.start_datetime >= $${params.length - 1} AND a.start_datetime <= $${params.length}`;
      }

      sql += ' ORDER BY a.start_datetime ASC';

      const result = await query(sql, params);
      return reply.send({ appointments: result.rows });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao consultar agendamentos.' });
    }
  });


  // ==========================================================================
  // 4. REAGENDAMENTO (Atualiza horário + Verifica conflito + Grava Histórico)
  // ==========================================================================
  fastify.patch('/appointments/:id/reschedule', async (request, reply) => {
    const { id } = request.params;
    const { new_start_datetime, changed_by = 'client' } = request.body;

    if (!new_start_datetime) {
      return reply.status(400).send({ error: 'new_start_datetime é obrigatório.' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Busca o agendamento atual e a duração do serviço
      const currentRes = await client.query(
        `SELECT a.*, s.duration_minutes 
         FROM appointments a 
         JOIN services s ON a.service_id = s.id 
         WHERE a.id = $1`,
        [id]
      );
      if (currentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Agendamento não encontrado.' });
      }

      const oldAppt = currentRes.rows[0];
      if (oldAppt.status !== 'confirmed') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Apenas agendamentos confirmados podem ser reagendados.' });
      }

      const newStart = new Date(new_start_datetime);
      const newEnd = new Date(newStart.getTime() + oldAppt.duration_minutes * 60000);

      // 2. Atualiza o agendamento (se colidir com outro, o PostgreSQL dispara 23P01)
      const updateRes = await client.query(
        `UPDATE appointments 
         SET start_datetime = $1, end_datetime = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newStart.toISOString(), newEnd.toISOString(), id]
      );
      const updatedAppt = updateRes.rows[0];

      // 3. Registra o antes e depois no histórico
      await client.query(
        `INSERT INTO appointment_logs (appointment_id, action, old_data, new_data, changed_by)
         VALUES ($1, 'rescheduled', $2, $3, $4)`,
        [
          id,
          JSON.stringify({ start_datetime: oldAppt.start_datetime, end_datetime: oldAppt.end_datetime }),
          JSON.stringify({ start_datetime: updatedAppt.start_datetime, end_datetime: updatedAppt.end_datetime }),
          changed_by,
        ]
      );

      await client.query('COMMIT');
      return reply.send({ appointment: updatedAppt });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23P01') {
        return reply.status(409).send({ error: 'O novo horário escolhido já está ocupado.' });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao reagendar.' });
    } finally {
      client.release();
    }
  });


  // ==========================================================================
  // 5. CANCELAMENTO (Muda status para 'cancelled' + Libera horário + Log)
  // ==========================================================================
  fastify.patch('/appointments/:id/cancel', async (request, reply) => {
    const { id } = request.params;
    const { reason = 'Cancelado pelo usuário', changed_by = 'client' } = request.body || {};

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentRes = await client.query('SELECT * FROM appointments WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Agendamento não encontrado.' });
      }

      const oldAppt = currentRes.rows[0];

      const updateRes = await client.query(
        `UPDATE appointments 
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      await client.query(
        `INSERT INTO appointment_logs (appointment_id, action, old_data, new_data, changed_by)
         VALUES ($1, 'cancelled', $2, $3, $4)`,
        [
          id,
          JSON.stringify({ status: oldAppt.status }),
          JSON.stringify({ status: 'cancelled', reason }),
          changed_by,
        ]
      );

      await client.query('COMMIT');
      return reply.send({ appointment: updateRes.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao cancelar agendamento.' });
    } finally {
      client.release();
    }
  });


  // ==========================================================================
  // 6. CONSULTAR HISTÓRICO DE ALTERAÇÕES DE UM AGENDAMENTO
  // ==========================================================================
  fastify.get('/appointments/:id/logs', async (request, reply) => {
    const { id } = request.params;
    const result = await query(
      'SELECT * FROM appointment_logs WHERE appointment_id = $1 ORDER BY created_at ASC',
      [id]
    );
    return reply.send({ logs: result.rows });
  });
}