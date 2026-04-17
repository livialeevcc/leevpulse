let filtrosAtivos = {};
let kpiConfigsGlobal = [];

const alturasPorTipo = {
  filtro_periodo: 0,
  filtro_cliente: 0,
  titulo:         0,
  metric_card:    1.5,
  donut:          4,
  bar_horizontal: 4,
  bar_stacked:    4,
  bar_vertical:   5,
};

function calcularUnidade(aba) {
  const configs = kpiConfigsGlobal.filter(c => c.aba === aba);
  const linhasMap = {};
  
  configs.forEach(c => {
    const linha = c.linha_matriz;
    if (!linhasMap[linha]) linhasMap[linha] = [];
    linhasMap[linha].push(c);
  });

  const totalUnidades = Object.values(linhasMap).reduce((total, itens) => {
    const maxAltura = Math.max(...itens.map(c => alturasPorTipo[c.tipo_grafico] || 0));
    return total + maxAltura;
  }, 0);

  const alturaUtil = window.innerHeight - 180;
  const unidade = totalUnidades > 0 ? Math.floor(alturaUtil / totalUnidades) : 60;
  return Math.min(unidade, 80);
}

async function buscarKpiConfig() {
  const { data } = await sb
    .from('kpi_config')
    .select('*')
    .order('ordem', { ascending: true });
  return data || [];
}

function getDataInicio() {
  const periodo = filtrosAtivos['periodo'] || 30;
  const d = new Date();
  if (periodo === 1) {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  d.setDate(d.getDate() - periodo);
  return d.toISOString();
}

async function buscarEventos(evento) {
  const { data } = await sb
    .from('events')
    .select('*')
    .eq('evento', evento)
    .gte('timestamp', getDataInicio())
    .order('timestamp', { ascending: true });

  const cliente = filtrosAtivos['cliente'] || '';
  return (data || []).filter(r =>
    !cliente || r.dados?.cliente_id === cliente
  );
}

function onFiltroChange(tipo, valor) {
  filtrosAtivos[tipo] = valor;
  const afetados = kpiConfigsGlobal.filter(c =>
    Array.isArray(c.filtros) && c.filtros.includes(tipo)
  );
  renderGraficos(afetados);
}

function setPeriodo(dias, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  onFiltroChange('periodo', dias);
}

async function renderGraficos(configs) {
  const eventoIds = [...new Set(configs.map(c => c.evento))];

  const unidade = calcularUnidade(configs[0]?.aba);

  const eventosCache = {};
  for (const evento of eventoIds) {
    eventosCache[evento] = await buscarEventos(evento);
  }

  for (const config of configs) {
    if (config.tipo_grafico === 'titulo' || config.tipo_grafico === 'filtro_periodo' || config.tipo_grafico === 'filtro_cliente') continue;

    const eventos = eventosCache[config.evento];
    const fn = funcoes[config.funcao];
    if (!fn) continue;

    const dados = await fn(eventos, config.campo_grupo, config.campo_valor);
    const el = document.getElementById(config.elemento_id);
    if (!el) continue;
    el.innerHTML = '';

    const calcularAltura = (tipo) => (alturasPorTipo[tipo] || 4) * unidade - 80;

    if (config.tipo_grafico === 'metric_card') {
      renderMetricCard({ elementId: config.elemento_id, label: config.titulo, value: dados.valor, sub: dados.sub });
    } else if (config.tipo_grafico === 'donut') {
      renderDonut({ elementId: config.elemento_id, labels: dados.categorias, valores: dados.valores, height: calcularAltura(config.tipo_grafico) });
    } else if (config.tipo_grafico === 'bar_horizontal') {
      renderBarHorizontal({ elementId: config.elemento_id, categorias: dados.categorias, valores: dados.valores, label: config.titulo, media: dados.media, height: calcularAltura(config.tipo_grafico) });
    } else if (config.tipo_grafico === 'bar_stacked') {
      renderBarStacked({ elementId: config.elemento_id, categorias: dados.categorias, series: dados.series, height: calcularAltura(config.tipo_grafico) });
    } else if (config.tipo_grafico === 'bar_vertical') {
      renderBarStacked({ elementId: config.elemento_id, categorias: dados.categorias, series: dados.series, horizontal: false, height: calcularAltura(config.tipo_grafico) });
    }
  }
}

async function renderDashboard() {
  kpiConfigsGlobal = await buscarKpiConfig();
  console.log('configs carregadas:', kpiConfigsGlobal.map(c => c.elemento_id + ' → linha_acima:' + c.linha_acima));
  const dashboard = document.getElementById('dashboard');
  dashboard.innerHTML = '';

  const abas = [...new Set(kpiConfigsGlobal.map(c => c.aba).filter(Boolean))];
  const hashAba = window.location.hash.replace('#', '');
  const abaAtiva = abas.includes(hashAba) ? hashAba : abas[0];

  const tabsEl = document.createElement('div');
  tabsEl.style.cssText = 'display:flex; gap:4px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.06);';
  abas.forEach(aba => {
    const btn = document.createElement('button');
    btn.textContent = aba;
    btn.className = 'tab-btn';
    btn.style.cssText = `font-size:11px; padding:8px 16px; background:transparent; border:none; border-bottom:2px solid ${aba === abaAtiva ? '#00e5a0' : 'transparent'}; color:${aba === abaAtiva ? '#00e5a0' : '#666'}; cursor:pointer;`;
    btn.onclick = () => trocarAba(aba);
    tabsEl.appendChild(btn);
  });
  dashboard.appendChild(tabsEl);

  const controles = document.createElement('div');
  controles.id = 'zona-controles';
  controles.className = 'filters';
  dashboard.appendChild(controles);

  const conteudo = document.createElement('div');
  conteudo.id = 'aba-conteudo';
  dashboard.appendChild(conteudo);

await renderAba(abaAtiva);
  await renderGraficos(kpiConfigsGlobal.filter(c => c.aba === abaAtiva));

}

async function trocarAba(aba) {
  window.location.hash = aba;
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isAtiva = b.textContent === aba;
    b.style.borderBottom = isAtiva ? '2px solid #00e5a0' : '2px solid transparent';
    b.style.color = isAtiva ? '#00e5a0' : '#666';
  });

  const conteudo = document.getElementById('aba-conteudo');
  conteudo.innerHTML = '';
  document.getElementById('zona-controles').innerHTML = '';

  await renderAba(aba);
  await renderGraficos(kpiConfigsGlobal.filter(c => c.aba === aba));
}

