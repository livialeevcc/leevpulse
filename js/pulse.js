let labelMap = {};
let camposVisiveis = [];
let currentUser = null;
let currentTab = null;
let currentAction = null;
let currentEvento = null;
let currentCaseId = null;
let currentSchema = [];
let reguaPontosAtual = null;
let mensagemFinalAtual = null;

let tipoConfigMap = {};

function injetarEstilosTipos(schema) {
  schema.forEach(c => {
    if (c.tipo === 'select_com_cor' && Array.isArray(c.opcoes)) {
      c.opcoes.forEach(o => {
        tipoConfigMap[o.valor] = { label: o.label, cor: o.cor };
        const styleId = `badge-style-${o.valor}`;
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `.badge-${o.valor} { background: ${o.cor}22; color: ${o.cor}; }`;
          document.head.appendChild(style);
        }
      });
    }
  });
}

async function loadSchema(evento) {
  const { data } = await sb
    .from('event_schemas')
    .select('*')
    .eq('evento', evento)
    .eq('tenant_id', getTenantAtivo())
    .order('ordem', { ascending: true });
  return data || [];
}

async function loadActions() {
  const { data } = await sb
    .from('event_actions')
    .select('*')
    .eq('tenant_id', getTenantAtivo())
    .order('ordem', { ascending: true });
  return data || [];
}

async function loadFonte(fonte, filtro = null) {
    //ESSAS FONTES PRECISAM SER GENERICAS DEPOIS
  if (fonte === 'clients') {
    const { data } = await sb.from('clients').select('slug, nome').eq('tenant_id', getTenantAtivo()).order('nome');
    return data?.map(d => ({ value: d.slug, label: d.nome })) || [];
  }
  if (fonte === 'contacts') {
    let query = sb.from('contacts').select('id, nome').eq('tenant_id', getTenantAtivo()).order('nome');
    if (filtro) query = query.eq('cliente_id', filtro);
    const { data } = await query;
    return data?.map(d => ({ value: d.nome, label: d.nome })) || [];
  }
  return [];
}

function formatTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR') + ' ' +
         d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function addRow(r, prepend = false) {
  const d = r.dados || {};
  const tipo = d.tipo || '';
  const tr = document.createElement('tr');

  camposVisiveis.forEach(c => {
    const td = document.createElement('td');
    const val = d[c] || r[c] || '—';
    if (c === 'tipo') {
      const config = tipoConfigMap[val];
      const badgeStyle = config ? `background:${config.cor}22; color:${config.cor};` : '';
      const badgeLabel = config ? config.label : (labelMap[val] || val);
      td.innerHTML = `<span class="badge" style="${badgeStyle}">${badgeLabel}</span>`;
    } else if (c === 'timestamp') {
      td.className = 'mono';
      td.textContent = formatTs(r.timestamp);
    } else {
      td.className = 'mono';
      td.textContent = val;
    }
    tr.appendChild(td);
  });

  if (currentAction?.editavel) {
    const td = document.createElement('td');
    const id = 'menu-' + Math.random().toString(36).substr(2, 9);
    td.innerHTML = `
      <div style="position:relative; display:inline-block;">
        <span onclick="toggleMenu('${id}')" style="cursor:pointer; font-size:14px; color:#444; padding:4px 8px; border-radius:4px; user-select:none;">⋯</span>
        <div id="${id}" style="display:none; position:absolute; right:0; top:24px; background:var(--surface2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; min-width:120px; z-index:50; overflow:hidden;">
          <div onclick="editRow(${JSON.stringify(r).replace(/"/g, '&quot;')}); toggleMenu('${id}')" style="padding:8px 14px; font-size:11px; color:#ccc; cursor:pointer;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='transparent'">editar</div>
        </div>
      </div>`;
    tr.appendChild(td);
  }

  const tbody = document.getElementById('tbody');
  prepend ? tbody.prepend(tr) : tbody.appendChild(tr);
}

function toggleMenu(id) {
  document.querySelectorAll('[id^="menu-"]').forEach(m => {
    if (m.id !== id) m.style.display = 'none';
  });
  const menu = document.getElementById(id);
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', e => {
  if (!e.target.closest('[id^="menu-"]') && e.target.textContent !== '⋯') {
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none');
  }
  if (!e.target.closest('[id^="fonte-wrapper-"]') && !e.target.matches('[id^="field-"]')) {
    document.querySelectorAll('[id^="dropdown-"]:not([id^="dropdown-opts-"]):not([id^="dropdown-add-"])').forEach(d => {
      d.style.display = 'none';
    });
  }
});

