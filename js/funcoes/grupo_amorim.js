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

});