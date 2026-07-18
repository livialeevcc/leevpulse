let filtrosAtivos = {};
let kpiConfigsGlobal = [];
let abaAtiva = null;
let eventosGlobalCache = {};
let screenAtiva = null;
let screenContexto = {};
let screenHistorico = [];
let progressoTimer = null;


async function abrirScreen(screenId, campo, valor) {
  if (screenAtiva) {
    screenHistorico.push({ screen: screenAtiva, contexto: { ...screenContexto } });
  }
  screenAtiva = screenId;
  screenContexto = { campo, valor };
  sessionStorage.setItem('pulse_screen', JSON.stringify({ screen: screenId, campo, valor, historico: screenHistorico }));

  const overlay = document.getElementById('screen-overlay');
  overlay.style.display = 'block';
  overlay.innerHTML = '';

  Object.keys(graficosInstancias).forEach(id => {
    if (id.startsWith('screen-') || id.startsWith('local-')) {
      try { graficosInstancias[id].destroy(); } catch(e) {}
      delete graficosInstancias[id];
    }
  });

  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:16px;';

  const btnVoltar = document.createElement('button');
  btnVoltar.textContent = '← voltar';
  btnVoltar.style.cssText = 'font-size:11px; padding:8px 16px; background:transparent; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:var(--accent); cursor:pointer;';
  btnVoltar.onclick = voltarDeScreen;
  header.appendChild(btnVoltar);

  const titulo = document.createElement('span');
  titulo.textContent = valor;
  titulo.style.cssText = 'font-size:16px; font-weight:700; color:#eee;';
  header.appendChild(titulo);

  overlay.appendChild(header);

  const configs = kpiConfigsGlobal.filter(c => c.aba === screenId);
  const subAbas = [...new Set(configs.map(c => c.sub_aba).filter(Boolean))];

  if (subAbas.length > 0) {
    const tabsEl = document.createElement('div');
    tabsEl.id = 'screen-tabs';
    tabsEl.style.cssText = 'display:flex; gap:4px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.06);';
    subAbas.forEach((sub, i) => {
      const btn = document.createElement('button');
      btn.textContent = sub;
      btn.className = 'tab-btn';
      btn.style.cssText = `font-size:11px; padding:8px 16px; background:${i === 0 ? 'rgba(200,217,74,0.06)' : 'transparent'}; border:none; border-bottom:2px solid ${i === 0 ? 'var(--accent)' : 'transparent'}; color:${i === 0 ? 'var(--accent)' : '#666'}; cursor:pointer; border-radius:6px 6px 0 0;`;
      btn.onclick = () => trocarSubAba(sub);
      tabsEl.appendChild(btn);
    });
    overlay.appendChild(tabsEl);
  }

  const conteudo = document.createElement('div');
  conteudo.id = 'screen-conteudo';
  overlay.appendChild(conteudo);

  const primeiraSubAba = subAbas.length > 0 ? subAbas[0] : null;
  await renderScreen(screenId, primeiraSubAba);
}

function voltarDeScreen() {
  Object.keys(graficosInstancias).forEach(id => {
    if (id.startsWith('screen-') || id.startsWith('local-')) {
      try { graficosInstancias[id].destroy(); } catch(e) {}
      delete graficosInstancias[id];
    }
  });

  if (screenHistorico.length > 0) {
    const anterior = screenHistorico.pop();
    screenAtiva = null;
    screenContexto = {};
    abrirScreen(anterior.screen, anterior.contexto.campo, anterior.contexto.valor);
  } else {
    screenAtiva = null;
    screenContexto = {};
    sessionStorage.removeItem('pulse_screen');
    const overlay = document.getElementById('screen-overlay');
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }
}

async function trocarSubAba(sub) {
  document.querySelectorAll('#screen-tabs .tab-btn').forEach(b => {
    const isAtiva = b.textContent === sub;
    b.style.borderBottom = isAtiva ? '2px solid var(--accent)' : '2px solid transparent';
    b.style.color = isAtiva ? 'var(--accent)' : '#666';
    b.style.background = isAtiva ? 'rgba(200,217,74,0.06)' : 'transparent';
  });

  Object.keys(graficosInstancias).forEach(id => {
    if (id.startsWith('screen-')) {
      try { graficosInstancias[id].destroy(); } catch(e) {}
      delete graficosInstancias[id];
    }
  });

  await renderScreen(screenAtiva, sub);
}

async function renderScreen(screenId, subAba) {
  const conteudo = document.getElementById('screen-conteudo');
  conteudo.innerHTML = '';

  let configs = kpiConfigsGlobal.filter(c => c.aba === screenId);
  if (subAba) configs = configs.filter(c => c.sub_aba === subAba);

  const linhasMap = {};
  configs.forEach(c => {
    const linha = c.linha_matriz;
    if (!linhasMap[linha]) linhasMap[linha] = [];
    linhasMap[linha].push(c);
  });

  const linhasOrdenadas = Object.keys(linhasMap).map(Number).sort((a, b) => a - b);

  for (const linha of linhasOrdenadas) {
    const itens = linhasMap[linha].sort((a, b) => a.posicao - b.posicao);
    const colunas = itens.length > 1 ? `repeat(${itens.length}, 1fr)` : '1fr';
    const linhaEl = document.createElement('div');
    linhaEl.style.cssText = `display:grid; grid-template-columns:${colunas}; gap:8px; margin-bottom:8px;`;

    itens.forEach(config => {
      const card = document.createElement('div');
      const loading = '<span style="color:#444; font-size:11px;">carregando...</span>';
      card.style.cssText = config.tipo_grafico === 'metric_card'
        ? ''
        : 'background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; overflow:visible;';
      if (config.tipo_grafico === 'metric_card') {
        card.innerHTML = `<div id="${config.elemento_id}">${loading}</div>`;
      } else if (config.tipo_grafico === 'lista') {
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);"><span style="font-size:12px; font-weight:700;">${config.titulo}</span><input id="${config.elemento_id}-busca" type="text" placeholder="buscar..." style="width:180px; padding:6px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; font-size:11px; font-family:Montserrat; outline:none;"></div><div style="max-height:400px; overflow-y:auto;"><div id="${config.elemento_id}">${loading}</div></div>`;
      } else if (config.tipo_grafico === 'bar_horizontal') {
        card.innerHTML = `<div style="font-size:12px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);">${config.titulo}</div><div style="max-height:400px; overflow-y:auto;"><div id="${config.elemento_id}">${loading}</div></div>`;
      } else {
        card.innerHTML = `<div style="font-size:12px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);">${config.titulo}</div><div id="${config.elemento_id}">${loading}</div>`;
      }
      linhaEl.appendChild(card);
    });

    conteudo.appendChild(linhaEl);
  }

  await renderGraficos(configs);
}

