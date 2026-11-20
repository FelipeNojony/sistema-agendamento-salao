import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { authRoutes } from './routes/auth.routes.js';
import { salonRoutes } from './routes/salon.routes.js';
import { appointmentRoutes } from './routes/appointment.routes.js';

dotenv.config();

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: '*' });
await fastify.register(jwt, { secret: process.env.JWT_SECRET });

fastify.get('/health', async (request, reply) => {
  const dbCheck = await pool.query('SELECT NOW()');
  return { status: 'online', database_time: dbCheck.rows[0].now };
});

await fastify.register(authRoutes);
await fastify.register(salonRoutes);
await fastify.register(appointmentRoutes); // <-- REGISTRO DAS ROTAS DE AGENDAMENTO

const start = async () => {
  try {
    const port = process.env.PORT || 3333;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();