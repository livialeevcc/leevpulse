Object.assign(funcoes, {

  // Deriva a classificacao de risco de retencao e devolve os eventos
  // com o campo risco_retencao acrescentado ao dados.
  //
  // campo_valor recebe os dois campos de origem, nesta ordem:
  //   "campoDesejoDeSair,campoPropostaRecebida"
  //
  // Regra: desejo de sair = Alto. Sem desejo mas com proposta = Medio.
  //        Nenhum dos dois = Baixo.
  risco_retencao: (eventos, campoGrupo, campoValor) => {
    const [campoSair, campoProposta] = (campoValor || '').split(',').map(c => c.trim());
    return eventos.map(r => {
      const sair = r.dados?.[campoSair];
      const proposta = r.dados?.[campoProposta];
      let risco = null;
      if (sair === 'sim') risco = 'Alto';
      else if (proposta === 'sim') risco = 'Médio';
      else if (sair === 'nao') risco = 'Baixo';
      return { ...r, dados: { ...r.dados, risco_retencao: risco } };
    });
  },

  // Reproduz as 8 colunas de formula da planilha "Painel Estrategico".
  // Acrescenta ao dados de cada colaborador, sem gravar no banco:
  //   idade, idade_texto, tempo_casa_anos, tempo_casa_texto,
  //   fim_periodo_aquisitivo, limite_periodo_concessivo,
  //   saldo_ferias, situacao_ferias, pendencias, criticidade,
  //   prazo_pendencia, estimativa_rescisoria
  derivar_colaborador: (eventos) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
 
    const dia = 86400000;
 
    const paraData = (iso) => {
      if (!iso || typeof iso !== 'string') return null;
      const [a, m, d] = iso.substring(0, 10).split('-').map(Number);
      if (!a || !m || !d) return null;
      return new Date(a, m - 1, d);
    };
 
    const iso = (d) => d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : null;
 
    // equivalente ao EDATE do Excel: soma meses e limita ao ultimo dia do mes
    const somarMeses = (d, n) => {
      const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1);
      const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
      alvo.setDate(Math.min(d.getDate(), ultimo));
      return alvo;
    };
 
    // equivalente ao DATEDIF em anos completos
    const anosCompletos = (ini, fim) => {
      let anos = fim.getFullYear() - ini.getFullYear();
      const aniversario = new Date(fim.getFullYear(), ini.getMonth(), ini.getDate());
      if (aniversario > fim) anos--;
      return anos;
    };
 
    return eventos.map(r => {
      const d = { ...r.dados };
 
      const nascimento = paraData(d.data_nascimento);
      const admissao = paraData(d.admissao);
      const salario = parseFloat(d.salario_atual);
      const ativo = d.status === 'Ativo';
 
      // ---------- idade ----------
      if (nascimento) {
        d.idade = anosCompletos(nascimento, hoje);
        d.idade_texto = d.idade + ' anos';
      }
 
      // ---------- tempo de casa ----------
      if (admissao) {
        d.tempo_casa_anos = Math.round((hoje - admissao) / dia / 365.25 * 100) / 100;
        const anos = anosCompletos(admissao, hoje);
        const apos = somarMeses(admissao, anos * 12);
        let meses = 0;
        while (somarMeses(apos, meses + 1) <= hoje) meses++;
        const dias = Math.round((hoje - somarMeses(apos, meses)) / dia);
        d.tempo_casa_texto = `${anos} ano(s), ${meses} mês(es) e ${dias} dia(s)`;

        // meses corridos comparando por data, equivalente ao EDATE do Excel.
        // Quem tem 12 meses e 1 dia de casa conta 13, e sai da primeira faixa.
        let corridos = 0;
        while (somarMeses(hoje, -corridos) > admissao) corridos++;
        d.meses_casa = corridos;
      }
 
      // ---------- periodo aquisitivo ----------
      let aquisitivo = null;
      const casa = (d.ferias || '').match(/ a (\d{2})\/(\d{2})\/(\d{4})/);
      if (casa) {
        aquisitivo = new Date(Number(casa[3]), Number(casa[2]) - 1, Number(casa[1]));
      } else if (admissao) {
        aquisitivo = new Date(somarMeses(admissao, 12).getTime() - dia);
      }
      let limite = null;
      if (aquisitivo) {
        limite = somarMeses(aquisitivo, 12);
        d.fim_periodo_aquisitivo = iso(aquisitivo);
        d.limite_periodo_concessivo = iso(limite);
      }
 
      // ---------- saldo de ferias ----------
      const casaSaldo = (d.ferias || '').match(/saldo\s+([\d.,]+)/i);
      const saldo = casaSaldo ? parseFloat(casaSaldo[1].replace(/\./g, '').replace(',', '.')) || 0 : 0;
      if (d.ferias) d.saldo_ferias = saldo;
 
      // ---------- situacao de ferias ----------
      let situacao;
      if (!ativo) {
        situacao = 'Inativo';
      } else if (!admissao) {
        situacao = 'Admissão não informada';
      } else if (!d.ferias) {
        const teto = new Date(somarMeses(admissao, 24).getTime() - dia);
        if (hoje > teto) situacao = 'Férias possivelmente vencidas – sem histórico';
        else if ((teto - hoje) / dia <= 60) situacao = 'Próximas de vencer';
        else situacao = 'Em acompanhamento';
      } else if (saldo === 0) {
        situacao = 'Regular';
      } else if (hoje > limite) {
        situacao = 'Férias vencidas';
      } else if ((limite - hoje) / dia <= 60) {
        situacao = 'Próximas de vencer';
      } else {
        situacao = 'Em acompanhamento';
      }
      d.situacao_ferias = situacao;
 
      // ---------- pendencias ----------
      const pendencias = [];
      if (situacao === 'Férias vencidas') pendencias.push('Férias vencidas – regularizar imediatamente');
      if (situacao === 'Férias possivelmente vencidas – sem histórico') pendencias.push('Validar histórico de férias – possível vencimento');
      if (situacao === 'Próximas de vencer') pendencias.push('Férias próximas do limite concessivo');
      if (!d.data_nascimento) pendencias.push('Data de nascimento pendente');
      if (!d.cbo) pendencias.push('CBO pendente');
      if (d.salario_atual === undefined || d.salario_atual === null || d.salario_atual === '') pendencias.push('Salário atual pendente');
      if (!d.sindicato) pendencias.push('Sindicato pendente');
      if (!d.genero) pendencias.push('Gênero não informado');
      if (!ativo) pendencias.push('Status: ' + (d.status || ''));
      d.pendencias = pendencias.join(' | ');
 
      // ---------- criticidade e prazo ----------
      if (situacao === 'Férias vencidas' || situacao === 'Férias possivelmente vencidas – sem histórico') {
        d.criticidade = 'Crítica';
      } else if (situacao === 'Próximas de vencer') {
        d.criticidade = 'Alta';
      } else if (d.pendencias) {
        d.criticidade = 'Média';
      } else {
        d.criticidade = 'Sem pendência';
      }
      const dias_prazo = { 'Crítica': 7, 'Alta': 15, 'Média': 30 }[d.criticidade];
      if (dias_prazo) d.prazo_pendencia = iso(new Date(hoje.getTime() + dias_prazo * dia));
 
      // ---------- estimativa rescisoria ----------
      if (ativo && admissao && !isNaN(salario)) {
        const anos = anosCompletos(admissao, hoje);
        const meses = (hoje.getFullYear() - admissao.getFullYear()) * 12
                    + (hoje.getMonth() - admissao.getMonth());
        const mesesPos = Math.max(0, meses);
 
        const aviso = salario / 30 * Math.min(90, 30 + 3 * Math.max(0, anos));
        const decimo = salario * Math.max(0, (hoje.getMonth() + 1)
          - (admissao.getFullYear() === hoje.getFullYear() ? (admissao.getMonth() + 1) - 1 : 0)) / 12;
        const feriasProp = salario * ((mesesPos % 12) / 12) * 4 / 3;
        const vencido = (situacao === 'Férias vencidas'
          || situacao === 'Férias possivelmente vencidas – sem histórico') ? salario * 4 / 3 : 0;
        const fgts = 0.4 * (salario * 0.08 * mesesPos);
 
        d.estimativa_rescisoria = Math.round((aviso + decimo + feriasProp + vencido + fgts) * 100) / 100;
      }
 
      return { ...r, dados: d };
    });

    
  },  

});
