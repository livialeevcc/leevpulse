let schemaPublico = [];
let etapasPublico = [];
let etapaAtualPublico = 0;
let eventoPublico = null;
let tenantPublico = null;
let mensagemFinalPublico = null;

function getParam(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}

async function initPublico() {
  tenantPublico = getParam('tenant');
  eventoPublico = getParam('evento');

  if (!tenantPublico || !eventoPublico) {
    document.getElementById('publico-fields').innerHTML =
      '<div style="color:#e8637a; font-size:13px;">Link inválido.</div>';
    return;
  }

  try { await sb.auth.signInAnonymously(); } catch (e) {}

  const { data: action } = await sb
    .from('event_actions')
    .select('*')
    .eq('evento', eventoPublico)
    .eq('tenant_id', tenantPublico)
    .single();

  const { data: schema } = await sb
    .from('event_schemas')
    .select('*')
    .eq('evento', eventoPublico)
    .eq('tenant_id', tenantPublico)
    .order('ordem', { ascending: true });

  if (!schema || schema.length === 0) {
    document.getElementById('publico-fields').innerHTML =
      '<div style="color:#e8637a; font-size:13px;">Formulário não encontrado.</div>';
    return;
  }

  schemaPublico = schema;
  mensagemFinalPublico = action?.mensagem_final || null;
  document.getElementById('publico-title').textContent = action?.label || '';

  etapasPublico = [...new Set(schema.map(c => c.etapa))].sort((a, b) => a - b);
  etapaAtualPublico = 0;

  const fields = document.getElementById('publico-fields');
  fields.innerHTML = '';
  for (const etapa of etapasPublico) {
    const camposEtapa = schema.filter(c => c.etapa === etapa);
    const stepDiv = document.createElement('div');
    stepDiv.className = 'wizard-step';
    stepDiv.style.display = 'none';
    let html = '';
    for (const c of camposEtapa) html += renderCampoPublico(c);
    stepDiv.innerHTML = html;
    fields.appendChild(stepDiv);
  }

  mostrarEtapaPublico(0);
}

function renderCampoPublico(c) {
  let opcoes = [];
  if (c.opcoes) {
    if (c.tipo === 'select_com_cor') opcoes = c.opcoes.map(o => ({ value: o.valor, label: o.label }));
    else opcoes = c.opcoes.map(o => ({ value: o, label: o }));
  }

  let input = '';

  if (c.tipo === 'descricao') {
    return `<div style="margin-bottom:16px; padding:14px 16px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:13px; color:#e8e8e6; line-height:1.5;">${c.label}</div>`;
  } else if ((c.tipo === 'select' || c.tipo === 'select_com_cor') && opcoes.length > 0) {
    if (opcoes.length <= 5) {
      const chips = opcoes.map(o => `
        <div onclick="selectChipPublico(this, '${c.campo}')" data-value="${o.value}" style="display:inline-block; cursor:pointer; font-size:11px; padding:5px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.1); color:#666; background:transparent; margin:0 6px 6px 0; transition:all 0.15s;">${o.label}</div>`).join('');
      input = `<div id="field-${c.campo}" data-value="" style="padding-top:4px;">${chips}</div>`;
    } else {
      const opts = opcoes.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      input = `<select id="field-${c.campo}" style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:13px;"><option value="">selecione...</option>${opts}</select>`;
    }
  } else if (c.tipo === 'textarea') {
    input = `<textarea id="field-${c.campo}" rows="3" style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:13px; resize:vertical;"></textarea>`;
  } else if (c.tipo === 'checkbox_multiplo') {
    const chips = opcoes.map(o => `
      <div onclick="toggleCheckPublico(this, '${c.campo}')" data-value="${o.value}" style="display:inline-block; cursor:pointer; font-size:11px; padding:5px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.1); color:#666; background:transparent; margin:0 6px 6px 0; transition:all 0.15s;">${o.label}</div>`).join('');
    input = `<div id="field-${c.campo}" data-values='[]' style="padding-top:4px;">${chips}</div>`;
  } else {
    input = `<input id="field-${c.campo}" type="${c.tipo}" style="width:100%; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:13px;">`;
  }

  return `<div style="margin-bottom:16px;"><label style="font-size:10px; color:#666; display:block; margin-bottom:6px;">${c.label.toUpperCase()}${c.obrigatorio ? ' *' : ''}</label>${input}</div>`;
}