async function load(user) {
  currentUser = user;
  document.getElementById('thead').innerHTML = '';
  document.getElementById('tbody').innerHTML = '';
  document.getElementById('tabs-bar').innerHTML = '';
  document.getElementById('action-buttons').innerHTML = '';


  const actions = await loadActions();
  const tabsBar = document.getElementById('tabs-bar');

  actions.forEach((a, i) => {
    const tab = document.createElement('button');
    tab.textContent = a.label;
    tab.className = 'tab-btn';
    tab.style.cssText = "font-size:11px; padding:8px 16px; background:transparent; border:none; border-bottom:2px solid transparent; color:#666; cursor:pointer; transition: all 0.15s;";
    tab.onclick = () => switchTab(a.evento, a.label, tab, a);
    tabsBar.appendChild(tab);

    const btn = document.createElement('button');
    btn.textContent = '+ ' + a.label;
    btn.style.cssText = "font-size:11px; padding:10px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:#00e5a0; cursor:pointer; width:100%; text-align:left;";
    btn.onclick = async () => {
      const s = await loadSchema(a.evento);
      document.getElementById('modal-overlay').style.display = 'flex';
      const temEtapas = s.some(c => c.etapa != null);
      temEtapas ? openModalWizard(a.evento, a.label, s, a.regua_pontos, a.mensagem_final) : openModal(a.evento, a.label, s);
    };
    document.getElementById('action-buttons').appendChild(btn);

    if (i === 0) setTimeout(() => tab.click(), 0);
  });
}

sb.channel('pulse')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, p => {
    if (p.new.evento !== currentTab || p.new.tenant_id !== getTenantAtivo()) return;

    const ehWizard = currentSchema.some(c => c.etapa != null);
    if (ehWizard) {
      const btnAtiva = document.querySelector('.tab-btn[style*="rgb(0, 229, 160)"]') || document.querySelector('.tab-btn');
      switchTab(currentTab, currentAction?.label || '', btnAtiva, currentAction);
    } else {
      addRow(p.new, true);
    }
  })
  .subscribe();

function renderCampoFonteHtml(c, opcoes, valorAtual) {
  const opts = opcoes.map(o => `
    <div onclick="selecionarOpcao('${c.campo}', '${o.value}', '${o.label}', this)"
         data-value="${o.value}"
         style="padding:8px 12px; font-size:12px; color:#ccc; cursor:pointer;"
         onmouseover="this.style.background='var(--surface)'"
         onmouseout="this.style.background='transparent'">
      ${o.label}
    </div>`).join('');

  return `
    <div style="position:relative;" id="fonte-wrapper-${c.campo}">
      <input id="field-${c.campo}"
             type="text"
             value="${valorAtual}"
             autocomplete="off"
             placeholder="buscar ou adicionar..."
             oninput="this.dataset.value=''; filtrarOpcoes('${c.campo}', '${c.fonte}', this.value)"
             onfocus="abrirDropdown('${c.campo}', '${c.fonte}')"
             style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:13px;">
      <div id="dropdown-${c.campo}"
           style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--surface2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; max-height:200px; overflow-y:auto; z-index:200; margin-top:4px;">
        <div id="dropdown-opts-${c.campo}">${opts}</div>
        <div id="dropdown-add-${c.campo}"
             style="display:none; padding:8px 12px; font-size:12px; color:#00e5a0; cursor:pointer; border-top:1px solid rgba(255,255,255,0.06);"
             onmouseover="this.style.background='var(--surface)'"
             onmouseout="this.style.background='transparent'">
        </div>
      </div>
    </div>`;
}

async function abrirDropdown(campo, fonte) {
  const clienteEl = document.getElementById('field-cliente_id');
  const clienteId = clienteEl?.dataset.value || null;

  if (fonte === 'contacts' && !clienteId) {
    document.getElementById('dropdown-' + campo).style.display = 'none';
    return;
  }

  const opcoes = await loadFonte(fonte, fonte === 'contacts' ? clienteId : null);
  const optsEl = document.getElementById('dropdown-opts-' + campo);
  optsEl.innerHTML = opcoes.map(o => `
    <div onclick="selecionarOpcao('${campo}', '${o.value}', '${o.label}', this)"
         data-value="${o.value}"
         style="padding:8px 12px; font-size:12px; color:#ccc; cursor:pointer;"
         onmouseover="this.style.background='var(--surface)'"
         onmouseout="this.style.background='transparent'">
      ${o.label}
    </div>`).join('');

  document.getElementById('dropdown-' + campo).style.display = 'block';
}

