import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

export async function authRoutes(fastify) {
  // ROTA 1: Registrar novo administrador/dono de salão
  fastify.post('/auth/register', async (request, reply) => {
    const { name, email, password } = request.body;

    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    try {
      // Verifica se o e-mail já existe
      const userExists = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (userExists.rows.length > 0) {
        return reply.status(409).send({ error: 'Este e-mail já está cadastrado.' });
      }

      // Gera o hash seguro da senha (custo 10)
      const passwordHash = await bcrypt.hash(password, 10);

      // Usa parâmetros ($1, $2, $3) para evitar SQL Injection!
      const result = await query(
        `INSERT INTO users (name, email, password_hash) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, email, role, created_at`,
        [name, email, passwordHash]
      );

      return reply.status(201).send({ user: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao registrar usuário.' });
    }
  });

  // ROTA 2: Login (Gera o Token JWT)
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return reply.status(401).send({ error: 'Credenciais inválidas.' });
      }

      // Compara a senha digitada com o hash salvo no banco
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Credenciais inválidas.' });
      }

      // Gera o token contendo o ID e a role do usuário
      const token = fastify.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '7d' } // Token válido por 7 dias
      );

      return reply.send({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao realizar login.' });
    }
  });
}