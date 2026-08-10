function renderLista({ elementId, categorias, valores, formato, onClick, badges, badgeConfig, faixas, sub, subMax, barraMax }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  function formatar(val) {
    if (val === null || val === undefined) return '—';
    if (formato === 'moeda') return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
    if (formato === 'percentual') return val.toFixed(1) + '%';
    return Number(val).toLocaleString('pt-BR');
  }

  const total = valores.reduce((s, v) => s + v, 0);
  const faixasOrdenadas = Array.isArray(faixas) ? [...faixas].sort((a, b) => (b.min ?? 0) - (a.min ?? 0)) : null;

  function montarBadge(valor) {
    if (!faixasOrdenadas || !faixasOrdenadas.length || valor === null || valor === undefined) return null;
    const f = faixasOrdenadas.find(x => valor >= (x.min ?? -Infinity));
    return f ? { label: f.label, cor: f.cor || '#888' } : null;
  }

  function montarSub(valor) {
    if (sub === 'nenhum') return '';
    if (sub === 'escala' && subMax) return (valor / subMax * 100).toFixed(1) + '%';
    return (total > 0 ? (valor / total * 100) : 0).toFixed(1) + '%';
  }

  function montarItem(nome, i) {
    const valor = valores[i];
    const cor = paletaCores[i % paletaCores.length];
    const base = barraMax || valores[0];
    const barPct = base > 0 ? Math.min(valor / base * 100, 100) : 0;
    const faixa = montarBadge(valor);
    const badgeTexto = faixa ? faixa.label : (badges && badges[nome] ? badges[nome] : null);
    const badgeCor = faixa ? faixa.cor
      : badgeConfig?.positivo?.includes(badges?.[nome]) ? '#7ec87e'
      : badgeConfig?.negativo?.includes(badges?.[nome]) ? '#e8637a' : '#888';
    const subTexto = montarSub(valor);
    return `
      <span style="font-size:11px; color:#999; width:24px; text-align:right; flex-shrink:0;">${i + 1}</span>
      <div style="flex:1; min-width:0;">
        ${badgeTexto ? `<div style="font-size:9px; color:${badgeCor}; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.05em;">${badgeTexto}</div>` : ''}
        <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nome}</div>
        <div style="margin-top:4px; height:3px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden;">
          <div style="height:100%; width:${barPct}%; background:${cor}; border-radius:2px;"></div>
        </div>
      </div>
      <div style="text-align:right; flex-shrink:0;">
        <div style="font-size:13px; font-weight:700; color:#eee;">${formatar(valor)}</div>
        ${subTexto ? `<div style="font-size:10px; color:#999;">${subTexto}</div>` : ''}
      </div>`;
  }

  let html = '';
  categorias.forEach((nome, i) => {
    html += `
      <div class="lista-item" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:${onClick ? 'pointer' : 'default'}; transition:background 0.15s; flex-shrink:0;"
           onmouseover="this.style.background='rgba(255,255,255,0.04)'"
           onmouseout="this.style.background='transparent'"
           data-nome="${nome}">${montarItem(nome, i)}</div>`;
  });
  el.innerHTML = html;

  const busca = document.getElementById(elementId + '-busca');
  if (busca) {
    busca.addEventListener('input', () => {
      const termo = busca.value.toLowerCase();
      el.querySelectorAll('.lista-item').forEach(item => {
        item.remove();
      });
      categorias.forEach((nome, i) => {
        if (!nome.toLowerCase().includes(termo)) return;
        const div = document.createElement('div');
        div.className = 'lista-item';
        div.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:${onClick ? 'pointer' : 'default'}; transition:background 0.15s;`;
        div.dataset.nome = nome;
        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.04)';
        div.onmouseout = () => div.style.background = 'transparent';
        div.innerHTML = montarItem(nome, i);
        if (onClick) div.addEventListener('click', () => onClick(nome));
        el.appendChild(div);
      });
      el.parentElement.scrollTop = 0;
    });
  }

  if (onClick) {
    el.querySelectorAll('.lista-item').forEach(item => {
      item.addEventListener('click', () => {
        const nome = item.dataset.nome;
        if (nome) onClick(nome);
      });
    });
  }
}