function iniciarProgressoLento() {
  let container = document.getElementById('loading-bar-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'loading-bar-container';
    container.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:9999;';
    container.innerHTML = '<div style="background:rgba(255,255,255,0.06); height:5px;"><div id="loading-bar" style="height:100%; width:0%; background:var(--accent); transition:width 0.5s ease;"></div></div>';
    document.body.prepend(container);
  }
  const bar = document.getElementById('loading-bar');
  let progresso = 5;
  bar.style.width = progresso + '%';
  progressoTimer = setInterval(() => {
    if (progresso < 85) {
      progresso += Math.random() * 5 + 1;
      if (progresso > 85) progresso = 85;
      bar.style.width = progresso + '%';
    }
  }, 400);
}

function finalizarProgresso() {
  clearInterval(progressoTimer);
  const bar = document.getElementById('loading-bar');
  if (bar) bar.style.width = '100%';
  setTimeout(() => {
    const container = document.getElementById('loading-bar-container');
    if (container) container.remove();
  }, 400);
}

const alturasPorTipo = {
  filtro_campo:   0,
  filtro_mes:     0,
  filtro_periodo: 0,
  filtro_cliente: 0,
  titulo:         0,
  metric_card:    1.5,
  donut:          4,
  bar_horizontal: 4,
  bar_stacked:    4,
  bar_vertical:   5,
  lista:          4,
  comparativo:    4,
  linha:          8,
  bar_vertical_simples: 6,
  comparativo_mes: 4,
  combo: 6,
};

function ordenarPorDependencia(itens) {
  const resolvidos = new Set();
  const resultado = [];
  const pendentes = [...itens];

  let tentativas = 0;
  while (pendentes.length > 0 && tentativas < pendentes.length * 2) {
    const item = pendentes.shift();
    const deps = extrairDependencias(item.formula);
    const todasResolvidas = deps.every(d => resolvidos.has(d));

    if (!item.formula || todasResolvidas) {
      resultado.push(item);
      resolvidos.add(item.id);
    } else {
      pendentes.push(item);
      tentativas++;
    }
  }

  resultado.push(...pendentes);
  return resultado;
}

function extrairDependencias(formula) {
  if (!formula) return [];
  return formula.match(/[a-z][a-z0-9_]*/g) || [];
}


function resolverFormula(formula, cache) {
  if (!formula) return null;
  let expr = formula;
  Object.entries(cache).forEach(([id, valor]) => {
    expr = expr.replaceAll(id, valor ?? 0);
  });
  try {
    return funcoes.arredondar(Function('"use strict"; return (' + expr + ')')());
  } catch(e) {
    return null;
  }
}

function mostrarTooltip(e, texto) {
  let tip = document.getElementById('kpi-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'kpi-tooltip';
    tip.className = 'kpi-tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent = texto;
  tip.style.display = 'block';
  tip.style.left = (e.pageX + 12) + 'px';
  tip.style.top = (e.pageY + 12) + 'px';
}

function esconderTooltip() {
  const tip = document.getElementById('kpi-tooltip');
  if (tip) tip.style.display = 'none';
}

function montarTooltipFormula(formula, cache) {
  if (!formula) return '';
  let exprSubstituida = formula;
  const linhas = [`Fórmula: ${formula}`];
  Object.entries(cache).forEach(([id, valor]) => {
    if (formula.includes(id)) {
      exprSubstituida = exprSubstituida.replaceAll(id, valor ?? 0);
      linhas.push(`${id} = ${valor ?? 0}`);
    }
  });
  linhas.push(`= ${exprSubstituida}`);
  return linhas.join('\n');
}

function formatarCelulaMatriz(valor, formato) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  if (formato === 'moeda') return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  if (formato === 'percentual') return valor.toFixed(1) + '%';
  if (formato) return valor.toLocaleString('pt-BR') + ' ' + formato;
  return valor.toLocaleString('pt-BR');
}


function temRealtime(config, tenant) {
  if (config.realtime === true) return true;
  if (config.realtime === false) return false;
  return tenant?.realtime === true;
}

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
    .eq('tenant_id', getTenantAtivo())
    .order('linha_matriz', { ascending: true });
  return data || [];
}

async function buscarTenant() {
  const { data } = await sb
    .from('tenants')
    .select('*')
    .eq('slug', getTenantAtivo())
    .single();
  return data;
}

async function buscarMatriz(matrizId) {
  const { data } = await sb
    .from('kpi_matriz')
    .select('*')
    .eq('tenant_id', getTenantAtivo())
    .eq('matriz_id', matrizId)
    .order('ordem', { ascending: true });
  return data || [];
}

function getCorMatriz(valor, tipo, limiteVerde, limiteLaranja) {
  if (valor === null || valor === undefined) return 'neutro';
  if (tipo === 'maior_melhor') {
    if (valor >= limiteVerde) return 'verde';
    if (valor >= limiteLaranja) return 'laranja';
    return 'vermelho';
  } else {
    if (valor <= limiteVerde) return 'verde';
    if (valor <= limiteLaranja) return 'laranja';
    return 'vermelho';
  }
}

function formatarValorMatriz(valor, formato) {
  if (valor === null || valor === undefined) return '—';
  if (formato === 'moeda') return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (formato === 'percentual') return valor.toFixed(1) + '%';
  return valor.toLocaleString('pt-BR');
}