async function filtrarOpcoes(campo, fonte, busca) {
  const addEl = document.getElementById('dropdown-add-' + campo);
  const optsEl = document.getElementById('dropdown-opts-' + campo);
  const dropdown = document.getElementById('dropdown-' + campo);
  dropdown.style.display = 'block';

  const clienteEl = document.getElementById('field-cliente_id');
  const clienteId = clienteEl?.dataset.value || clienteEl?.value || null;
  const todasOpcoes = await loadFonte(fonte, clienteId);
  const filtradas = todasOpcoes.filter(o => o.label.toLowerCase().includes(busca.toLowerCase()));

  optsEl.innerHTML = filtradas.map(o => `
    <div onclick="selecionarOpcao('${campo}', '${o.value}', '${o.label}', this)"
         data-value="${o.value}"
         style="padding:8px 12px; font-size:12px; color:#ccc; cursor:pointer;"
         onmouseover="this.style.background='var(--surface)'"
         onmouseout="this.style.background='transparent'">
      ${o.label}
    </div>`).join('');

  const inputEl = document.getElementById('field-' + campo);
  const valorAtual = inputEl ? inputEl.value.trim() : busca;

  if (valorAtual && filtradas.length === 0) {
    addEl.textContent = '+ Adicionar "' + valorAtual + '"';
    addEl.style.display = 'block';
    addEl.onclick = () => {
      const nomeNaHora = inputEl ? inputEl.value.trim() : valorAtual;
      adicionarNovo(campo, fonte, nomeNaHora);
    };
  } else {
    addEl.style.display = 'none';
  }
}

function selecionarOpcao(campo, value, label, el) {
  const fieldEl = document.getElementById('field-' + campo);
  fieldEl.value = label;
  fieldEl.dataset.value = value;
  document.getElementById('dropdown-' + campo).style.display = 'none';

  const dependentes = currentSchema.filter(c => c.depende_de === campo);
  dependentes.forEach(c => {
    const dep = document.getElementById('field-' + c.campo);
    if (dep) { dep.value = ''; dep.dataset.value = ''; }
  });
}

async function adicionarNovo(campo, fonte, nome) {
  if (fonte === 'clients') {
    const slug = nome.toLowerCase().replace(/\s+/g, '_');
    const { error } = await sb.from('clients').insert({ nome, slug, tenant_id: getTenantAtivo() });
    if (error) { alert('erro ao adicionar: ' + error.message); return; }
    selecionarOpcao(campo, slug, nome, null);
  }
  if (fonte === 'contacts') {
    const clienteId = document.getElementById('field-cliente_id')?.dataset.value || document.getElementById('field-cliente_id')?.value;
    if (!clienteId) { alert('selecione o cliente primeiro'); return; }
    const { error } = await sb.from('contacts').insert({ nome, cliente_id: clienteId, tenant_id: getTenantAtivo() });
    if (error) { alert('erro ao adicionar: ' + error.message); return; }
    selecionarOpcao(campo, nome, nome, null);
  }
  document.getElementById('dropdown-add-' + campo).style.display = 'none';
}

