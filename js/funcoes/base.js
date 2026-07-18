const funcoes = {

  arredondar: (valor, casas = 2) => {
    if (valor === null || valor === undefined) return null;
    return Math.round(valor * Math.pow(10, casas)) / Math.pow(10, casas);
  },

  aplicarFiltro: (eventos, campoFiltro) => {
    if (!campoFiltro || campoFiltro.length === 0) return eventos;
    return eventos.filter(r =>
      campoFiltro.every(([campo, valor]) =>
        Array.isArray(valor)
          ? valor.includes(r.dados?.[campo])
          : r.dados?.[campo] === valor
      )
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

  soma_empilhado: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const [campoSoma, campoSerie] = campoValor.split(',');
    const seriesSet = [...new Set(filtrados.map(r => r.dados?.[campoSerie]).filter(Boolean))];
    const grupoMap = {};
    filtrados.forEach(r => {
      const grupo = r.dados?.[campoGrupo] || '—';
      const serie = r.dados?.[campoSerie] || '—';
      const val = parseFloat(r.dados?.[campoSoma]?.toString().replace(',', '.') || 0);
      if (!grupoMap[grupo]) grupoMap[grupo] = {};
      grupoMap[grupo][serie] = (grupoMap[grupo][serie] || 0) + (isNaN(val) ? 0 : val);
    });
    const categorias = Object.keys(grupoMap).sort((a, b) => {
      const totalA = Object.values(grupoMap[a]).reduce((s, v) => s + v, 0);
      const totalB = Object.values(grupoMap[b]).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });
    const series = seriesSet.map(serie => ({
      name: serie,
      data: categorias.map(g => grupoMap[g][serie] || 0)
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

  contar_total: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    return { valor: filtrados.length, sub: null };
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

  percentual_total: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    let filtroTotal = Array.isArray(campoFiltro) ? campoFiltro : (campoFiltro ? JSON.parse(campoFiltro) : []);
    if (typeof screenContexto !== 'undefined' && screenContexto.campo) {
      filtroTotal = filtroTotal.filter(([campo]) => campo !== screenContexto.campo);
    }
    const todosNoContexto = funcoes.aplicarFiltro(eventos, filtroTotal);
    const parte = filtrados.reduce((s, r) => {
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    const total = todosNoContexto.reduce((s, r) => {
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    return { valor: total > 0 ? funcoes.arredondar(parte / total * 100, 2) : 0, sub: null };
  },

  contar_distintos: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const distintos = new Set(filtrados.map(r => r.dados?.[campoGrupo]).filter(Boolean));
    return { valor: distintos.size, sub: null };
  },

  soma_por_mes: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const map = {};
    filtrados.forEach(r => {
      const dataStr = r.dados?.[campoGrupo] || r.timestamp;
      const partes = dataStr.split('-');
      if (partes.length < 2) return;
      const chave = `${partes[0]}-${partes[1]}`;
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      map[chave] = (map[chave] || 0) + (isNaN(val) ? 0 : val);
    });
    const chaves = Object.keys(map).sort();
    const categorias = chaves.map(c => {
      const [ano, mes] = c.split('-');
      return meses[parseInt(mes) - 1];
    });
    const valores = chaves.map(k => funcoes.arredondar(map[k], 2));
    return { categorias, valores };
  },

  soma_por_grupo_ordenado: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const map = {};
    filtrados.forEach(r => {
      const grupo = r.dados?.[campoGrupo] || '—';
      const val = parseFloat(r.dados?.[campoValor]?.toString().replace(',', '.') || 0);
      map[grupo] = (map[grupo] || 0) + (isNaN(val) ? 0 : val);
    });
    const categorias = Object.keys(map).sort();
    return { categorias, valores: categorias.map(k => funcoes.arredondar(map[k], 2)) };
  },

  contar_por_mes: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const map = {};
    filtrados.forEach(r => {
      const dataStr = r.dados?.[campoGrupo];
      if (!dataStr) return;
      const partes = dataStr.split('-');
      if (partes.length < 2) return;
      const chave = `${partes[0]}-${partes[1]}`;
      map[chave] = (map[chave] || 0) + 1;
    });
    const chaves = Object.keys(map).sort();
    const categorias = chaves.map(c => {
      const mes = parseInt(c.split('-')[1]) - 1;
      return meses[mes];
    });
    const valores = chaves.map(k => map[k]);
    return { categorias, valores };
  },

  combo_por_grupo: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const [campoBarra, campoLinha] = campoValor.split(',');
    const map = {};
    filtrados.forEach(r => {
      const grupo = r.dados?.[campoGrupo] || '—';
      if (!map[grupo]) map[grupo] = { barra: 0, linha: 0 };
      const valBarra = parseFloat(r.dados?.[campoBarra]?.toString().replace(',', '.') || 0);
      const valLinha = parseFloat(r.dados?.[campoLinha]?.toString().replace(',', '.') || 0);
      map[grupo].barra += isNaN(valBarra) ? 0 : valBarra;
      map[grupo].linha += isNaN(valLinha) ? 0 : valLinha;
    });
    const categorias = Object.keys(map).sort((a, b) => map[b].barra - map[a].barra);
    return {
      categorias,
      valoresBarra: categorias.map(k => funcoes.arredondar(map[k].barra, 2)),
      valoresLinha: categorias.map(k => funcoes.arredondar(map[k].linha, 2))
    };
  },

 percentual_cruzado_por_mes: (eventosNumerador, eventosDenominador, campoGrupo, campoValor, campoFiltro) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const filtradosNum = funcoes.aplicarFiltro(eventosNumerador, campoFiltro);
    const [campoNum, campoDen] = campoValor.split(',');

    function extrairMes(r) {
      const d = new Date(r.timestamp);
      if (isNaN(d)) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const mapNum = {};
    filtradosNum.forEach(r => {
      const chave = extrairMes(r);
      if (!chave) return;
      const val = parseFloat(r.dados?.[campoNum]?.toString().replace(',', '.') || 0);
      mapNum[chave] = (mapNum[chave] || 0) + (isNaN(val) ? 0 : val);
    });

    const mapDen = {};
    eventosDenominador.forEach(r => {
      const chave = extrairMes(r);
      if (!chave) return;
      const val = parseFloat(r.dados?.[campoDen]?.toString().replace(',', '.') || 0);
      mapDen[chave] = (mapDen[chave] || 0) + (isNaN(val) ? 0 : val);
    });

    const chaves = [...new Set([...Object.keys(mapNum), ...Object.keys(mapDen)])].sort().filter(k => (mapDen[k] || 0) > 0);
    const categorias = chaves.map(c => {
      const [ano, m] = c.split('-');
      const mes = parseInt(m) - 1;
      return `${meses[mes]}/${ano}`;
    });
    const valores = chaves.map(k => {
      const num = mapNum[k] || 0;
      const den = mapDen[k] || 0;
      return den > 0 ? funcoes.arredondar(num / den * 100, 1) : 0;
    });
    return { categorias, valores };
  },

  razao_por_mes: (eventos, campoGrupo, campoValor, campoFiltro) => {
    const filtrados = funcoes.aplicarFiltro(eventos, campoFiltro);
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const [campoNum, campoDen] = campoValor.split(',');
    const mapNum = {};
    const mapDen = {};
    filtrados.forEach(r => {
      const dataStr = r.dados?.[campoGrupo] || '';
      const partes = dataStr.split('-');
      if (partes.length < 2) return;
      const chave = `${partes[0]}-${partes[1]}`;
      const valNum = parseFloat(r.dados?.[campoNum]?.toString().replace(',', '.') || 0);
      const valDen = parseFloat(r.dados?.[campoDen]?.toString().replace(',', '.') || 0);
      mapNum[chave] = (mapNum[chave] || 0) + (isNaN(valNum) ? 0 : valNum);
      mapDen[chave] = (mapDen[chave] || 0) + (isNaN(valDen) ? 0 : valDen);
    });
    const chaves = Object.keys(mapNum).sort().filter(k => (mapDen[k] || 0) > 0);
    const categorias = chaves.map(c => {
      const [ano, m] = c.split('-');
      return `${meses[parseInt(m) - 1]}/${ano}`;
    });
    const valores = chaves.map(k => funcoes.arredondar(mapNum[k] / mapDen[k], 2));
    return { categorias, valores };
  },

  nenhuma: () => ({ valor: null, sub: null }),
};