function selectChipPublico(el, campo) {
  const container = document.getElementById('field-' + campo);
  container.querySelectorAll('div').forEach(d => {
    d.style.borderColor = 'rgba(255,255,255,0.1)'; d.style.color = '#666'; d.style.background = 'transparent';
  });
  el.style.borderColor = '#00e5a0'; el.style.color = '#00e5a0'; el.style.background = 'rgba(0,229,160,0.08)';
  container.dataset.value = el.dataset.value;
}

function toggleCheckPublico(el, campo) {
  const container = document.getElementById('field-' + campo);
  let atuais = JSON.parse(container.dataset.values || '[]');
  const val = el.dataset.value;
  if (atuais.includes(val)) {
    atuais = atuais.filter(v => v !== val);
    el.style.borderColor = 'rgba(255,255,255,0.1)'; el.style.color = '#666'; el.style.background = 'transparent';
  } else {
    atuais.push(val);
    el.style.borderColor = '#00e5a0'; el.style.color = '#00e5a0'; el.style.background = 'rgba(0,229,160,0.08)';
  }
  container.dataset.values = JSON.stringify(atuais);
}

function mostrarEtapaPublico(indice) {
  etapaAtualPublico = indice;
  document.querySelectorAll('.wizard-step').forEach((el, i) => {
    el.style.display = i === indice ? 'block' : 'none';
  });
  const footer = document.getElementById('publico-footer');
  const total = etapasPublico.length;
  const ehUltima = indice === total - 1;
  const ehPrimeira = indice === 0;
  footer.innerHTML = `
    <span style="font-size:11px; color:#666; margin-right:auto; align-self:center;">${indice + 1} / ${total}</span>
    ${!ehPrimeira ? `<button onclick="voltarPublico()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#666; cursor:pointer;">voltar</button>` : ''}
    ${ehUltima
      ? `<button onclick="enviarPublico()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">enviar</button>`
      : `<button onclick="avancarPublico()" style="font-size:11px; padding:8px 16px; border-radius:6px; border:none; background:#00e5a0; color:#0c0c0d; cursor:pointer; font-weight:500;">avançar</button>`}`;
}

function avancarPublico() { if (etapaAtualPublico < etapasPublico.length - 1) mostrarEtapaPublico(etapaAtualPublico + 1); }
function voltarPublico() { if (etapaAtualPublico > 0) mostrarEtapaPublico(etapaAtualPublico - 1); }

async function enviarPublico() {
  const dados = {};
  for (const c of schemaPublico) {
    if (c.tipo === 'descricao') continue;
    const el = document.getElementById('field-' + c.campo);
    if (!el) continue;
    if (c.tipo === 'checkbox_multiplo') {
      dados[c.campo] = JSON.parse(el.dataset.values || '[]');
      if (c.obrigatorio && dados[c.campo].length === 0) { alert(c.label + ' é obrigatório'); return; }
      continue;
    }
    const val = (el.tagName === 'SELECT' ? el.value : el.tagName === 'TEXTAREA' ? el.value : el.tagName === 'DIV' ? el.dataset.value : el.value || '').trim();
    if (c.obrigatorio && !val) { alert(c.label + ' é obrigatório'); return; }
    dados[c.campo] = val;
  }

  const now = new Date();
  const caseId = 'PULSE-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');

  const { error } = await sb.from('events').insert({
    case_id: caseId,
    evento: eventoPublico,
    operador_id: 'publico',
    tenant_id: tenantPublico,
    dados
  });

  if (error) { alert('erro ao enviar: ' + error.message); return; }

  document.getElementById('publico-title').textContent = '';
  document.getElementById('publico-fields').innerHTML = `
    <div style="text-align:center; padding:32px 12px; font-size:14px; color:#e8e8e6; line-height:1.6;">
      ${mensagemFinalPublico || 'Enviado. Obrigado.'}
    </div>`;
  document.getElementById('publico-footer').innerHTML = '';
}

initPublico();