async function renderCampo(c, valorAtual = '', valorPai = null) {
  let opcoes = [];

  if (c.fonte) {
    opcoes = await loadFonte(c.fonte, valorPai);
  } else if (c.opcoes) {
    if (c.tipo === 'select_com_cor') {
      opcoes = c.opcoes.map(o => ({ value: o.valor, label: o.label }));
    } else {
      opcoes = c.opcoes.map(o => ({ value: o, label: o }));
    }
  }

  const desabilitado = c.depende_de && !valorPai;
  let input = '';

  if (c.fonte) {
    input = renderCampoFonteHtml(c, opcoes, valorAtual);
    return `
      <div style="margin-bottom:16px;" id="wrapper-${c.campo}">
        <label style="font-size:10px; color:#666; display:block; margin-bottom:6px;">${c.label.toUpperCase()}${c.obrigatorio ? ' *' : ''}</label>
        ${input}
      </div>`;
  } else if ((c.tipo === 'select' || c.tipo === 'select_com_cor') && opcoes.length > 0) {
    if (opcoes.length <= 5) {
      const chips = opcoes.map(o => `
        <div onclick="selectChip(this, '${c.campo}')" data-value="${o.value}" style="display:inline-block; cursor:pointer; font-size:11px; padding:5px 12px; border-radius:20px; border:1px solid ${o.value === valorAtual ? '#00e5a0' : 'rgba(255,255,255,0.1)'}; color:${o.value === valorAtual ? '#00e5a0' : '#666'}; background:${o.value === valorAtual ? 'rgba(0,229,160,0.08)' : 'transparent'}; margin:0 6px 6px 0; transition:all 0.15s;">
          ${o.label}
        </div>`).join('');
      input = `<div id="field-${c.campo}" data-value="${valorAtual}" style="padding-top:4px;">${chips}</div>`;
    } else {
      const opts = opcoes.map(o => `<option value="${o.value}" ${o.value === valorAtual ? 'selected' : ''}>${o.label}</option>`).join('');
      input = `<select id="field-${c.campo}" ${desabilitado ? 'disabled' : ''} onchange="onCampoChange('${c.campo}', this.value)" style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:${desabilitado ? '#444' : '#e8e8e6'}; font-size:13px;"><option value="">selecione...</option>${opts}</select>`;
    }
  } else if (c.tipo === 'textarea') {
    input = `<textarea id="field-${c.campo}" rows="3" style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:13px; resize:vertical;">${valorAtual}</textarea>`;
  } else if (c.tipo === 'descricao') {
    return `
      <div style="margin-bottom:16px; padding:14px 16px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:13px; color:#e8e8e6; line-height:1.5;">
        ${c.label}
      </div>`;
  } else if (c.tipo === 'checkbox_multiplo') {
    const marcados = Array.isArray(valorAtual) ? valorAtual : [];
    const chips = opcoes.map(o => `
      <div onclick="toggleCheckMultiplo(this, '${c.campo}')" data-value="${o.value}" style="display:inline-block; cursor:pointer; font-size:11px; padding:5px 12px; border-radius:20px; border:1px solid ${marcados.includes(o.value) ? '#00e5a0' : 'rgba(255,255,255,0.1)'}; color:${marcados.includes(o.value) ? '#00e5a0' : '#666'}; background:${marcados.includes(o.value) ? 'rgba(0,229,160,0.08)' : 'transparent'}; margin:0 6px 6px 0; transition:all 0.15s;">
        ${o.label}
      </div>`).join('');
    input = `<div id="field-${c.campo}" data-values='${JSON.stringify(marcados)}' style="padding-top:4px;">${chips}</div>`;
  } else {
    input = `<input id="field-${c.campo}" type="${c.tipo}" value="${valorAtual}" style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:13px;">`;
  }

  return `
    <div style="margin-bottom:16px;" id="wrapper-${c.campo}">
      <label style="font-size:10px; color:#666; display:block; margin-bottom:6px;">${c.label.toUpperCase()}${c.obrigatorio ? ' *' : ''}</label>
      ${input}
    </div>`;
}

async function onCampoChange(campo, valor) {
  for (const c of currentSchema) {
    if (c.depende_de === campo) {
      const wrapper = document.getElementById('wrapper-' + c.campo);
      if (wrapper) {
        const novoHtml = await renderCampo(c, '', valor);
        wrapper.outerHTML = novoHtml;
      }
    }
  }
}

async function openModal(evento, label, schema) {
  currentEvento = evento;
  currentSchema = schema;
  currentCaseId = null;

  document.getElementById('modal-title').textContent = label;
  mostrarBotaoLink(evento);
  const fields = document.getElementById('modal-fields');
  const camposHtml = await Promise.all(schema.map(c => renderCampo(c)));
  fields.innerHTML = camposHtml.join('');

  document.getElementById('modal-footer').innerHTML = `
    <button onclick="closeModal()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#666; cursor:pointer;">cancelar</button>
    <button onclick="submitForm()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">registrar</button>`;

  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  const footer = document.getElementById('modal-footer');
  if (footer) {
    footer.innerHTML = `
      <button onclick="closeModal()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#666; cursor:pointer;">cancelar</button>
      <button onclick="submitForm()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">registrar</button>`;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

async function switchTab(evento, label, btnEl, action) {
  currentTab = evento;
  currentAction = action;
  labelMap = {};
  camposVisiveis = [];

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.style.borderBottom = '2px solid transparent';
    b.style.color = '#666';
  });
  btnEl.style.borderBottom = '2px solid #00e5a0';
  btnEl.style.color = '#00e5a0';

  document.getElementById('thead').innerHTML = '';
  document.getElementById('tbody').innerHTML = '';

  const [schema, { data }] = await Promise.all([
  loadSchema(evento),
  sb.from('events')
    .select('*')
    .eq('evento', evento)
    .eq('tenant_id', getTenantAtivo())
    .order('timestamp', { ascending: false })
]);

  schema.forEach(c => { labelMap[c.campo] = c.label; });
  injetarEstilosTipos(schema);

  const ehWizard = schema.some(c => c.etapa != null);
  if (ehWizard) {
    renderListaWizard(schema, data);
    return;
  }

  camposVisiveis = schema
      .filter(c => c.visivel === true)
      .map(c => c.campo);

  const thead = document.getElementById('thead');
  const tr = document.createElement('tr');
  camposVisiveis.forEach(c => {
      const th = document.createElement('th');
      th.textContent = labelMap[c] || c;
      tr.appendChild(th);
  });
  thead.appendChild(tr);

  data?.forEach(r => addRow(r));
}