function getDataInicio() {
  const periodo = filtrosAtivos['periodo'] ?? 0;
  if (periodo === 0) return null;
  const d = new Date();
  if (periodo === 1) {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  d.setDate(d.getDate() - periodo);
  return d.toISOString();
}

async function buscarEventos(evento) {
  const dataInicio = getDataInicio();
  const cacheKey = evento + (dataInicio || '');

  if (!eventosGlobalCache[cacheKey]) {
    let query = sb
      .from('events')
      .select('dados, timestamp')
      .eq('evento', evento)
      .eq('tenant_id', getTenantAtivo())
      .order('timestamp', { ascending: true });

    if (dataInicio) query = query.gte('timestamp', dataInicio);

    const { data } = await query.limit(200000);
    eventosGlobalCache[cacheKey] = data || [];
  }

  let resultado = eventosGlobalCache[cacheKey];
  Object.entries(filtrosAtivos).forEach(([tipo, valor]) => {
    if (tipo === 'periodo' || !valor) return;
    if (tipo === 'cliente') {
      resultado = resultado.filter(r => !valor || r.dados?.cliente_id === valor);
    } else if (tipo.startsWith('_mes_')) {
      const campoData = tipo.replace('_mes_', '');
      if (Array.isArray(valor) && valor.length > 0) {
        resultado = resultado.filter(r => {
          const dataStr = r.dados?.[campoData];
          if (!dataStr) return false;
          const partes = dataStr.split('-');
          if (partes.length < 2) return false;
          const chave = `${partes[0]}-${partes[1]}`;
          return valor.includes(chave);
        });
      }
    } else {
      if (Array.isArray(valor) && valor.length > 0) {
        resultado = resultado.filter(r => valor.includes(r.dados?.[tipo]));
      } else if (typeof valor === 'string' && valor) {
        resultado = resultado.filter(r => r.dados?.[tipo] === valor);
      }
    }
  });
  return resultado;
}

function onFiltroChange(tipo, valor) {
  filtrosAtivos[tipo] = valor;
  const abaConfigs = kpiConfigsGlobal.filter(c => c.aba === abaAtiva);
  renderGraficos(abaConfigs);
}

function setPeriodo(dias, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  eventosGlobalCache = {};
  onFiltroChange('periodo', dias);
}

async function renderGraficos(configs) {
  resetMetricCardIndex();
  const eventoIds = [...new Set(configs.map(c => c.evento))];

  const unidade = calcularUnidade(configs[0]?.aba);

  iniciarProgressoLento();

  const eventosCache = {};
  await Promise.all(
    eventoIds.map(evento =>
      buscarEventos(evento).then(data => {
        eventosCache[evento] = data;
      })
    )
  );

  finalizarProgresso();

  const cardCache = {};

  for (const config of configs) {
    if (config.tipo_grafico === 'titulo' || config.tipo_grafico === 'filtro_periodo' || config.tipo_grafico === 'filtro_cliente') continue;

    if (config.tipo_grafico === 'filtro_campo') {
      const cacheKey = config.evento + (getDataInicio() || '');
      renderFiltroCampo({
        elementId: config.elemento_id,
        eventos: eventosGlobalCache[cacheKey] || [],
        campo: config.campo_grupo,
        titulo: config.titulo,
        onChange: onFiltroChange
      });
      continue;
    }

    if (config.tipo_grafico === 'filtro_mes') {
      const cacheKey = config.evento + (getDataInicio() || '');
      renderFiltroMes({
        elementId: config.elemento_id,
        eventos: eventosGlobalCache[cacheKey] || [],
        campo: config.campo_grupo,
        titulo: config.titulo,
        onChange: onFiltroChange
      });
      continue;
    }

    const eventos = eventosCache[config.evento];

    if (config.tipo_grafico === 'comparativo') {
      const el = document.getElementById(config.elemento_id);
    if (!el) continue;
    if (graficosInstancias[config.elemento_id]) {
      try { graficosInstancias[config.elemento_id].destroy(); } catch(e) {}
      delete graficosInstancias[config.elemento_id];
    }
    el.innerHTML = '';
      let filtroFinal = config.campo_filtro;
      if (screenAtiva && screenContexto.campo) {
        const filtroBase = Array.isArray(filtroFinal) ? filtroFinal : (filtroFinal ? JSON.parse(filtroFinal) : []);
        filtroFinal = [...filtroBase, [screenContexto.campo, screenContexto.valor]];
      }
      const [campoValorReal, campoComparacao] = (config.campo_valor || '').split(',');
      renderComparativo({
        elementId: config.elemento_id,
        eventos,
        campoGrupo: config.campo_grupo,
        campoComparacao,
        campoValor: campoValorReal,
        campoFiltro: filtroFinal
      });
      continue;
    }

    if (config.tipo_grafico === 'comparativo_mes') {
      const el = document.getElementById(config.elemento_id);
      if (!el) continue;
      el.innerHTML = '';
      let filtroFinal = config.campo_filtro;
      if (screenAtiva && screenContexto.campo) {
        const filtroBase = Array.isArray(filtroFinal) ? filtroFinal : (filtroFinal ? JSON.parse(filtroFinal) : []);
        filtroFinal = [...filtroBase, [screenContexto.campo, screenContexto.valor]];
      }
      const [campoValorReal, campoData] = (config.campo_valor || '').split(',');
      renderComparativoMes({
        elementId: config.elemento_id,
        eventos,
        campoData,
        campoValor: campoValorReal,
        campoGrupo: config.campo_grupo,
        campoFiltro: filtroFinal
      });
      continue;
    }

    if (config.tipo_grafico === 'metric_card' && config.formula) {
      const el = document.getElementById(config.elemento_id);
      if (!el) continue;
      if (graficosInstancias[config.elemento_id]) {
        try { graficosInstancias[config.elemento_id].destroy(); } catch(e) {}
        delete graficosInstancias[config.elemento_id];
      }
      el.innerHTML = '';
      const valor = resolverFormula(config.formula, cardCache);
      cardCache[config.elemento_id] = valor;
      renderMetricCard({ elementId: config.elemento_id, label: config.titulo, value: valor, sub: config.descricao, formato: config.formato });
      continue;
    }

    if (config.funcao === 'percentual_cruzado_por_mes' && config.evento2) {
      const el = document.getElementById(config.elemento_id);
      if (!el) continue;
      if (graficosInstancias[config.elemento_id]) {
        try { graficosInstancias[config.elemento_id].destroy(); } catch(e) {}
        delete graficosInstancias[config.elemento_id];
      }
      el.innerHTML = '';
      const eventos2 = await buscarEventos(config.evento2);
      const dados = funcoes.percentual_cruzado_por_mes(eventos, eventos2, config.campo_grupo, config.campo_valor, config.campo_filtro);
      renderLinha({ elementId: config.elemento_id, categorias: dados.categorias, valores: dados.valores, label: config.titulo, height: 300, formato: 'percentual', meta: config.meta });
      continue;
    }

    const fn = funcoes[config.funcao];
    if (!fn) continue;

    let filtroFinal = config.campo_filtro;
    if (screenAtiva && screenContexto.campo) {
      const filtroBase = Array.isArray(filtroFinal) ? filtroFinal : (filtroFinal ? JSON.parse(filtroFinal) : []);
      filtroFinal = [...filtroBase, [screenContexto.campo, screenContexto.valor]];
    }

    const dados = await fn(eventos, config.campo_grupo, config.campo_valor, filtroFinal);
    if (config.descricao) dados.sub = config.descricao;
    const el = document.getElementById(config.elemento_id);
    if (!el) continue;
    if (graficosInstancias[config.elemento_id]) {
      try { graficosInstancias[config.elemento_id].destroy(); } catch(e) {}
      delete graficosInstancias[config.elemento_id];
    }
    el.innerHTML = '';

    const calcularAltura = (tipo, dados) => {
    if (tipo === 'bar_horizontal' && dados?.categorias?.length > 8) {
      return dados.categorias.length * 35;
    }
    return (alturasPorTipo[tipo] || 4) * unidade - 80;
  };

    if (config.tipo_grafico === 'metric_card') {
      cardCache[config.elemento_id] = dados.valor;
      renderMetricCard({ elementId: config.elemento_id, label: config.titulo, value: dados.valor, sub: dados.sub, formato: config.formato });
    } else if (config.tipo_grafico === 'donut') {
      renderDonut({ elementId: config.elemento_id, labels: dados.categorias, valores: dados.valores, height: 500 });
    } else if (config.tipo_grafico === 'bar_horizontal') {
      renderBarHorizontal({ elementId: config.elemento_id, categorias: dados.categorias, valores: dados.valores, label: config.titulo, media: dados.media, height: calcularAltura(config.tipo_grafico, dados) });
    } else if (config.tipo_grafico === 'linha') {
      renderLinha({ elementId: config.elemento_id, categorias: dados.categorias, valores: dados.valores, label: config.titulo, height: Math.max(300, calcularAltura(config.tipo_grafico)), formato: config.formato, meta: config.meta });
    } else if (config.tipo_grafico === 'bar_stacked') {
      renderBarStacked({ elementId: config.elemento_id, categorias: dados.categorias, series: dados.series, height: calcularAltura(config.tipo_grafico) });
    } else if (config.tipo_grafico === 'bar_vertical') {
      renderBarStacked({ elementId: config.elemento_id, categorias: dados.categorias, series: dados.series, horizontal: false, height: calcularAltura(config.tipo_grafico) });
    } else if (config.tipo_grafico === 'bar_vertical_simples') {
      renderBarVerticalSimples({ elementId: config.elemento_id, categorias: dados.categorias, valores: dados.valores, label: config.titulo, height: Math.max(300, calcularAltura(config.tipo_grafico)), formato: config.formato });
    } else if (config.tipo_grafico === 'combo') {
      const [labelBarra, labelLinha] = (config.descricao || 'Valor,Quantidade').split(',');
      const [fmtBarra, fmtLinha] = (config.formato || ',').split(',');
      renderCombo({ elementId: config.elemento_id, categorias: dados.categorias, valoresBarra: dados.valoresBarra, valoresLinha: dados.valoresLinha, labelBarra, labelLinha, height: Math.max(300, calcularAltura(config.tipo_grafico)), formatoBarra: fmtBarra || null, formatoLinha: fmtLinha || null });
    } else if (config.tipo_grafico === 'lista') {
      let badges = null;
      if (config.badge_config) {
        const bc = config.badge_config;
        const badgeEventos = await buscarEventos(bc.evento);
        badges = {};
        badgeEventos.forEach(r => {
          const chave = r.dados?.[bc.campo_match];
          if (chave && !badges[chave]) {
            badges[chave] = r.dados?.[bc.campo_badge];
          }
        });
      }
      renderLista({
        elementId: config.elemento_id,
        categorias: dados.categorias,
        valores: dados.valores,
        formato: config.formato,
        badges,
        badgeConfig: config.badge_config,
        onClick: config.link_screen ? (nome) => {
          abrirScreen(config.link_screen.screen, config.link_screen.campo, nome);
        } : null
      });
    } 
  }
}

let tenantAtualConfig = null;

async function renderDashboard() {
  const [configs, tenant] = await Promise.all([
    buscarKpiConfig(),
    buscarTenant()
  ]);
  kpiConfigsGlobal = configs;
  tenantAtualConfig = tenant;
  resetMetricCardIndex();
  try {
    await import(`./funcoes/${getTenantAtivo()}.js`);
  } catch(e) {}
  console.log('configs carregadas:', kpiConfigsGlobal.map(c => c.elemento_id + ' → linha_acima:' + c.linha_acima));
  const dashboard = document.getElementById('dashboard');
  dashboard.innerHTML = '';

  const screenIds = kpiConfigsGlobal.filter(c => c.tipo_aba === 'screen').map(c => c.aba);
  const abas = [...new Set(kpiConfigsGlobal.map(c => c.aba).filter(a => a && !screenIds.includes(a)))];
  const hashAba = window.location.hash.replace('#', '');
  abaAtiva = abas.includes(hashAba) ? hashAba : abas[0];

  const tabsEl = document.createElement('div');
  tabsEl.style.cssText = 'display:flex; gap:4px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.06);';
  abas.forEach(aba => {
    const btn = document.createElement('button');
    btn.textContent = aba;
    btn.className = 'tab-btn';
    btn.style.cssText = `font-size:11px; padding:8px 16px; background:${aba === abaAtiva ? 'rgba(200,217,74,0.06)' : 'transparent'}; border:none; border-bottom:2px solid ${aba === abaAtiva ? 'var(--accent)' : 'transparent'}; color:${aba === abaAtiva ? 'var(--accent)' : '#666'}; cursor:pointer; border-radius:6px 6px 0 0;`;
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

  try {
    const screenSalva = sessionStorage.getItem('pulse_screen');
    if (screenSalva) {
      const { screen, campo, valor, historico } = JSON.parse(screenSalva);
      if (historico) screenHistorico = historico;
      await abrirScreen(screen, campo, valor);
    }
  } catch(e) {}

  const configsRealtime = kpiConfigsGlobal.filter(c => temRealtime(c, tenantAtualConfig));
  
  if (configsRealtime.length > 0) {
    const eventosMonitorados = [...new Set(configsRealtime.map(c => c.evento))];
    
    eventosMonitorados.forEach(evento => {
      sb.channel(`realtime-${getTenantAtivo()}-${evento}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'events'
        }, async (payload) => {
          const tenantPayload = payload.new?.tenant_id || payload.old?.tenant_id;
          if (tenantPayload && tenantPayload !== getTenantAtivo()) return;
          if (screenAtiva) return;
          const afetados = configsRealtime.filter(c => c.aba === abaAtiva);
          await renderGraficos(afetados);
        })
        .subscribe((status) => {
          console.log('status canal realtime:', status);
        });
    });
  }
}

async function trocarAba(aba) {
  window.location.hash = aba;
  abaAtiva = aba;
  resetMetricCardIndex();
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isAtiva = b.textContent === aba;
    b.style.borderBottom = isAtiva ? '2px solid var(--accent)' : '2px solid transparent';
    b.style.color = isAtiva ? 'var(--accent)' : '#666';
    b.style.background = isAtiva ? 'rgba(200,217,74,0.06)' : 'transparent';
  });

  const conteudo = document.getElementById('aba-conteudo');
  Object.keys(graficosInstancias).forEach(id => {
    try { graficosInstancias[id].destroy(); } catch(e) {}
    delete graficosInstancias[id];
  });
  conteudo.innerHTML = '';
  document.getElementById('zona-controles').innerHTML = '';
  const sidebar = document.getElementById('sidebar-filtros');
  sidebar.innerHTML = '';
  sidebar.style.display = 'none';

  await renderAba(aba);
  await renderGraficos(kpiConfigsGlobal.filter(c => c.aba === aba));
}

async function renderAba(aba) {
  const conteudo = document.getElementById('aba-conteudo');
  const configs = kpiConfigsGlobal.filter(c => c.aba === aba);

  if (configs.some(c => c.tipo_grafico === 'matriz')) {
    await renderMatriz(configs);
    return;
  }

  const linhasMap = {};
  configs.forEach(c => {
    const linha = c.linha_matriz;
    if (!linhasMap[linha]) linhasMap[linha] = [];
    linhasMap[linha].push(c);
  });

  const linhasOrdenadas = Object.keys(linhasMap).map(Number).sort((a, b) => a - b);

  for (const linha of linhasOrdenadas) {
    const itens = linhasMap[linha].sort((a, b) => a.posicao - b.posicao);

    if (itens.some(c => c.tipo_grafico === 'filtro_periodo' || c.tipo_grafico === 'filtro_cliente' || c.tipo_grafico === 'filtro_campo' || c.tipo_grafico === 'filtro_mes')) {
      const zonaFiltros = document.getElementById('zona-controles');
      itens.forEach(config => {
        if (config.tipo_grafico === 'filtro_campo' || config.tipo_grafico === 'filtro_mes') {
          const sidebar = document.getElementById('sidebar-filtros');
          const wrapper = document.createElement('div');
          wrapper.id = config.elemento_id;
          wrapper.style.cssText = 'margin-bottom:16px;';
          sidebar.appendChild(wrapper);
          sidebar.style.display = 'block';
          return;
        }
        if (config.tipo_grafico === 'filtro_periodo') {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex; gap:8px;';
          wrapper.innerHTML = `
            <button class="period-btn" onclick="setPeriodo(1, this)">hoje</button>
            <button class="period-btn" onclick="setPeriodo(7, this)">7 dias</button>
            <button class="period-btn" onclick="setPeriodo(30, this)">30 dias</button>
            <button class="period-btn" onclick="setPeriodo(90, this)">3 meses</button>
            <button class="period-btn" onclick="setPeriodo(180, this)">6 meses</button>
            <button class="period-btn active" onclick="setPeriodo(0, this)">tudo</button>
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
        tituloEl.style.cssText = 'font-size:10px; color:#666; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:8px; margin-top:12px; padding-left:8px; border-left:2px solid var(--accent);';
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
    linhaEl.style.cssText = `display:grid; grid-template-columns:${colunas}; gap:8px; margin-bottom:8px; min-height:${alturaPx}px;`;

    itens.forEach(config => {
      const card = document.createElement('div');
      card.style.cssText = config.tipo_grafico === 'metric_card'
        ? ''
        : 'background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; overflow:visible;';
      const loading = '<span style="color:#444; font-size:11px;">carregando...</span>';
      if (config.tipo_grafico === 'metric_card') {
        card.innerHTML = `<div id="${config.elemento_id}">${loading}</div>`;
      } else if (config.tipo_grafico === 'bar_stacked') {
        card.innerHTML = `<div style="font-size:12px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);">${config.titulo}</div><div style="max-height:400px; overflow-y:auto;"><div id="${config.elemento_id}">${loading}</div></div><div id="${config.elemento_id}-legenda" style="padding-top:8px; border-top:1px solid rgba(255,255,255,0.06); text-align:center;"></div>`;
      } else if (config.tipo_grafico === 'lista') {
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);"><span style="font-size:12px; font-weight:700;">${config.titulo}</span><input id="${config.elemento_id}-busca" type="text" placeholder="buscar..." style="width:180px; padding:6px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; font-size:11px; font-family:Montserrat; outline:none;"></div><div style="max-height:400px; overflow-y:auto;"><div id="${config.elemento_id}">${loading}</div></div>`;
      } else if (config.tipo_grafico === 'bar_horizontal') {
        card.innerHTML = `<div style="font-size:12px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);">${config.titulo}</div><div style="max-height:400px; overflow-y:auto;"><div id="${config.elemento_id}">${loading}</div></div>`;
      } else {
        card.innerHTML = `<div style="font-size:12px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);">${config.titulo}</div><div id="${config.elemento_id}">${loading}</div>`;
      }
      linhaEl.appendChild(card);
    });

    conteudo.appendChild(linhaEl);
  }
}

async function renderMatriz(configs) {
  const conteudo = document.getElementById('aba-conteudo');
  conteudo.innerHTML = '';

  const matrizConfig = configs.find(c => c.tipo_grafico === 'matriz');
  const matrizId = matrizConfig?.elemento_id;

  if (matrizConfig?.eixo === 'mes') {
    await renderMatrizMes(configs, matrizConfig);
    return;
  }

  if (matrizConfig?.eixo && matrizConfig.eixo !== 'data') {
    await renderMatrizCampo(configs, matrizConfig);
    return;
  }
  const itensMatriz = await buscarMatriz(matrizId);
  if (itensMatriz.length === 0) {
    conteudo.innerHTML = '<div style="color:var(--muted); font-size:12px; padding:20px 0;">nenhum KPI configurado para esta matriz.</div>';
    return;
  }

  const eventos = [...new Set(itensMatriz.map(i => i.evento))];
  const eventosCache = {};
  for (const evento of eventos) {
    const todos = await buscarEventos(evento);
    eventosCache[evento] = todos;
  }

const mesesSet = new Set();
  Object.values(eventosCache).flat().forEach(r => {
    const d = new Date(r.timestamp);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    mesesSet.add(mes);
  });
  const meses = [...mesesSet].sort();

  const mesSelecionado = filtrosAtivos['mes_matriz'] || meses[meses.length - 1];
  const [anoSel, mesSel] = mesSelecionado.split('-');

  const diasSet = new Set();
  Object.values(eventosCache).flat().forEach(r => {
    const d = new Date(r.timestamp);
    if (d.getFullYear() === parseInt(anoSel) && (d.getMonth() + 1) === parseInt(mesSel)) {
      const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      diasSet.add(dia);
    }
  });
  const dias = [...diasSet].sort((a, b) => {
    const [da, ma] = a.split('/');
    const [db, mb] = b.split('/');
    return new Date(`${anoSel}-${ma}-${da}`) - new Date(`${anoSel}-${mb}-${db}`);
  });

  const zonaFiltros = document.getElementById('zona-controles');
  zonaFiltros.innerHTML = '';
  const wrapMeses = document.createElement('div');
  wrapMeses.style.cssText = 'display:flex; gap:8px;';
  meses.forEach(mes => {
    const [ano, m] = mes.split('-');
    const label = new Date(ano, m - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'period-btn' + (mes === mesSelecionado ? ' active' : '');
    btn.onclick = () => {
      filtrosAtivos['mes_matriz'] = mes;
      renderMatriz(configs);
    };
    wrapMeses.appendChild(btn);
  });
  zonaFiltros.appendChild(wrapMeses);

  const grupos = [...new Set(itensMatriz.map(i => i.grupo).filter(Boolean))];


  const wrap = document.createElement('div');
  wrap.className = 'matriz-wrap';

  const table = document.createElement('table');
  table.className = 'matriz-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="col-label" style="width:180px">indicador</th>
      <th>acum.</th>
      ${dias.map(d => `<th>${d}</th>`).join('')}
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  const cache = {};
  const itensOrdenados = ordenarPorDependencia(itensMatriz);

  const cachePorDia = {};
  for (const dia of dias) {
    cachePorDia[dia] = {};
  }

  for (const grupo of grupos) {
    const secRow = document.createElement('tr');
    secRow.className = 'section-row';
    secRow.innerHTML = `<td colspan="${dias.length + 2}">${grupo}</td>`;
    tbody.appendChild(secRow);

    const itensGrupo = itensOrdenados.filter(i => i.grupo === grupo);

    for (const item of itensGrupo) {
      const def = item;
      const eventosItem = eventosCache[def.evento] || [];
      const fn = funcoes[def.funcao];
      if (!fn && !item.formula) continue;

      const eventosItemMes = eventosItem.filter(r => {
        const rd = new Date(r.timestamp);
        return rd.getFullYear() === parseInt(anoSel) && (rd.getMonth() + 1) === parseInt(mesSel);
      });
      const dadosAcum = item.formula
        ? { valor: resolverFormula(item.formula, cache) }
        : await fn(eventosItemMes, def.campo_grupo, def.campo_valor, def.campo_filtro || null);
      const valorAcumRaw = typeof dadosAcum.valor === 'string'
        ? parseFloat(dadosAcum.valor.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.'))
        : dadosAcum.valor;
      const valorAcum = !isFinite(valorAcumRaw) ? null : valorAcumRaw;
      cache[item.id] = valorAcum;

      const dadosPorDia = {};

      for (const dia of dias) {
        const [d, m] = dia.split('/');
        const eventosDia = eventosItem.filter(r => {
          const rd = new Date(r.timestamp);
          return rd.getDate() === parseInt(d) && (rd.getMonth() + 1) === parseInt(m) && rd.getFullYear() === parseInt(anoSel);
        });
        const dadosDia = item.formula
          ? { valor: resolverFormula(item.formula, cachePorDia[dia]) }
          : await fn(eventosDia, def.campo_grupo, def.campo_valor, def.campo_filtro || null);
        const valDia = typeof dadosDia.valor === 'string'
          ? parseFloat(dadosDia.valor.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.'))
          : dadosDia.valor;
        dadosPorDia[dia] = !isFinite(valDia) ? null : valDia;
        cachePorDia[dia][item.id] = dadosPorDia[dia];
        console.log(dia, dadosPorDia[dia], typeof dadosPorDia[dia]);
      }

      if (item.oculto) { continue; }
      const corAcum = getCorMatriz(valorAcum, item.meta_tipo, item.limite_verde, item.limite_laranja);

      const tr = document.createElement('tr');
      let html = `
        <td><div class="kpi-label" style="${item.formula ? 'cursor:help;' : ''}" data-formula="${item.formula ? montarTooltipFormula(item.formula, cache) : ''}">${def.titulo}<span class="kpi-sub">${def.descricao || ''}</span></div></td>
        <td class="cell" style="font-weight:700; font-size:11px; color:${corAcum === 'verde' ? '#7ec87e' : corAcum === 'laranja' ? '#d4900a' : corAcum === 'vermelho' ? '#e8637a' : 'var(--muted)'};">${formatarCelulaMatriz(valorAcum, def.formato)}</td>
      `;

      for (const dia of dias) {
        const val = dadosPorDia[dia];
        const cor = getCorMatriz(val, item.meta_tipo, item.limite_verde, item.limite_laranja);
        const valFormatado = formatarCelulaMatriz(val, def.formato);
        html += `<td class="cell"><span class="matriz-pill ${cor}">${valFormatado}</span></td>`;
      }

      tr.innerHTML = html;
      tbody.appendChild(tr);
    }
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  conteudo.appendChild(wrap);

  tbody.querySelectorAll('[data-formula]').forEach(el => {
    const formula = el.dataset.formula;
    if (!formula) return;
    el.addEventListener('mousemove', e => mostrarTooltip(e, formula));
    el.addEventListener('mouseleave', esconderTooltip);
  });
}

let matrizCampoSelecionados = [];

async function renderMatrizCampo(configs, matrizConfig) {
  const conteudo = document.getElementById('aba-conteudo');
  conteudo.innerHTML = '';

  const matrizId = matrizConfig.elemento_id;
  const eixo = matrizConfig.eixo;
  const itensMatriz = await buscarMatriz(matrizId);

  if (itensMatriz.length === 0) {
    conteudo.innerHTML = '<div style="color:var(--muted); font-size:12px; padding:20px 0;">nenhum KPI configurado para esta matriz.</div>';
    return;
  }

  const eventos = [...new Set(itensMatriz.map(i => i.evento))];
  const eventosCache = {};
  for (const evento of eventos) {
    eventosCache[evento] = await buscarEventos(evento);
  }

  const todosEventos = Object.values(eventosCache).flat();
  const opcoesEixo = [...new Set(todosEventos.map(r => r.dados?.[eixo]).filter(Boolean))].sort();

  const zonaFiltros = document.getElementById('zona-controles');
  zonaFiltros.innerHTML = '';

  const seletorWrap = document.createElement('div');
  seletorWrap.style.cssText = 'margin-bottom:12px; position:relative;';
  seletorWrap.innerHTML = `
    <input id="matriz-campo-busca" type="text" placeholder="adicionar ${eixo}..." style="width:300px; padding:8px 12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; font-size:11px; font-family:Montserrat; outline:none;">
    <div id="matriz-campo-dropdown" style="display:none; position:absolute; top:100%; left:0; width:300px; max-height:200px; overflow-y:auto; background:var(--surface2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; z-index:10; margin-top:4px;"></div>
  `;
  zonaFiltros.appendChild(seletorWrap);

  const tagsWrap = document.createElement('div');
  tagsWrap.id = 'matriz-campo-tags';
  tagsWrap.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;';
  zonaFiltros.appendChild(tagsWrap);

  function renderTags() {
    const tags = document.getElementById('matriz-campo-tags');
    tags.innerHTML = matrizCampoSelecionados.map((val, i) => {
      const cor = paletaCores[i % paletaCores.length];
      return `<span class="matriz-campo-tag" data-val="${val}" style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:4px; font-size:10px; background:${cor}22; color:${cor}; cursor:pointer;" title="clique para remover">${val} ✕</span>`;
    }).join('');
    tags.querySelectorAll('.matriz-campo-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        matrizCampoSelecionados = matrizCampoSelecionados.filter(v => v !== tag.dataset.val);
        renderTags();
        renderTabela();
      });
    });
  }

  const busca = document.getElementById('matriz-campo-busca');
  const dropdown = document.getElementById('matriz-campo-dropdown');

  busca.addEventListener('focus', () => atualizarDropdown(''));
  busca.addEventListener('input', () => atualizarDropdown(busca.value));
  document.addEventListener('click', (e) => {
    if (!busca.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  function atualizarDropdown(termo) {
    const filtro = termo.toLowerCase();
    const disponiveis = opcoesEixo.filter(n =>
      !matrizCampoSelecionados.includes(n) && n.toLowerCase().includes(filtro)
    ).slice(0, 20);
    if (disponiveis.length === 0) { dropdown.style.display = 'none'; return; }
    dropdown.style.display = 'block';
    dropdown.innerHTML = disponiveis.map(nome =>
      `<div class="matriz-campo-opcao" data-val="${nome}" style="padding:8px 12px; cursor:pointer; font-size:11px; color:#ccc;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">${nome}</div>`
    ).join('');
    dropdown.querySelectorAll('.matriz-campo-opcao').forEach(opcao => {
      opcao.addEventListener('click', () => {
        matrizCampoSelecionados.push(opcao.dataset.val);
        busca.value = '';
        dropdown.style.display = 'none';
        renderTags();
        renderTabela();
      });
    });
  }

  async function renderTabela() {
    conteudo.innerHTML = '';

    if (matrizCampoSelecionados.length === 0) {
      conteudo.innerHTML = `<div style="color:#444; font-size:11px; padding:20px; text-align:center;">selecione itens acima para montar a matriz</div>`;
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'matriz-wrap';
    const table = document.createElement('table');
    table.className = 'matriz-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th class="col-label" style="width:180px">indicador</th>
      ${matrizCampoSelecionados.map((val, i) => {
        const cor = paletaCores[i % paletaCores.length];
        return `<th style="color:${cor};">${val}</th>`;
      }).join('')}
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const grupos = [...new Set(itensMatriz.map(i => i.grupo).filter(Boolean))];
    const itensOrdenados = ordenarPorDependencia(itensMatriz);

    const cacheGlobal = {};
    const cachePorValor = {};
    matrizCampoSelecionados.forEach(val => { cachePorValor[val] = {}; });

    for (const grupo of grupos) {
      const secRow = document.createElement('tr');
      secRow.className = 'section-row';
      secRow.innerHTML = `<td colspan="${matrizCampoSelecionados.length + 1}">${grupo}</td>`;
      tbody.appendChild(secRow);

      const itensGrupo = itensOrdenados.filter(i => i.grupo === grupo);

      for (const item of itensGrupo) {
        const def = item;
        const eventosItem = eventosCache[def.evento] || [];
        const fn = funcoes[def.funcao];
        if (!fn && !item.formula) continue;

        const dadosPorValor = {};

        for (const val of matrizCampoSelecionados) {
          const eventosFiltrados = eventosItem.filter(r => r.dados?.[eixo] === val);
          const dados = item.formula
            ? { valor: resolverFormula(item.formula, cachePorValor[val]) }
            : await fn(eventosFiltrados, def.campo_grupo, def.campo_valor, def.campo_filtro || null);
          const valRaw = typeof dados.valor === 'string'
            ? parseFloat(dados.valor.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.'))
            : dados.valor;
          dadosPorValor[val] = !isFinite(valRaw) ? null : valRaw;
          cachePorValor[val][item.id] = dadosPorValor[val];
        }

        if (item.oculto) continue;

        const tr = document.createElement('tr');
        let html = `<td><div class="kpi-label" style="${item.formula ? 'cursor:help;' : ''}" data-formula="${item.formula ? montarTooltipFormula(item.formula, cacheGlobal) : ''}">${def.titulo}<span class="kpi-sub">${def.descricao || ''}</span></div></td>`;

        for (const val of matrizCampoSelecionados) {
          const v = dadosPorValor[val];
          const cor = getCorMatriz(v, item.meta_tipo, item.limite_verde, item.limite_laranja);
          const valFormatado = formatarCelulaMatriz(v, def.formato);
          html += `<td class="cell"><span class="matriz-pill ${cor}">${valFormatado}</span></td>`;
        }

        tr.innerHTML = html;
        tbody.appendChild(tr);
      }
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    conteudo.appendChild(wrap);

    tbody.querySelectorAll('[data-formula]').forEach(el => {
      const formula = el.dataset.formula;
      if (!formula) return;
      el.addEventListener('mousemove', e => mostrarTooltip(e, formula));
      el.addEventListener('mouseleave', esconderTooltip);
    });
  }

  renderTags();
  renderTabela();
}

async function renderMatrizMes(configs, matrizConfig) {
  const conteudo = document.getElementById('aba-conteudo');
  conteudo.innerHTML = '';

  const matrizId = matrizConfig.elemento_id;
  const itensMatriz = await buscarMatriz(matrizId);

  if (itensMatriz.length === 0) {
    conteudo.innerHTML = '<div style="color:var(--muted); font-size:12px; padding:20px 0;">nenhum KPI configurado para esta matriz.</div>';
    return;
  }

  const eventos = [...new Set(itensMatriz.map(i => i.evento))];
  const eventosCache = {};
  for (const evento of eventos) {
    eventosCache[evento] = await buscarEventos(evento);
  }

  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesesSet = new Set();
  Object.values(eventosCache).flat().forEach(r => {
    const d = new Date(r.timestamp);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    mesesSet.add(mes);
  });
  const meses = [...mesesSet].sort();

  const grupos = [...new Set(itensMatriz.map(i => i.grupo).filter(Boolean))];
  const wrap = document.createElement('div');
  wrap.className = 'matriz-wrap';
  const table = document.createElement('table');
  table.className = 'matriz-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th class="col-label" style="width:180px">indicador</th>
    <th>acum.</th>
    ${meses.map(m => {
      const [ano, mes] = m.split('-');
      return `<th>${mesesNomes[parseInt(mes) - 1]}/${ano}</th>`;
    }).join('')}
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const cache = {};
  const itensOrdenados = ordenarPorDependencia(itensMatriz);
  const cachePorMes = {};
  meses.forEach(m => { cachePorMes[m] = {}; });

  for (const grupo of grupos) {
    const secRow = document.createElement('tr');
    secRow.className = 'section-row';
    secRow.innerHTML = `<td colspan="${meses.length + 2}">${grupo}</td>`;
    tbody.appendChild(secRow);

    const itensGrupo = itensOrdenados.filter(i => i.grupo === grupo);

    for (const item of itensGrupo) {
      const def = item;
      const eventosItem = eventosCache[def.evento] || [];
      const fn = funcoes[def.funcao];
      if (!fn && !item.formula) continue;

      const dadosAcum = item.formula
        ? { valor: resolverFormula(item.formula, cache) }
        : await fn(eventosItem, def.campo_grupo, def.campo_valor, def.campo_filtro || null);
      const valorAcumRaw = typeof dadosAcum.valor === 'string'
        ? parseFloat(dadosAcum.valor.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.'))
        : dadosAcum.valor;
      const valorAcum = !isFinite(valorAcumRaw) ? null : valorAcumRaw;
      cache[item.id] = valorAcum;

      const dadosPorMes = {};
      for (const mes of meses) {
        const [ano, m] = mes.split('-');
        const eventosMes = eventosItem.filter(r => {
          const d = new Date(r.timestamp);
          return d.getFullYear() === parseInt(ano) && (d.getMonth() + 1) === parseInt(m);
        });
        const dadosMes = item.formula
          ? { valor: resolverFormula(item.formula, cachePorMes[mes]) }
          : await fn(eventosMes, def.campo_grupo, def.campo_valor, def.campo_filtro || null);
        const valMes = typeof dadosMes.valor === 'string'
          ? parseFloat(dadosMes.valor.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.'))
          : dadosMes.valor;
        dadosPorMes[mes] = !isFinite(valMes) ? null : valMes;
        cachePorMes[mes][item.id] = dadosPorMes[mes];
      }

      if (item.oculto) continue;

      const corAcum = getCorMatriz(valorAcum, item.meta_tipo, item.limite_verde, item.limite_laranja);
      const tr = document.createElement('tr');
      let html = `
        <td><div class="kpi-label" style="${item.formula ? 'cursor:help;' : ''}" data-formula="${item.formula ? montarTooltipFormula(item.formula, cache) : ''}">${def.titulo}<span class="kpi-sub">${def.descricao || ''}</span></div></td>
        <td class="cell" style="font-weight:700; font-size:11px; color:${corAcum === 'verde' ? '#7ec87e' : corAcum === 'laranja' ? '#d4900a' : corAcum === 'vermelho' ? '#e8637a' : 'var(--muted)'};">${formatarCelulaMatriz(valorAcum, def.formato)}</td>
      `;

      for (const mes of meses) {
        const val = dadosPorMes[mes];
        const cor = getCorMatriz(val, item.meta_tipo, item.limite_verde, item.limite_laranja);
        const valFormatado = formatarCelulaMatriz(val, def.formato);
        html += `<td class="cell"><span class="matriz-pill ${cor}">${valFormatado}</span></td>`;
      }

      tr.innerHTML = html;
      tbody.appendChild(tr);
    }
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  conteudo.appendChild(wrap);

  tbody.querySelectorAll('[data-formula]').forEach(el => {
    const formula = el.dataset.formula;
    if (!formula) return;
    el.addEventListener('mousemove', e => mostrarTooltip(e, formula));
    el.addEventListener('mouseleave', esconderTooltip);
  });
}

renderDashboard();