async function renderAba(aba) {
  const conteudo = document.getElementById('aba-conteudo');
  const configs = kpiConfigsGlobal.filter(c => c.aba === aba);

  const linhasMap = {};
  configs.forEach(c => {
    const linha = c.linha_matriz;
    if (!linhasMap[linha]) linhasMap[linha] = [];
    linhasMap[linha].push(c);
  });

  const linhasOrdenadas = Object.keys(linhasMap).map(Number).sort((a, b) => a - b);

  for (const linha of linhasOrdenadas) {
    const itens = linhasMap[linha].sort((a, b) => a.posicao - b.posicao);

    if (itens.some(c => c.tipo_grafico === 'filtro_periodo' || c.tipo_grafico === 'filtro_cliente')) {
      const zonaFiltros = document.getElementById('zona-controles');
      itens.forEach(config => {
        if (config.tipo_grafico === 'filtro_periodo') {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex; gap:8px;';
          wrapper.innerHTML = `
            <button class="period-btn" onclick="setPeriodo(1, this)">hoje</button>
            <button class="period-btn" onclick="setPeriodo(7, this)">7 dias</button>
            <button class="period-btn active" onclick="setPeriodo(30, this)">30 dias</button>
          `;
          zonaFiltros.appendChild(wrapper);
        } else if (config.tipo_grafico === 'filtro_cliente') {
          const wrapper = document.createElement('div');
          wrapper.id = config.elemento_id;
          zonaFiltros.appendChild(wrapper);
          sb.from('clients').select('slug, nome').order('nome').then(({ data }) => {
            const opcoes = [
              { value: '', label: 'todos os clientes' },
              ...(data || []).map(c => ({ value: c.slug, label: c.nome }))
            ];
            renderDropdown({
              elementId: config.elemento_id,
              opcoes,
              placeholder: 'filtrar cliente...',
              onChange: (value) => onFiltroChange('cliente', value)
            });
          });
        }
      });
      continue;
    }

    if (itens.some(c => c.tipo_grafico === 'titulo')) {
      itens.forEach(config => {
        const tituloEl = document.createElement('div');
        tituloEl.id = config.elemento_id;
        tituloEl.style.cssText = 'font-size:10px; color:#666; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:8px; margin-top:12px;';
        tituloEl.textContent = config.titulo;
        conteudo.appendChild(tituloEl);
      });
      continue;
    }

    const unidade = calcularUnidade(aba);
    const maxAltura = Math.max(...itens.map(c => alturasPorTipo[c.tipo_grafico] || 2));
    const alturaPx = maxAltura * unidade;

    const colunas = itens.length > 1 ? `repeat(${itens.length}, 1fr)` : '1fr';
    const linhaEl = document.createElement('div');
    linhaEl.style.cssText = `display:grid; grid-template-columns:${colunas}; gap:8px; margin-bottom:8px; height:${alturaPx}px;`;

    itens.forEach(config => {
      const card = document.createElement('div');
      card.style.cssText = config.tipo_grafico === 'metric_card'
        ? ''
        : 'background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px;';
      card.innerHTML = config.tipo_grafico === 'metric_card'
        ? `<div id="${config.elemento_id}"></div>`
        : `<div style="font-size:12px; font-weight:700; margin-bottom:16px;">${config.titulo}</div><div id="${config.elemento_id}"></div>`;
      linhaEl.appendChild(card);
    });

    conteudo.appendChild(linhaEl);
  }
}

