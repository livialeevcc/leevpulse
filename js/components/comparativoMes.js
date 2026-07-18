function renderComparativoMes({ elementId, eventos, campoData, campoValor, campoGrupo, campoFiltro }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesesMap = {};
  filtrados.forEach(r => {
    const dataStr = r.dados?.[campoData];
    if (!dataStr) return;
    const partes = dataStr.split('-');
    if (partes.length < 2) return;
    const chave = `${partes[0]}-${partes[1]}`;
    mesesMap[chave] = `${mesesNomes[parseInt(partes[1]) - 1]}/${partes[0]}`;
  });
  const mesesDisponiveis = Object.keys(mesesMap).sort();
  let selecionados = [];

  function calcular() {
    const resultado = {};
    selecionados.forEach(mes => {
      const eventosMes = filtrados.filter(r => {
        const dataStr = r.dados?.[campoData];
        if (!dataStr) return false;
        const partes = dataStr.split('-');
        return `${partes[0]}-${partes[1]}` === mes;
      });
      let valor = 0;
      eventosMes.forEach(r => {
        const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
        valor += isNaN(val) ? 0 : val;
      });
      resultado[mes] = funcoes.arredondar(valor, 2);
    });
    return resultado;
  }

  function formatarValor(val) {
    if (val === null || val === undefined) return '—';
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function renderizar() {
    let html = '';

    html += '<div style="margin-bottom:12px; position:relative;">';
    html += `<input id="${elementId}-mes-busca" type="text" placeholder="adicionar mês..." style="width:100%; padding:8px 12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; font-size:11px; font-family:Montserrat; outline:none;">`;
    html += `<div id="${elementId}-mes-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:var(--surface2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; z-index:10; margin-top:4px;"></div>`;
    html += '</div>';

    if (selecionados.length > 0) {
      html += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">';
      selecionados.forEach((mes, i) => {
        const cor = paletaCores[i % paletaCores.length];
        html += `<span class="comp-mes-tag" data-mes="${mes}" style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:4px; font-size:10px; background:${cor}22; color:${cor}; cursor:pointer;" title="clique para remover">${mesesMap[mes]} ✕</span>`;
      });
      html += '</div>';
    }

    if (selecionados.length === 0) {
      html += '<div style="color:#444; font-size:11px; padding:20px; text-align:center;">selecione meses acima para comparar</div>';
      el.innerHTML = html;
      montarEventos();
      return;
    }

    const dados = calcular();
    const maxVal = Math.max(...Object.values(dados));

    html += '<div style="display:flex; align-items:flex-end; gap:16px; justify-content:center; padding:20px 0;">';
    selecionados.forEach((mes, i) => {
      const val = dados[mes] || 0;
      const pct = maxVal > 0 ? (val / maxVal * 100) : 0;
      const cor = paletaCores[i % paletaCores.length];
      html += `<div style="text-align:center; flex:1; max-width:200px;">
        <div style="font-size:11px; font-weight:700; color:#eee; margin-bottom:6px;">${formatarValor(val)}</div>
        <div style="height:200px; display:flex; align-items:flex-end; justify-content:center;">
          <div style="width:80%; height:${pct}%; background:${cor}; border-radius:6px 6px 0 0; min-height:4px;"></div>
        </div>
        <div style="font-size:10px; color:#888; margin-top:6px;">${mesesMap[mes]}</div>
      </div>`;
    });
    html += '</div>';

    if (selecionados.length === 2) {
      const mesesOrdenados = [...selecionados].sort();
      const valAntigo = dados[mesesOrdenados[0]] || 0;
      const valRecente = dados[mesesOrdenados[1]] || 0;
      const variacao = valAntigo > 0 ? funcoes.arredondar((valRecente - valAntigo) / valAntigo * 100, 1) : 0;
      const corVar = variacao >= 0 ? '#7ec87e' : '#e8637a';
      html += `<div style="text-align:center; margin-top:8px;"><span style="font-size:12px; font-weight:700; padding:4px 12px; border-radius:4px; background:${corVar}22; color:${corVar};">${variacao >= 0 ? '+' : ''}${variacao}%</span></div>`;
    }

    el.innerHTML = html;
    montarEventos();
  }

  function montarEventos() {
    const busca = document.getElementById(elementId + '-mes-busca');
    const dropdown = document.getElementById(elementId + '-mes-dropdown');

    if (busca && dropdown) {
      busca.addEventListener('focus', () => atualizarDropdown(''));
      busca.addEventListener('input', () => atualizarDropdown(busca.value));
      document.addEventListener('click', (e) => {
        if (!busca.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    el.querySelectorAll('.comp-mes-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        selecionados = selecionados.filter(m => m !== tag.dataset.mes);
        renderizar();
      });
    });

    function atualizarDropdown(termo) {
      const filtro = termo.toLowerCase();
      const disponiveis = mesesDisponiveis.filter(m =>
        !selecionados.includes(m) && mesesMap[m].toLowerCase().includes(filtro)
      );
      if (disponiveis.length === 0) { dropdown.style.display = 'none'; return; }
      dropdown.style.display = 'block';
      dropdown.innerHTML = disponiveis.map(mes =>
        `<div class="comp-mes-opcao" data-mes="${mes}" style="padding:8px 12px; cursor:pointer; font-size:11px; color:#ccc; transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">${mesesMap[mes]}</div>`
      ).join('');
      dropdown.querySelectorAll('.comp-mes-opcao').forEach(opcao => {
        opcao.addEventListener('click', () => {
          selecionados.push(opcao.dataset.mes);
          busca.value = '';
          dropdown.style.display = 'none';
          renderizar();
        });
      });
    }
  }

  renderizar();
}