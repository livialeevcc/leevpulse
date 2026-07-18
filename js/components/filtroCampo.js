function renderFiltroCampo({ elementId, eventos, campo, titulo, onChange }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const valores = [...new Set(eventos.map(r => r.dados?.[campo]).filter(Boolean))].sort();
  const selecionados = filtrosAtivos[campo] || [];
  const colapsado = el.dataset.colapsado === 'true';

  let html = '';
  const countLabel = selecionados.length > 0 ? ` (${selecionados.length})` : '';
  html += `<div class="filtro-titulo" style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;"><span>${titulo || campo}${countLabel}</span><span style="font-size:9px; color:#444;">${colapsado ? '+' : '−'}</span></div>`;

  if (!colapsado) {
    const temNomesLongos = valores.some(v => v.length > 15);
    if (temNomesLongos) {
      html += `<input type="text" class="filtro-busca" placeholder="buscar..." style="width:100%; padding:5px 8px; margin-bottom:6px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#ccc; font-size:10px; font-family:Montserrat; outline:none;">`;
    }
    html += '<div class="filtro-btns" style="display:flex; flex-wrap:wrap; gap:4px; max-height:150px; overflow-y:auto;">';
    valores.forEach(val => {
      const ativo = selecionados.includes(val);
      html += `<button class="filtro-campo-btn" data-val="${val}" style="padding:5px 10px; font-size:10px; font-family:Montserrat; border-radius:4px; border:1px solid ${ativo ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; background:${ativo ? 'rgba(200,217,74,0.12)' : 'rgba(255,255,255,0.03)'}; color:${ativo ? 'var(--accent)' : '#888'}; cursor:pointer; transition:all 0.15s;">${val}</button>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;

  el.querySelector('.filtro-titulo').addEventListener('click', () => {
    el.dataset.colapsado = colapsado ? 'false' : 'true';
    renderFiltroCampo({ elementId, eventos, campo, titulo, onChange });
  });

  if (!colapsado) {
    el.querySelectorAll('.filtro-campo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        let atual = filtrosAtivos[campo] || [];
        if (atual.includes(val)) {
          atual = atual.filter(v => v !== val);
        } else {
          atual = [...atual, val];
        }
        onChange(campo, atual.length > 0 ? atual : '');
      });
    });

    const buscaInput = el.querySelector('.filtro-busca');
    if (buscaInput) {
      buscaInput.addEventListener('input', () => {
        const termo = buscaInput.value.toLowerCase();
        el.querySelectorAll('.filtro-campo-btn').forEach(btn => {
          btn.style.display = btn.dataset.val.toLowerCase().includes(termo) ? '' : 'none';
        });
      });
    }
  }
}

function renderFiltroMes({ elementId, eventos, campo, titulo, onChange }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesesMap = {};
  eventos.forEach(r => {
    const dataStr = r.dados?.[campo];
    if (!dataStr) return;
    const partes = dataStr.split('-');
    if (partes.length < 2) return;
    const chave = `${partes[0]}-${partes[1]}`;
    const mesIdx = parseInt(partes[1]) - 1;
    mesesMap[chave] = `${meses[mesIdx]}/${partes[0]}`;
  });

  const chaves = Object.keys(mesesMap).sort();
  const selecionados = filtrosAtivos['_mes_' + campo] || [];
  const colapsado = el.dataset.colapsado === 'true';

  let html = '';
  const countLabel = selecionados.length > 0 ? ` (${selecionados.length})` : '';
  html += `<div class="filtro-titulo" style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;"><span>${titulo || 'Mês'}${countLabel}</span><span style="font-size:9px; color:#444;">${colapsado ? '+' : '−'}</span></div>`;

  if (!colapsado) {
    html += '<div class="filtro-btns" style="display:flex; flex-wrap:wrap; gap:4px; max-height:150px; overflow-y:auto;">';
    chaves.forEach(chave => {
      const ativo = selecionados.includes(chave);
      html += `<button class="filtro-campo-btn" data-val="${chave}" style="padding:5px 10px; font-size:10px; font-family:Montserrat; border-radius:4px; border:1px solid ${ativo ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; background:${ativo ? 'rgba(200,217,74,0.12)' : 'rgba(255,255,255,0.03)'}; color:${ativo ? 'var(--accent)' : '#888'}; cursor:pointer; transition:all 0.15s;">${mesesMap[chave]}</button>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;

  el.querySelector('.filtro-titulo').addEventListener('click', () => {
    el.dataset.colapsado = colapsado ? 'false' : 'true';
    renderFiltroMes({ elementId, eventos, campo, titulo, onChange });
  });

  if (!colapsado) {
    el.querySelectorAll('.filtro-campo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        let atual = filtrosAtivos['_mes_' + campo] || [];
        if (atual.includes(val)) {
          atual = atual.filter(v => v !== val);
        } else {
          atual = [...atual, val];
        }
        onChange('_mes_' + campo, atual.length > 0 ? atual : '');
      });
    });
  }
}