let registrosWizard = {};

function formatarValorLista(c, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '—';
  if ((c.tipo === 'select' || c.tipo === 'select_com_cor') && Array.isArray(c.opcoes)) {
    const opt = c.opcoes.find(o => (o.valor ?? o) === valor);
    return opt ? (opt.label ?? opt) : valor;
  }
  return valor;
}

function pontuarResposta(gabarito, valor, regua) {
  if (!gabarito || valor == null || !regua) return null;
  for (const nivel of Object.keys(regua)) {
    const letras = gabarito[nivel] || [];
    if (Array.isArray(letras) && letras.includes(valor)) return regua[nivel];
  }
  return null;
}

function renderListaWizard(schema, data) {
  const thead = document.getElementById('thead');
  const tbody = document.getElementById('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const colunas = schema.filter(c => c.visivel === true).sort((a, b) => a.ordem - b.ordem);
  const temPontuacao = (data || []).some(r => r.dados?.pontuacao_total != null);

  const tr = document.createElement('tr');
  colunas.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c.label;
    tr.appendChild(th);
  });
  if (temPontuacao) {
    const thPontos = document.createElement('th');
    thPontos.textContent = 'Pontos';
    tr.appendChild(thPontos);
  }
  const thData = document.createElement('th');
  thData.textContent = 'Data';
  tr.appendChild(thData);
  tr.appendChild(document.createElement('th'));
  thead.appendChild(tr);

  registrosWizard = {};

  (data || []).forEach(r => {
    registrosWizard[r.case_id] = { registro: r, schema };
    const linha = document.createElement('tr');
    linha.style.cursor = 'pointer';
    linha.onclick = () => abrirDetalheWizard(r.case_id);
    linha.onmouseover = () => linha.style.background = 'var(--surface2)';
    linha.onmouseout = () => linha.style.background = 'transparent';

    let html = '';
    colunas.forEach(c => {
      html += `<td class="mono">${formatarValorLista(c, r.dados?.[c.campo])}</td>`;
    });
    if (temPontuacao) {
      const pts = r.dados?.pontuacao_total;
      html += `<td class="mono">${pts != null ? pts : ''}</td>`;
    }
    html += `<td class="mono">${formatTs(r.timestamp)}</td>`;
    html += `<td class="mono" style="color:#666;">ver ›</td>`;
    linha.innerHTML = html;
    tbody.appendChild(linha);
  });

  if ((data || []).length === 0) {
    const totalCols = colunas.length + 2;
    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center; color:#666; padding:40px; font-size:12px;">nenhum registro.</td></tr>`;
  }
}

