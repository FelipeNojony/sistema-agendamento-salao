export async function authenticate(request, reply) {
  try {
    // O plugin @fastify/jwt lê o header Authorization, valida a assinatura
    // e preenche request.user com os dados do usuário logado (id, email, role)
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      error: 'Acesso não autorizado. Token inválido ou ausente.',
    });
  }
}