const funcoes = {

  taxa_bio: (eventos) => {
    const total = eventos.length;
    const bio = eventos.filter(r => r.dados?.tipo === 'bio').length;
    const taxa = total > 0 ? Math.round(bio / total * 100) : 0;
    return { valor: taxa + '%', sub: 'do total de ocorrências' };
  },

  resolucao_rapida: (eventos) => {
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
    const rapidas = tempos.filter(t => t <= 60).length;
    const taxa = tempos.length > 0 ? Math.round(rapidas / tempos.length * 100) : 0;
    return { valor: taxa + '%', sub: 'resolvidas em menos de 60min' };
  },

  reincidencia: (eventos) => {
    const relatoresUnicos = new Set(eventos.map(r => r.dados?.relatado_por).filter(Boolean));
    const recorrentes = [...relatoresUnicos].filter(p =>
      eventos.filter(r => r.dados?.relatado_por === p).length > 1
    ).length;
    const taxa = relatoresUnicos.size > 0 ? Math.round(recorrentes / relatoresUnicos.size * 100) : 0;
    return { valor: taxa + '%', sub: 'relatores com mais de 1 ocorrência' };
  },

  tendencia: async (eventos) => {
    const agora = Date.now();
    const inicio = new Date(agora - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from('events')
      .select('*')
      .eq('evento', 'relato_de_ocorrencia')
      .gte('timestamp', inicio)
      .order('timestamp', { ascending: true });

    const cliente = filtrosAtivos['cliente'] || '';
    const todos = (data || []).filter(r => !cliente || r.dados?.cliente_id === cliente);

    const semanaAtual = todos.filter(r =>
      new Date(r.timestamp) >= new Date(agora - 7 * 24 * 60 * 60 * 1000)
    ).length;
    const semanaAnterior = todos.filter(r => {
      const t = new Date(r.timestamp);
      return t >= new Date(agora - 14 * 24 * 60 * 60 * 1000) && t < new Date(agora - 7 * 24 * 60 * 60 * 1000);
    }).length;

    const val = semanaAnterior > 0
      ? Math.round((semanaAtual - semanaAnterior) / semanaAnterior * 100)
      : null;
    return { valor: val !== null ? (val > 0 ? '+' : '') + val + '%' : '—', sub: 'vs semana anterior' };
  },

  contar: (eventos, campoGrupo) => {
    const map = {};
    eventos.forEach(r => {
      const val = r.dados?.[campoGrupo] || r[campoGrupo] || '—';
      map[val] = (map[val] || 0) + 1;
    });
    const categorias = Object.keys(map).sort((a, b) => map[b] - map[a]);
    return { categorias, valores: categorias.map(k => map[k]) };
  },

  contar_por_data: (eventos, campoGrupo) => {
    const diasMap = {};
    const tipos = [...new Set(eventos.map(r => r.dados?.[campoGrupo]).filter(Boolean))];
    eventos.forEach(r => {
      const dia = new Date(r.timestamp).toLocaleDateString('pt-BR');
      const val = r.dados?.[campoGrupo] || '—';
      if (!diasMap[dia]) diasMap[dia] = {};
      diasMap[dia][val] = (diasMap[dia][val] || 0) + 1;
    });
    const categorias = Object.keys(diasMap).sort((a, b) => {
      const [da, ma, ya] = a.split('/');
      const [db, mb, yb] = b.split('/');
      return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
    });
    const series = tipos.map(tipo => ({
      name: tipo,
      data: categorias.map(d => diasMap[d][tipo] || 0)
    }));
    return { categorias, series };
  },

  contar_empilhado: (eventos, campoGrupo, campoValor) => {
    const tipos = [...new Set(eventos.map(r => r.dados?.[campoValor]).filter(Boolean))];
    const pessoaMap = {};
    eventos.forEach(r => {
      const pessoa = r.dados?.[campoGrupo] || '—';
      const tipo = r.dados?.[campoValor] || '—';
      if (!pessoaMap[pessoa]) pessoaMap[pessoa] = {};
      pessoaMap[pessoa][tipo] = (pessoaMap[pessoa][tipo] || 0) + 1;
    });
    const categorias = Object.keys(pessoaMap).sort((a, b) => {
      const totalA = Object.values(pessoaMap[a]).reduce((s, v) => s + v, 0);
      const totalB = Object.values(pessoaMap[b]).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });
    const series = tipos.map(tipo => ({
      name: tipo,
      data: categorias.map(p => pessoaMap[p][tipo] || 0)
    }));
    return { categorias, series };
  },

  media_tempo: (eventos, campoGrupo) => {
    const tempos = {};
    const contagens = {};
    eventos.filter(r => r.dados?.hora_relato).forEach(r => {
      const registrado = new Date(r.timestamp);
      const [h, m] = r.dados.hora_relato.split(':');
      const relatado = new Date(registrado);
      relatado.setUTCHours(Number(h), Number(m), 0, 0);
      const diff = (registrado - relatado) / 60000;
      if (diff <= 0) return;
      const grupo = r[campoGrupo]?.split('@')[0] || r.dados?.[campoGrupo] || '—';
      tempos[grupo] = (tempos[grupo] || 0) + diff;
      contagens[grupo] = (contagens[grupo] || 0) + 1;
    });
    const categorias = Object.keys(tempos);
    const valores = categorias.map(g => Math.round(tempos[g] / contagens[g]));
    const media = valores.length > 0 ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : null;
    return { categorias, valores, media };
  },

  contar_total: (eventos) => {
    const periodo = filtrosAtivos['periodo'] || 30;
    return { valor: eventos.length, sub: `últimos ${periodo} dia(s)` };
  },

  media_tempo_geral: (eventos) => {
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
    const media = tempos.length > 0
      ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
      : null;
    return { valor: media ? media + ' min' : '—', sub: 'desde relato até registro' };
  },

  nenhuma: () => ({ valor: null, sub: null }),
};

renderDashboard();