function abrirDetalheWizard(caseId) {
  const { registro, schema } = registrosWizard[caseId];
  const dados = registro.dados || {};

  const linkBtn = document.getElementById('modal-link-btn');
  if (linkBtn) linkBtn.style.display = 'none';

  const campoTitulo = schema.filter(c => c.visivel === true).sort((a, b) => a.ordem - b.ordem)[0];
  const valorTitulo = campoTitulo ? formatarValorLista(campoTitulo, dados[campoTitulo.campo]) : '';
  document.getElementById('modal-title').textContent = valorTitulo || 'Detalhe';

  const fields = document.getElementById('modal-fields');
  fields.innerHTML = '';

  if (dados.pontuacao_total != null) {
    fields.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:var(--surface2); border-radius:8px; margin-bottom:16px;">
        <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.05em;">Pontuação total</span>
        <span style="font-size:18px; font-weight:700; color:${dados.pontuacao_total > 0 ? '#7ec87e' : dados.pontuacao_total < 0 ? '#e8637a' : '#e8e8e6'};">${dados.pontuacao_total > 0 ? '+' : ''}${dados.pontuacao_total}</span>
      </div>`;
  }

  const etapas = [...new Set(schema.map(c => c.etapa))].sort((a, b) => a - b);

  for (const etapa of etapas) {
    const camposEtapa = schema.filter(c => c.etapa === etapa).sort((a, b) => a.ordem - b.ordem);
    let html = `<div style="margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.06);">`;

    for (const c of camposEtapa) {
      if (c.tipo === 'descricao') {
        html += `<div style="font-size:13px; color:#e8e8e6; line-height:1.5; margin-bottom:10px; padding:12px 14px; background:rgba(255,255,255,0.03); border-radius:6px;">${c.label}</div>`;
        continue;
      }

      const valor = dados[c.campo];
      let valorFmt;

      if (Array.isArray(valor)) {
        valorFmt = valor.length ? valor.join(', ') : '—';
      } else if ((c.tipo === 'select' || c.tipo === 'select_com_cor') && Array.isArray(c.opcoes)) {
        const opt = c.opcoes.find(o => (o.valor ?? o) === valor);
        valorFmt = opt ? (opt.label ?? opt) : (valor || '—');
      } else {
        valorFmt = valor || '—';
      }

      const ponto = dados[c.campo + '_pontos'];
      const badgePonto = ponto != null
        ? `<span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; margin-left:8px; background:${ponto > 0 ? 'rgba(126,200,126,0.15)' : ponto < 0 ? 'rgba(232,99,122,0.15)' : 'rgba(255,255,255,0.06)'}; color:${ponto > 0 ? '#7ec87e' : ponto < 0 ? '#e8637a' : '#888'};">${ponto > 0 ? '+' : ''}${ponto}</span>`
        : '';

      html += `
        <div style="margin-bottom:8px;">
          <span style="font-size:10px; color:#666; text-transform:uppercase;">${c.label}</span>
          <div style="font-size:13px; color:#e8e8e6; margin-top:2px;">${valorFmt}${badgePonto}</div>
        </div>`;
    }

    html += `</div>`;
    fields.innerHTML += html;
  }

  document.getElementById('modal-footer').innerHTML = `
    <button onclick="closeModal()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#666; cursor:pointer;">fechar</button>`;

  document.getElementById('modal-overlay').style.display = 'flex';
}

async function editRow(r) {
  const schema = await loadSchema(r.evento);

  const linkBtn = document.getElementById('modal-link-btn');
  if (linkBtn) linkBtn.style.display = 'none';

  document.getElementById('modal-title').textContent = 'Editar ' + r.case_id;
  currentEvento = r.evento + '_editado';
  currentSchema = schema;
  currentCaseId = r.case_id;

  const fields = document.getElementById('modal-fields');
  const camposHtml = await Promise.all(schema.map(c => {
    const valorAtual = r.dados?.[c.campo] || '';
    const valorPai = c.depende_de ? r.dados?.[c.depende_de] || null : null;
    return renderCampo(c, valorAtual, valorPai);
  }));
  fields.innerHTML = camposHtml.join('');

  document.getElementById('modal-footer').innerHTML = `
    <button onclick="closeModal()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#666; cursor:pointer;">cancelar</button>
    <button onclick="submitForm()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">registrar</button>`;

  document.getElementById('modal-overlay').style.display = 'flex';
}

async function submitForm() {
  const now = new Date();
  const caseId = currentCaseId || 'PULSE-' + now.getFullYear()
    + String(now.getMonth()+1).padStart(2,'0')
    + String(now.getDate()).padStart(2,'0') + '-'
    + String(now.getHours()).padStart(2,'0')
    + String(now.getMinutes()).padStart(2,'0')
    + String(now.getSeconds()).padStart(2,'0');
  currentCaseId = null;

  const dados = {};
  for (const c of currentSchema) {
    if (c.tipo === 'descricao') continue;

    const el = document.getElementById('field-' + c.campo);
    if (!el) continue;

    if (c.tipo === 'checkbox_multiplo') {
      dados[c.campo] = JSON.parse(el.dataset.values || '[]');
      if (c.obrigatorio && dados[c.campo].length === 0) { alert(c.label + ' é obrigatório'); return; }
      continue;
    }

    const val = (el.tagName === 'SELECT' ? el.value : el.tagName === 'TEXTAREA' ? el.value : el.tagName === 'DIV' ? el.dataset.value : el.dataset.value || el.value || '').trim();
    if (c.obrigatorio && !val) { alert(c.label + ' é obrigatório'); return; }
    if (c.campo === 'hora_relato' && val) {
      const [h, m] = val.split(':');
      const d = new Date();
      d.setHours(Number(h), Number(m), 0, 0);
      dados[c.campo] = d.toISOString().substr(11, 5);
    } else {
      dados[c.campo] = val;
    }
  }

  if (reguaPontosAtual) {
    let pontuacaoTotal = 0;
    let temGabarito = false;
    for (const c of currentSchema) {
      if (!c.gabarito) continue;
      temGabarito = true;
      const ponto = pontuarResposta(c.gabarito, dados[c.campo], reguaPontosAtual);
      const valorPonto = ponto == null ? 0 : ponto;
      dados[c.campo + '_pontos'] = valorPonto;
      pontuacaoTotal += valorPonto;
    }
    if (temGabarito) dados.pontuacao_total = pontuacaoTotal;
  }

  const { error } = await sb.from('events').insert({
    case_id: caseId,
    evento: currentEvento,
    operador_id: currentUser?.email || 'leev.user',
    tenant_id: getTenantAtivo(),
    dados
  });

  if (error) { alert('erro ao salvar: ' + error.message); return; }

  if (mensagemFinalAtual) {
    document.getElementById('modal-title').textContent = '';
    document.getElementById('modal-fields').innerHTML = `
      <div style="text-align:center; padding:24px 12px; font-size:14px; color:#e8e8e6; line-height:1.6;">
        ${mensagemFinalAtual}
      </div>`;
    document.getElementById('modal-footer').innerHTML = `
      <button onclick="closeModal()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500; margin-left:auto;">fechar</button>`;
    mensagemFinalAtual = null;
    return;
  }

  closeModal();
}

