let filtrosAtivos = {};
let kpiConfigsGlobal = [];
let abaAtiva = null;

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
  let query = sb
    .from('events')
    .select('*')
    .eq('evento', evento)
    .eq('tenant_id', getTenantAtivo())
    .order('timestamp', { ascending: true });

  const dataInicio = getDataInicio();
  if (dataInicio) query = query.gte('timestamp', dataInicio);

  const { data } = await query;
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
  resetMetricCardIndex();
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

    const dados = await fn(eventos, config.campo_grupo, config.campo_valor, config.campo_filtro);
    if (config.descricao) dados.sub = config.descricao;
    const el = document.getElementById(config.elemento_id);
    if (!el) continue;

    const calcularAltura = (tipo) => (alturasPorTipo[tipo] || 4) * unidade - 80;

    if (config.tipo_grafico === 'metric_card') {
      renderMetricCard({ elementId: config.elemento_id, label: config.titulo, value: dados.valor, sub: dados.sub, formato: config.formato });
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

let tenantAtualConfig = null;

async function renderDashboard() {
  kpiConfigsGlobal = await buscarKpiConfig();
  resetMetricCardIndex();
  tenantAtualConfig = await buscarTenant();
  try {
    await import(`./funcoes/${getTenantAtivo()}.js`);
  } catch(e) {}
  console.log('configs carregadas:', kpiConfigsGlobal.map(c => c.elemento_id + ' → linha_acima:' + c.linha_acima));
  const dashboard = document.getElementById('dashboard');
  dashboard.innerHTML = '';

  const abas = [...new Set(kpiConfigsGlobal.map(c => c.aba).filter(Boolean))];
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

    if (itens.some(c => c.tipo_grafico === 'filtro_periodo' || c.tipo_grafico === 'filtro_cliente')) {
      const zonaFiltros = document.getElementById('zona-controles');
      itens.forEach(config => {
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
    linhaEl.style.cssText = `display:grid; grid-template-columns:${colunas}; gap:8px; margin-bottom:8px; height:${alturaPx}px;`;

    itens.forEach(config => {
      const card = document.createElement('div');
      card.style.cssText = config.tipo_grafico === 'metric_card'
        ? ''
        : 'background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px;';
      card.innerHTML = config.tipo_grafico === 'metric_card'
        ? `<div id="${config.elemento_id}"></div>`
        : `<div style="font-size:12px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);">${config.titulo}</div><div id="${config.elemento_id}"></div>`;
      linhaEl.appendChild(card);
    });

    conteudo.appendChild(linhaEl);
  }
}

async function renderMatriz(configs) {
  const conteudo = document.getElementById('aba-conteudo');
  conteudo.innerHTML = '';

  const matrizId = configs.find(c => c.tipo_grafico === 'matriz')?.elemento_id;
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
  wrapMeses.style.cssText = 'display:flex; gap:8px; margin-left:auto;';
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

      const dadosAcum = item.formula
        ? { valor: resolverFormula(item.formula, cache) }
        : await fn(eventosItem, def.campo_grupo, def.campo_valor, def.campo_filtro || null);
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

renderDashboard();