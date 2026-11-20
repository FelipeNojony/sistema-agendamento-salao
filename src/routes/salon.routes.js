import { query } from '../config/db.js';
import { authenticate } from '../middlewares/auth.js';

export async function salonRoutes(fastify) {
  // ==========================================================================
  // 1. SALÕES / UNIDADES
  // ==========================================================================
  
  // Criar novo salão (Privado - exige Token JWT)
  fastify.post('/salons', { preHandler: [authenticate] }, async (request, reply) => {
    const { name, slug, address, phone } = request.body;
    const ownerId = request.user.id; // Extraído automaticamente do token JWT

    if (!name || !slug) {
      return reply.status(400).send({ error: 'Nome e slug da unidade são obrigatórios.' });
    }

    try {
      const result = await query(
        `INSERT INTO salons (owner_id, name, slug, address, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [ownerId, name, slug.toLowerCase().trim(), address, phone]
      );
      return reply.status(201).send({ salon: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') { // Código de erro do PostgreSQL para UNIQUE violation
        return reply.status(409).send({ error: 'Já existe um salão com este slug.' });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao cadastrar salão.' });
    }
  });

  // Listar todos os salões ativos (Público)
  fastify.get('/salons', async (request, reply) => {
    const result = await query('SELECT id, name, slug, address, phone FROM salons WHERE active = TRUE');
    return reply.send({ salons: result.rows });
  });


  // ==========================================================================
  // 2. SERVIÇOS (Duração e Preço)
  // ==========================================================================

  // Cadastrar serviço em um salão (Privado)
  fastify.post('/salons/:salonId/services', { preHandler: [authenticate] }, async (request, reply) => {
    const { salonId } = request.params;
    const { name, description, duration_minutes, price } = request.body;

    if (!name || !duration_minutes || price === undefined) {
      return reply.status(400).send({ error: 'Nome, duração (minutos) e preço são obrigatórios.' });
    }

    try {
      const result = await query(
        `INSERT INTO services (salon_id, name, description, duration_minutes, price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [salonId, name, description, duration_minutes, price]
      );
      return reply.status(201).send({ service: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao cadastrar serviço.' });
    }
  });

  // Listar serviços de um salão (Público)
  fastify.get('/salons/:salonId/services', async (request, reply) => {
    const { salonId } = request.params;
    const result = await query(
      'SELECT id, name, description, duration_minutes, price FROM services WHERE salon_id = $1 AND active = TRUE',
      [salonId]
    );
    return reply.send({ services: result.rows });
  });


  // ==========================================================================
  // 3. PROFISSIONAIS (Opcional por salão)
  // ==========================================================================

  // Cadastrar profissional (Privado)
  fastify.post('/salons/:salonId/professionals', { preHandler: [authenticate] }, async (request, reply) => {
    const { salonId } = request.params;
    const { name, specialty } = request.body;

    if (!name) {
      return reply.status(400).send({ error: 'Nome do profissional é obrigatório.' });
    }

    try {
      const result = await query(
        `INSERT INTO professionals (salon_id, name, specialty)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [salonId, name, specialty]
      );
      return reply.status(201).send({ professional: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao cadastrar profissional.' });
    }
  });

  // Listar profissionais de um salão (Público)
  fastify.get('/salons/:salonId/professionals', async (request, reply) => {
    const { salonId } = request.params;
    const result = await query(
      'SELECT id, name, specialty FROM professionals WHERE salon_id = $1 AND active = TRUE',
      [salonId]
    );
    return reply.send({ professionals: result.rows });
  });


  // ==========================================================================
  // 4. HORÁRIOS DE FUNCIONAMENTO E DIAS FECHADOS
  // ==========================================================================

  // Definir horário de um dia da semana (0 = Domingo ... 6 = Sábado) (Privado)
  fastify.post('/salons/:salonId/business-hours', { preHandler: [authenticate] }, async (request, reply) => {
    const { salonId } = request.params;
    const { professional_id = null, day_of_week, open_time, close_time, is_closed = false } = request.body;

    if (day_of_week === undefined || !open_time || !close_time) {
      return reply.status(400).send({ error: 'day_of_week, open_time e close_time são obrigatórios.' });
    }

    try {
      // Remove configuração anterior para o mesmo dia/profissional antes de inserir a nova (Upsert limpo)
      await query(
        `DELETE FROM business_hours 
         WHERE salon_id = $1 AND day_of_week = $2 AND professional_id IS NOT DISTINCT FROM $3`,
        [salonId, day_of_week, professional_id]
      );

      const result = await query(
        `INSERT INTO business_hours (salon_id, professional_id, day_of_week, open_time, close_time, is_closed)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [salonId, professional_id, day_of_week, open_time, close_time, is_closed]
      );

      return reply.status(201).send({ business_hour: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao salvar horário de funcionamento.' });
    }
  });

  // Listar grade de horários do salão (Público)
  fastify.get('/salons/:salonId/business-hours', async (request, reply) => {
    const { salonId } = request.params;
    const result = await query(
      'SELECT * FROM business_hours WHERE salon_id = $1 ORDER BY day_of_week ASC',
      [salonId]
    );
    return reply.send({ business_hours: result.rows });
  });


  // ==========================================================================
  // 5. BLOQUEIOS E PAUSAS (Almoço, Feriados, Férias)
  // ==========================================================================

  // Criar bloqueio pontual (Privado)
  fastify.post('/salons/:salonId/time-offs', { preHandler: [authenticate] }, async (request, reply) => {
    const { salonId } = request.params;
    const { professional_id = null, start_datetime, end_datetime, reason } = request.body;

    if (!start_datetime || !end_datetime) {
      return reply.status(400).send({ error: 'start_datetime e end_datetime são obrigatórios.' });
    }

    try {
      const result = await query(
        `INSERT INTO time_offs (salon_id, professional_id, start_datetime, end_datetime, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [salonId, professional_id, start_datetime, end_datetime, reason]
      );
      return reply.status(201).send({ time_off: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao criar bloqueio.' });
    }
  });
}