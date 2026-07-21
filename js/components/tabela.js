function renderTabela({ elementId, eventos, colunas, formato }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!colunas || colunas.length === 0) {
    if (eventos.length > 0) {
      colunas = Object.keys(eventos[0]?.dados || {}).slice(0, 8).map(c => ({ campo: c, label: c }));
    } else {
      el.innerHTML = '<div style="color:#444; font-size:11px; padding:20px; text-align:center;">sem dados</div>';
      return;
    }
  }

  let ordenacao = { campo: null, dir: 'asc' };

  function formatar(val, fmt) {
    if (val === null || val === undefined) return '—';
    if (fmt === 'moeda') return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (fmt === 'percentual') return Number(val).toFixed(1) + '%';
    if (fmt === 'data') return String(val).substring(0, 10).split('-').reverse().join('/');
    return typeof val === 'number' ? Number(val).toLocaleString('pt-BR') : val;
  }

  function isNumerico(campo) {
    for (const r of eventos.slice(0, 20)) {
      const val = r.dados?.[campo];
      if (val !== null && val !== undefined) {
        return typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val));
      }
    }
    return false;
  }

  function renderizar() {
    let dados = [...eventos];

    if (ordenacao.campo) {
      const col = colunas.find(c => c.campo === ordenacao.campo);
      const numerico = isNumerico(ordenacao.campo) || col?.formato === 'moeda' || col?.formato === 'percentual';
      dados.sort((a, b) => {
        let va = a.dados?.[ordenacao.campo];
        let vb = b.dados?.[ordenacao.campo];
        if (numerico) {
          va = parseFloat(va) || 0;
          vb = parseFloat(vb) || 0;
        } else {
          va = String(va || '').toLowerCase();
          vb = String(vb || '').toLowerCase();
        }
        if (va < vb) return ordenacao.dir === 'asc' ? -1 : 1;
        if (va > vb) return ordenacao.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const totais = {};
    colunas.forEach(col => {
      if (isNumerico(col.campo) || col.formato === 'moeda' || col.formato === 'percentual') {
        totais[col.campo] = dados.reduce((s, r) => {
          const val = parseFloat(r.dados?.[col.campo]) || 0;
          return s + val;
        }, 0);
      }
    });

    let html = '';
    html += `<div style="font-size:10px; color:#555; margin-bottom:8px;">${dados.length} registros</div>`;
    html += '<div style="overflow:auto; max-height:500px;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
    html += '<thead style="position:sticky; top:0; background:var(--surface); z-index:1;"><tr>';
    colunas.forEach(col => {
      const isOrdenado = ordenacao.campo === col.campo;
      const seta = isOrdenado ? (ordenacao.dir === 'asc' ? ' ↑' : ' ↓') : '';
      html += `<th class="tabela-th" data-campo="${col.campo}" style="text-align:left; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.1); color:${isOrdenado ? 'var(--accent)' : '#666'}; text-transform:uppercase; font-size:9px; letter-spacing:0.05em; white-space:nowrap; cursor:pointer; user-select:none;">${col.label || col.campo}${seta}</th>`;
    });
    html += '</tr></thead>';


    html += '<tbody>';
    dados.forEach(r => {
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">';
      colunas.forEach(col => {
        const val = r.dados?.[col.campo];
        html += `<td style="padding:8px 10px; color:#ccc; white-space:nowrap;">${formatar(val, col.formato)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    if (Object.keys(totais).length > 0) {
      html += '<div style="display:flex; gap:16px; flex-wrap:wrap; padding:10px 0; border-top:2px solid rgba(255,255,255,0.1); justify-content:flex-end;">';
      colunas.forEach(col => {
        if (totais[col.campo] !== undefined) {
          html += `<div style="font-size:10px;"><span style="color:#555; text-transform:uppercase;">${col.label || col.campo}: </span><span style="color:var(--accent); font-weight:700;">${formatar(totais[col.campo], col.formato)}</span></div>`;
        }
      });
      html += '</div>';
    }

    el.innerHTML = html;

    el.querySelectorAll('.tabela-th').forEach(th => {
      th.addEventListener('click', () => {
        const campo = th.dataset.campo;
        if (ordenacao.campo === campo) {
          ordenacao.dir = ordenacao.dir === 'asc' ? 'desc' : 'asc';
        } else {
          ordenacao.campo = campo;
          ordenacao.dir = 'asc';
        }
        renderizar();
      });
    });
  }

  renderizar();
}