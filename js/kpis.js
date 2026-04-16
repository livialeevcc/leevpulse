let clienteAtual = '';

async function carregarClientes() {
  const { data } = await sb.from('clients').select('slug, nome').order('nome');
  const opcoes = [
    { value: '', label: 'todos os clientes' },
    ...(data || []).map(c => ({ value: c.slug, label: c.nome }))
  ];
  renderDropdown({
    elementId: 'filtro-cliente',
    opcoes,
    placeholder: 'filtrar cliente...',
    onChange: (value) => {
      clienteAtual = value;
      renderKPIs();
    }
  });
}

let periodoAtual = 30;

function setPeriodo(dias, btn) {
  periodoAtual = dias;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderKPIs();
}

async function buscarEventos() {
  let query = sb
    .from('events')
    .select('*')
    .eq('evento', 'relato_de_ocorrencia')
    .gte('timestamp', getDataInicio())
    .order('timestamp', { ascending: true });

  const { data } = await query;
  return (data || []).filter(r =>
    !clienteAtual || r.dados?.cliente_id === clienteAtual
  );
}

async function buscarEventosGeral() {
  const { data } = await sb
    .from('events')
    .select('*')
    .eq('evento', 'relato_de_ocorrencia')
    .gte('timestamp', getDataInicio())
    .order('timestamp', { ascending: true });

  return data || [];
}

async function buscarEventosTendencia() {
  const inicio = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('events')
    .select('*')
    .eq('evento', 'relato_de_ocorrencia')
    .gte('timestamp', inicio)
    .order('timestamp', { ascending: true });

  return (data || []).filter(r =>
    !clienteAtual || r.dados?.cliente_id === clienteAtual
  );
}

