const funcoes = {

  arredondar: (valor, casas = 2) => {
    if (valor === null || valor === undefined) return null;
    return Math.round(valor * Math.pow(10, casas)) / Math.pow(10, casas);
  },

  aplicarFiltro: (eventos, campoFiltro) => {
    if (!campoFiltro || campoFiltro.length === 0) return eventos;
    return eventos.filter(r =>
      campoFiltro.every(([campo, valor]) => r.dados?.[campo] === valor)
    );
  },

  soma_por_grupo: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const map = {};
    filtrados.forEach(r => {
      const grupo = r.dados?.[campoGrupo] || '—';
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      map[grupo] = (map[grupo] || 0) + (isNaN(val) ? 0 : val);
    });
    const categorias = Object.keys(map).sort((a, b) => map[b] - map[a]);
    return { categorias, valores: categorias.map(k => map[k]) };
  },

  soma: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const total = filtrados.reduce((acc, r) => {
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return { valor: funcoes.arredondar(total), sub: null };
  },

  taxa_bio: (eventos) => {
    const total = eventos.length;
    const bio = eventos.filter(r => r.dados?.tipo === 'bio').length;
    const taxa = total > 0 ? Math.round(bio / total * 100) : 0;
    return { valor: taxa + '%', sub: 'do total de ocorrências' };
  },


  calculo_media: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const total = filtrados.reduce((acc, r) => {
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const media = filtrados.length > 0 ? total / filtrados.length : null;
    return { valor: funcoes.arredondar(media), sub: null };
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
    return { valor: taxa + '%', sub: null };
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
      .eq('tenant_id', getTenantAtivo())
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

  contar: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const map = {};
    filtrados.forEach(r => {
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
    return { valor: eventos.length, sub: null };
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
    return { valor: media ? media + ' min' : '—', sub: null };
  },

  nenhuma: () => ({ valor: null, sub: null }),
};