function selectChip(el, campo) {
  const container = document.getElementById('field-' + campo);
  container.querySelectorAll('div').forEach(d => {
    d.style.borderColor = 'rgba(255,255,255,0.1)';
    d.style.color = '#666';
    d.style.background = 'transparent';
  });
  el.style.borderColor = '#00e5a0';
  el.style.color = '#00e5a0';
  el.style.background = 'rgba(0,229,160,0.08)';
  container.dataset.value = el.dataset.value;
}

function toggleCheckMultiplo(el, campo) {
  const container = document.getElementById('field-' + campo);
  let atuais = JSON.parse(container.dataset.values || '[]');
  const val = el.dataset.value;

  if (atuais.includes(val)) {
    atuais = atuais.filter(v => v !== val);
    el.style.borderColor = 'rgba(255,255,255,0.1)';
    el.style.color = '#666';
    el.style.background = 'transparent';
  } else {
    atuais.push(val);
    el.style.borderColor = '#00e5a0';
    el.style.color = '#00e5a0';
    el.style.background = 'rgba(0,229,160,0.08)';
  }
  container.dataset.values = JSON.stringify(atuais);
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const err = document.getElementById('login-error');
    err.textContent = 'email ou senha incorretos';
    err.style.display = 'block';
  }
}

async function showApp(user) {
if (getTenantAtivo()) {
    iniciarApp(user);
    return;
  }
  const tenants = await carregarTenants(user.id);

  if (tenants.length === 0) {
    alert('Você não tem acesso a nenhum workspace.');
    await sb.auth.signOut();
    return;
  }

  if (tenants.length === 1) {
    setTenantAtivo(tenants[0].tenant_id);
    iniciarApp(user);
    return;
  }

  const list = document.getElementById('tenant-list');
  list.innerHTML = '';
  tenants.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.tenants.nome;
    btn.style.cssText = 'width:100%; padding:12px 16px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:13px; cursor:pointer; text-align:left;';
    btn.onmouseover = () => btn.style.borderColor = 'var(--accent)';
    btn.onmouseout = () => btn.style.borderColor = 'var(--border)';
    btn.onclick = () => {
      setTenantAtivo(t.tenant_id);
      document.getElementById('tenant-screen').style.display = 'none';
      iniciarApp(user);
    };
    list.appendChild(btn);
  });

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('tenant-screen').style.display = 'flex';
}

