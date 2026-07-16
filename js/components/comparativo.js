function renderComparativo({ elementId, eventos, campoGrupo, campoComparacao, campoValor, campoFiltro }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
  const opcoesComparacao = [...new Set(filtrados.map(r => r.dados?.[campoComparacao]).filter(Boolean))].sort();
  let selecionados = [];

  function calcular() {
    const grupos = {};
    filtrados.forEach(r => {
      const grupo = r.dados?.[campoGrupo] || '—';
      const comp = r.dados?.[campoComparacao];
      if (!comp || !selecionados.includes(comp)) return;
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      if (!grupos[grupo]) grupos[grupo] = {};
      grupos[grupo][comp] = (grupos[grupo][comp] || 0) + (isNaN(val) ? 0 : val);
    });

    const totaisPorGrupo = {};
    filtrados.forEach(r => {
      const grupo = r.dados?.[campoGrupo] || '—';
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      totaisPorGrupo[grupo] = (totaisPorGrupo[grupo] || 0) + (isNaN(val) ? 0 : val);
    });

    const gruposOrdenados = Object.keys(grupos).sort((a, b) => {
      const totalA = selecionados.reduce((s, c) => s + (grupos[a]?.[c] || 0), 0);
      const totalB = selecionados.reduce((s, c) => s + (grupos[b]?.[c] || 0), 0);
      return totalB - totalA;
    });

    return { grupos, gruposOrdenados, totaisPorGrupo };
  }

  function renderizar() {
    let html = '';

    html += '<div style="margin-bottom:12px; position:relative;">';
    html += `<input id="${elementId}-comp-busca" type="text" placeholder="adicionar candidato..." style="width:100%; padding:8px 12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; font-size:11px; font-family:Montserrat; outline:none;">`;
    html += `<div id="${elementId}-comp-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:var(--surface2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; z-index:10; margin-top:4px;"></div>`;
    html += '</div>';

    if (selecionados.length > 0) {
      html += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">';
      selecionados.forEach((nome, i) => {
        const cor = paletaCores[i % paletaCores.length];
        html += `<span class="comp-tag" data-nome="${nome}" style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:4px; font-size:10px; background:${cor}22; color:${cor}; cursor:pointer;" title="clique para remover">${nome} ✕</span>`;
      });
      html += '</div>';
    }

    if (selecionados.length === 0) {
      html += '<div style="color:#444; font-size:11px; padding:20px; text-align:center;">selecione candidatos acima para comparar</div>';
      el.innerHTML = html;
      montarEventos();
      return;
    }

    const { grupos, gruposOrdenados, totaisPorGrupo } = calcular();

    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
    html += '<thead><tr>';
    html += `<th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); color:#666; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">${campoGrupo}</th>`;
    selecionados.forEach((nome, i) => {
      const cor = paletaCores[i % paletaCores.length];
      html += `<th style="text-align:right; padding:8px; border-bottom:1px solid rgba(255,255,255,0.1); color:${cor}; font-size:10px;">${nome}</th>`;
    });
    html += '</tr></thead><tbody>';

    gruposOrdenados.forEach(grupo => {
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">';
      html += `<td style="padding:8px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${grupo}</td>`;
      const ranking = [...selecionados].sort((a, b) => (grupos[grupo]?.[b] || 0) - (grupos[grupo]?.[a] || 0));
      selecionados.forEach((nome, i) => {
        const val = grupos[grupo]?.[nome] || 0;
        const total = totaisPorGrupo[grupo] || 1;
        const pct = (val / total * 100).toFixed(1);
        const cor = paletaCores[i % paletaCores.length];
        const posicao = ranking.indexOf(nome) + 1;
        const corPos = posicao === 1 ? '#7ec87e' : posicao === 2 ? '#d4900a' : posicao === 3 ? '#e8637a' : '#555';
        html += `<td style="text-align:right; padding:8px;"><div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;"><span style="font-size:9px; padding:2px 6px; border-radius:3px; background:${corPos}22; color:${corPos};">${posicao}º</span><span style="font-weight:700; color:#eee;">${val.toLocaleString('pt-BR')}</span><span style="font-size:9px; color:#555;">${pct}%</span></div></td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;
    montarEventos();
  }

  function montarEventos() {
    const busca = document.getElementById(elementId + '-comp-busca');
    const dropdown = document.getElementById(elementId + '-comp-dropdown');

    if (busca && dropdown) {
      busca.addEventListener('focus', () => atualizarDropdown(''));
      busca.addEventListener('input', () => atualizarDropdown(busca.value));

      document.addEventListener('click', (e) => {
        if (!busca.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    el.querySelectorAll('.comp-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        selecionados = selecionados.filter(n => n !== tag.dataset.nome);
        renderizar();
      });
    });

    function atualizarDropdown(termo) {
      const filtro = termo.toLowerCase();
      const disponiveis = opcoesComparacao.filter(n => 
        !selecionados.includes(n) && n.toLowerCase().includes(filtro)
      ).slice(0, 20);

      if (disponiveis.length === 0) {
        dropdown.style.display = 'none';
        return;
      }

      dropdown.style.display = 'block';
      dropdown.innerHTML = disponiveis.map(nome =>
        `<div class="comp-opcao" data-nome="${nome}" style="padding:8px 12px; cursor:pointer; font-size:11px; color:#ccc; transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">${nome}</div>`
      ).join('');

      dropdown.querySelectorAll('.comp-opcao').forEach(opcao => {
        opcao.addEventListener('click', () => {
          selecionados.push(opcao.dataset.nome);
          busca.value = '';
          dropdown.style.display = 'none';
          renderizar();
        });
      });
    }
  }

  renderizar();
}