function getDataInicio() {
  const d = new Date();
  if (periodoAtual === 1) {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  d.setDate(d.getDate() - periodoAtual);
  return d.toISOString();
}

async function renderKPIs() {

    const eventosGeral = await buscarEventosGeral();
    eventosGeral.forEach(r => {
        //console.log('timestamp:', r.timestamp, 'hora_relato:', r.dados?.hora_relato);
    });
    const totalGeral = eventosGeral.length;

    const temposGeral = eventosGeral
        .filter(r => r.dados?.hora_relato)
        .map(r => {
        const registrado = new Date(r.timestamp);
        const [h, m] = r.dados.hora_relato.split(':');
        const relatado = new Date(registrado);
        relatado.setUTCHours(Number(h), Number(m), 0, 0);
        const diff = (registrado - relatado) / 60000;
        return diff;
        })
        .filter(t => t > 0);

    const tempoMedioGeral = temposGeral.length > 0
        ? Math.round(temposGeral.reduce((a, b) => a + b, 0) / temposGeral.length)
        : null;

    renderMetricCard({
        elementId: 'card-total-geral',
        label: 'Total de ocorrências',
        value: totalGeral,
        sub: `últimos ${periodoAtual} dia(s)`
    });

    renderMetricCard({
        elementId: 'card-tempo-medio-geral',
        label: 'Tempo médio de resolução',
        value: tempoMedioGeral ? tempoMedioGeral + ' min' : '—',
        sub: 'desde relato até registro'
    });

    const eventos = await buscarEventos();
    console.log('periodo atual:', periodoAtual);
    console.log('data inicio:', getDataInicio());
    console.log('eventos timestamps:', eventos.map(r => r.timestamp));
    console.log('cliente atual:', clienteAtual);
    console.log('eventos filtrados:', eventos.length);
    console.log('eventos:', eventos.map(r => r.dados?.cliente_id));
    const total = eventos.length;

    renderMetricCard({
        elementId: 'card-total',
        label: 'Total de ocorrências',
        value: total,
        sub: `últimos ${periodoAtual} dia(s)`
    });

    const tempos = eventos
        .filter(r => r.dados?.hora_relato)
        .map(r => {
            const registrado = new Date(r.timestamp);
            const [h, m] = r.dados.hora_relato.split(':');
            const relatado = new Date(registrado);
            relatado.setUTCHours(Number(h), Number(m), 0, 0);
            return (registrado - relatado) / 60000;
        })
        .filter(t => t > 0);

    const tempoMedio = tempos.length > 0
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : null;

    renderMetricCard({
        elementId: 'card-tempo-medio',
        label: 'Tempo médio de resolução',
        value: tempoMedio ? tempoMedio + ' min' : '—',
        sub: 'desde relato até registro'
    });

    const operadorTempos = {};
    const operadorContagens = {};

    eventosGeral
        .filter(r => r.dados?.hora_relato)
        .forEach(r => {
        const registrado = new Date(r.timestamp);
        const [h, m] = r.dados.hora_relato.split(':');
        const relatado = new Date(registrado);
        relatado.setUTCHours(Number(h), Number(m), 0, 0);
        const diff = (registrado - relatado) / 60000;
        if (diff <= 0) return;

        const op = r.operador_id?.split('@')[0] || '—';
        operadorTempos[op] = (operadorTempos[op] || 0) + diff;
        operadorContagens[op] = (operadorContagens[op] || 0) + 1;
        });

    const categorias = Object.keys(operadorTempos);
    const valores = categorias.map(op =>
        Math.round(operadorTempos[op] / operadorContagens[op])
    );

    document.getElementById('chart-tempo-operador').innerHTML = '';
    renderBarHorizontal({
        elementId: 'chart-tempo-operador',
        categorias,
        valores,
        label: 'Tempo médio (min)'
    });

    const tipos = [...new Set(eventos.map(r => r.dados?.tipo).filter(Boolean))];
  const pessoaMap = {};

  eventos.forEach(r => {
    const pessoa = r.dados?.relatado_por || '—';
    const tipo = r.dados?.tipo || 'desconhecido';
    if (!pessoaMap[pessoa]) pessoaMap[pessoa] = {};
    pessoaMap[pessoa][tipo] = (pessoaMap[pessoa][tipo] || 0) + 1;
  });

  const pessoaCategorias = Object.keys(pessoaMap).sort((a, b) => {
    const totalA = Object.values(pessoaMap[a]).reduce((s, v) => s + v, 0);
    const totalB = Object.values(pessoaMap[b]).reduce((s, v) => s + v, 0);
    return totalB - totalA;
  });
  const pessoaLabels = pessoaCategorias.map(p => {
    const ev = eventos.find(r => r.dados?.relatado_por === p);
    const cliente = ev?.dados?.cliente_id || '—';
    return clienteAtual ? p : `${p} — ${cliente}`;
  });
  const pessoaSeries = tipos.map(tipo => ({
    name: tipo,
    data: pessoaCategorias.map(p => pessoaMap[p][tipo] || 0)
  }));

  document.getElementById('chart-relatado-tipo').innerHTML = '';
  renderBarStacked({
    elementId: 'chart-relatado-tipo',
    categorias: pessoaLabels,
    series: pessoaSeries
  });

  const tipoCount = {};
  eventos.forEach(r => {
    const tipo = r.dados?.tipo || 'desconhecido';
    tipoCount[tipo] = (tipoCount[tipo] || 0) + 1;
  });

  document.getElementById('chart-tipos').innerHTML = '';
  renderDonut({
    elementId: 'chart-tipos',
    labels: Object.keys(tipoCount),
    valores: Object.values(tipoCount)
  });

  const diasMap = {};
  const tiposHistorico = [...new Set(eventos.map(r => r.dados?.tipo).filter(Boolean))];

  eventos.forEach(r => {
    const dia = new Date(r.timestamp).toLocaleDateString('pt-BR');
    const tipo = r.dados?.tipo || 'desconhecido';
    if (!diasMap[dia]) diasMap[dia] = {};
    diasMap[dia][tipo] = (diasMap[dia][tipo] || 0) + 1;
  });

  const diasCategorias = Object.keys(diasMap).sort((a, b) => {
    const [da, ma, ya] = a.split('/');
    const [db, mb, yb] = b.split('/');
    return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
  });

  const historicoSeries = tiposHistorico.map(tipo => ({
    name: tipo,
    data: diasCategorias.map(d => diasMap[d][tipo] || 0)
  }));

  document.getElementById('chart-historico').innerHTML = '';
  renderBarStacked({
    elementId: 'chart-historico',
    categorias: diasCategorias,
    series: historicoSeries,
    horizontal: false
  });

  const relatorCount = {};
  eventos.forEach(r => {
    const p = r.dados?.relatado_por || '—';
    relatorCount[p] = (relatorCount[p] || 0) + 1;
  });

  const relatores = Object.keys(relatorCount).sort((a, b) => relatorCount[b] - relatorCount[a]);
  const valoresRelator = relatores.map(p => relatorCount[p]);
  const mediaRelator = Math.round(valoresRelator.reduce((a, b) => a + b, 0) / valoresRelator.length);

  document.getElementById('chart-relator-media').innerHTML = '';
  renderBarHorizontal({
    elementId: 'chart-relator-media',
    categorias: relatores,
    valores: valoresRelator,
    label: 'ocorrências',
    media: mediaRelator
  });

  const totalEventos = eventos.length;

  const taxaBio = totalEventos > 0
    ? Math.round(eventos.filter(r => r.dados?.tipo === 'bio').length / totalEventos * 100)
    : 0;

  const eventosTendencia = await buscarEventosTendencia();
  const agora = Date.now();
  const semanaAtual = eventosTendencia.filter(r =>
    new Date(r.timestamp) >= new Date(agora - 7 * 24 * 60 * 60 * 1000)
  ).length;
  const semanaAnterior = eventosTendencia.filter(r => {
    const t = new Date(r.timestamp);
    const inicio = new Date(agora - 14 * 24 * 60 * 60 * 1000);
    const fim = new Date(agora - 7 * 24 * 60 * 60 * 1000);
    return t >= inicio && t < fim;
  }).length;

  console.log('semana atual:', semanaAtual, 'semana anterior:', semanaAnterior);
  const tendencia = semanaAnterior > 0
    ? Math.round((semanaAtual - semanaAnterior) / semanaAnterior * 100)
    : null;

  const resolucaoRapida = tempos.length > 0
    ? Math.round(tempos.filter(t => t <= 60).length / tempos.length * 100)
    : 0;

  const relatoresUnicos = new Set(eventos.map(r => r.dados?.relatado_por).filter(Boolean));
  const relatoresRecorrentes = [...relatoresUnicos].filter(p =>
    eventos.filter(r => r.dados?.relatado_por === p).length > 1
  ).length;
  const taxaReincidencia = relatoresUnicos.size > 0
    ? Math.round(relatoresRecorrentes / relatoresUnicos.size * 100)
    : 0;

  renderMetricCard({ elementId: 'card-taxa-bio', label: 'Taxa de bio', value: taxaBio + '%', sub: 'do total de ocorrências' });
  renderMetricCard({ elementId: 'card-tendencia', label: 'Tendência', value: tendencia !== null ? (tendencia > 0 ? '+' : '') + tendencia + '%' : '—', sub: 'vs semana anterior' });
  renderMetricCard({ elementId: 'card-resolucao-rapida', label: 'Resolução rápida', value: resolucaoRapida + '%', sub: 'resolvidas em menos de 60min' });
  renderMetricCard({ elementId: 'card-reincidencia', label: 'Reincidência', value: taxaReincidencia + '%', sub: 'relatores com mais de 1 ocorrência' });

}

renderKPIs();

carregarClientes();