function iniciarApp(user) {
  if (!window.location.search.includes('modo=formulario')) {
    window.location.href = 'kpis2.html';
    return;
  }
  const tenantNome = document.getElementById('tenant-nome');
  if (tenantNome) tenantNome.textContent = getTenantAtivo();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('tenant-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('action-panel').style.display = 'flex';
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('tbody').innerHTML =
    '<tr><td colspan="10" style="text-align:center; color:#666; padding:40px; font-size:12px;">carregando...</td></tr>';
  load(user);
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

let loaded = false;

sb.auth.onAuthStateChange((event, session) => {
  if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !loaded) {
    loaded = true;
    showApp(session.user);
  }
  if (event === 'SIGNED_OUT') {
    loaded = false;
    showLogin();
  }
});

let wizardEtapaAtual = 0;
let wizardEtapas = [];

async function openModalWizard(evento, label, schema, reguaPontos, mensagemFinal) {
  currentEvento = evento;
  currentSchema = schema;
  currentCaseId = null;
  reguaPontosAtual = reguaPontos || null;
  mensagemFinalAtual = mensagemFinal || null;

  const etapasSet = [...new Set(schema.map(c => c.etapa))].sort((a, b) => a - b);
  wizardEtapas = etapasSet;
  wizardEtapaAtual = 0;

  document.getElementById('modal-title').textContent = label;
  mostrarBotaoLink(evento);
  const fields = document.getElementById('modal-fields');
  fields.innerHTML = '';

  for (const etapa of etapasSet) {
    const camposEtapa = schema.filter(c => c.etapa === etapa);
    const stepDiv = document.createElement('div');
    stepDiv.className = 'wizard-step';
    stepDiv.dataset.etapa = etapa;
    stepDiv.style.display = 'none';

    const camposHtml = await Promise.all(camposEtapa.map(c => renderCampo(c)));
    stepDiv.innerHTML = camposHtml.join('');
    fields.appendChild(stepDiv);
  }

  mostrarEtapaWizard(0);
  document.getElementById('modal-overlay').style.display = 'flex';
}

function mostrarEtapaWizard(indice) {
  wizardEtapaAtual = indice;
  document.querySelectorAll('.wizard-step').forEach((el, i) => {
    el.style.display = i === indice ? 'block' : 'none';
  });
  atualizarNavegacaoWizard();
  const card = document.getElementById('modal-fields')?.parentElement;
  if (card) card.scrollTop = 0;
}

function atualizarNavegacaoWizard() {
  const footer = document.getElementById('modal-footer');
  const total = wizardEtapas.length;
  const atual = wizardEtapaAtual;
  const ehUltima = atual === total - 1;
  const ehPrimeira = atual === 0;

  footer.innerHTML = `
    <span style="font-size:11px; color:#666; margin-right:auto; align-self:center;">${atual + 1} / ${total}</span>
    ${!ehPrimeira ? `<button onclick="voltarEtapaWizard()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#666; cursor:pointer;">voltar</button>` : ''}
    ${ehUltima
      ? `<button onclick="submitForm()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">finalizar</button>`
      : `<button onclick="avancarEtapaWizard()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">avançar</button>`
    }`;
}

function copiarLinkPublico(evento, btnEl) {
  const url = `${window.location.origin}/publico.html?tenant=${getTenantAtivo()}&evento=${evento}`;
  navigator.clipboard.writeText(url).then(() => {
    const textoOriginal = btnEl.textContent;
    btnEl.textContent = 'link copiado';
    btnEl.style.color = '#00e5a0';
    setTimeout(() => {
      btnEl.textContent = textoOriginal;
      btnEl.style.color = '#666';
    }, 1500);
  }).catch(() => {
    prompt('Copie o link:', url);
  });
}

function mostrarBotaoLink(evento) {
  const btn = document.getElementById('modal-link-btn');
  if (!btn) return;
  btn.style.display = 'inline-flex';
  btn.dataset.evento = evento;
}

function copiarLinkModal(el) {
  const evento = el.dataset.evento;
  const url = `${window.location.origin}/publico.html?tenant=${getTenantAtivo()}&evento=${evento}`;
  navigator.clipboard.writeText(url).then(() => {
    el.style.color = '#00e5a0';
    setTimeout(() => { el.style.color = '#666'; }, 1500);
  }).catch(() => {
    prompt('Copie o link:', url);
  });
}

function validarEtapaWizard(indice) {
  const etapa = wizardEtapas[indice];
  const campos = currentSchema.filter(c => c.etapa === etapa);
  for (const c of campos) {
    if (!c.obrigatorio) continue;
    const el = document.getElementById('field-' + c.campo);
    if (!el) continue;
    let val;
    if (c.tipo === 'checkbox_multiplo') {
      val = JSON.parse(el.dataset.values || '[]').length > 0;
    } else if (el.tagName === 'DIV') {
      val = (el.dataset.value || '').trim() !== '';
    } else {
      val = (el.value || '').trim() !== '';
    }
    if (!val) { alert(c.label + ' é obrigatória'); return false; }
  }
  return true;
}

function avancarEtapaWizard() {
  if (!validarEtapaWizard(wizardEtapaAtual)) return;
  if (wizardEtapaAtual < wizardEtapas.length - 1) {
    mostrarEtapaWizard(wizardEtapaAtual + 1);
  }
}

function voltarEtapaWizard() {
  if (wizardEtapaAtual > 0) {
    mostrarEtapaWizard(wizardEtapaAtual - 1);
  }
}