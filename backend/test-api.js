const BASE_URL = 'http://localhost:3333';

async function runTests() {
  console.log('🧪 INICIANDO BATERIA DE TESTES DA API DO SALÃO...\n');

  try {
    // 1. REGISTRAR DONO DO SALÃO
    console.log('1️⃣ Cadastrando administrador...');
    const email = `felipe_${Date.now()}@salao.com`; // E-mail único para você poder rodar o teste várias vezes
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Felipe Santos', email, password: 'senha_super_segura' }),
    });
    const regData = await regRes.json();
    console.log('✅ Usuário criado:', regData.user.email);

    // 2. LOGIN E OBTENÇÃO DO TOKEN JWT
    console.log('\n2️⃣ Fazendo login para obter Token JWT...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'senha_super_segura' }),
    });
    const { token } = await loginRes.json();
    console.log('✅ Token JWT obtido com sucesso!');

    // Cabeçalho padrão para rotas privadas
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 3. CADASTRAR SALÃO / UNIDADE
    console.log('\n3️⃣ Cadastrando unidade do salão...');
    const salonRes = await fetch(`${BASE_URL}/salons`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Studio Beleza Premium',
        slug: `studio-premium-${Date.now()}`,
        address: 'Av. Paulista, 1000 - São Paulo',
        phone: '11999999999',
      }),
    });
    const { salon } = await salonRes.json();
    console.log('✅ Salão criado:', salon.name, '| ID:', salon.id);

    // 4. CADASTRAR PROFISSIONAL
    console.log('\n4️⃣ Cadastrando profissional...');
    const profRes = await fetch(`${BASE_URL}/salons/${salon.id}/professionals`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Camila Oliveira', specialty: 'Colorista e Corte' }),
    });
    const { professional } = await profRes.json();
    console.log('✅ Profissional cadastrada:', professional.name);

    // 5. CADASTRAR SERVIÇO (45 minutos, R$ 120,00)
    console.log('\n5️⃣ Cadastrando serviço...');
    const servRes = await fetch(`${BASE_URL}/salons/${salon.id}/services`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Corte Feminino + Hidratação',
        description: 'Corte completo com tratamento capilar',
        duration_minutes: 45,
        price: 120.0,
      }),
    });
    const { service } = await servRes.json();
    console.log('✅ Serviço cadastrado:', service.name, `(${service.duration_minutes} min - R$ ${service.price})`);

    // 6. CONFIGURAR HORÁRIO DE FUNCIONAMENTO (Vamos abrir todos os dias da semana 0 a 6 das 09:00 às 18:00 para o teste)
    console.log('\n6️⃣ Configurando grade de horários (09:00 às 18:00)...');
    for (let day = 0; day <= 6; day++) {
      await fetch(`${BASE_URL}/salons/${salon.id}/business-hours`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          day_of_week: day,
          open_time: '09:00',
          close_time: '18:00',
          is_closed: false,
        }),
      });
    }
    console.log('✅ Horários configurados!');

    // 7. CRIAR BLOQUEIO / PAUSA DE ALMOÇO (Amanhã das 12:00 às 13:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`\n7️⃣ Criando pausa de almoço para ${dateStr} (12:00 às 13:00)...`);
    await fetch(`${BASE_URL}/salons/${salon.id}/time-offs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        professional_id: professional.id,
        start_datetime: `${dateStr}T12:00:00-03:00`,
        end_datetime: `${dateStr}T13:00:00-03:00`,
        reason: 'Pausa para Almoço',
      }),
    });
    console.log('✅ Pausa criada! (Note que 11:30 também deve sumir pois o serviço dura 45 min e invadiria o almoço)');

    // 8. CONSULTAR DISPONIBILIDADE ANTES DE AGENDAR
    console.log(`\n8️⃣ Consultando horários disponíveis para ${dateStr}...`);
    const availRes1 = await fetch(
      `${BASE_URL}/salons/${salon.id}/availability?date=${dateStr}&serviceId=${service.id}&professionalId=${professional.id}`
    );
    const availData1 = await availRes1.json();
    console.log('📅 Horários livres:', availData1.available_slots.map((s) => s.time).join(', '));

    // 9. REALIZAR UM AGENDAMENTO ÀS 10:00
    console.log('\n9️⃣ Criando agendamento às 10:00 para a cliente Mariana...');
    const apptRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salon_id: salon.id,
        professional_id: professional.id,
        service_id: service.id,
        client_name: 'Mariana Costa',
        client_phone: '11988887777',
        start_datetime: `${dateStr}T10:00:00-03:00`,
      }),
    });
    const { appointment } = await apptRes.json();
    console.log('✅ Agendamento confirmado! ID:', appointment.id);

    // 10. TESTE DE FOGO: TENTAR DUPLICAR O MESMO HORÁRIO (10:15 - colide com 10:00-10:45)
    console.log('\n🔟 TESTE DE SEGURANÇA: Tentando agendar outro cliente às 10:15 (deve ser bloqueado)...');
    const dupRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salon_id: salon.id,
        professional_id: professional.id,
        service_id: service.id,
        client_name: 'Cliente Intruso',
        client_phone: '11977776666',
        start_datetime: `${dateStr}T10:15:00-03:00`,
      }),
    });
    const dupData = await dupRes.json();
    console.log(`🛡️ Status HTTP: ${dupRes.status} | Resposta:`, dupData);

    // 11. REAGENDAR DA MARI PARA AS 14:00
    console.log('\n1️⃣1️⃣ Reagendando Mariana das 10:00 para as 14:00...');
    const reschedRes = await fetch(`${BASE_URL}/appointments/${appointment.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_start_datetime: `${dateStr}T14:00:00-03:00` }),
    });
    console.log('✅ Reagendado com sucesso! Status:', reschedRes.status);

    // 12. CONSULTAR HISTÓRICO DE ALTERAÇÕES (AUDITORIA)
    console.log('\n1️⃣2️⃣ Consultando histórico de auditoria do agendamento...');
    const logsRes = await fetch(`${BASE_URL}/appointments/${appointment.id}/logs`);
    const { logs } = await logsRes.json();
    console.log('📜 Logs registrados no banco:', logs.map((l) => `${l.action} por ${l.changed_by}`));

    console.log('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
  } catch (err) {
    console.error('❌ Erro durante os testes:', err);
  }
}

runTests();