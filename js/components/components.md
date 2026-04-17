# Componentes de KPI

## Tipos de gráfico disponíveis

| tipo_grafico   | componente        | descrição                              |
|----------------|-------------------|----------------------------------------|
| metric_card    | metricCard.js     | Número grande com label e subtítulo    |
| donut          | donut.js          | Gráfico de rosca com proporções        |
| bar_horizontal | barHorizontal.js  | Barras horizontais com linha de média  |
| bar_stacked    | barStacked.js     | Barras empilhadas horizontais          |
| bar_vertical   | barStacked.js     | Barras empilhadas verticais            |

## Tipos de gráfico que faltam

| tipo_grafico | descrição                                    | prioridade |
|--------------|----------------------------------------------|------------|
| linha        | Evolução de um valor ao longo do tempo       | média      |
| scatter      | Correlação entre dois valores numéricos      | baixa      |

## Funções de transformação disponíveis

| funcao           | campos necessários        | retorna                        |
|------------------|---------------------------|--------------------------------|
| contar           | campo_grupo               | categorias, valores            |
| contar_por_data  | campo_grupo               | categorias, series             |
| contar_empilhado | campo_grupo, campo_valor  | categorias, series             |
| media_tempo      | campo_grupo               | categorias, valores, media     |
| contar_total     | —                         | valor, sub                     |
| media_tempo_geral| —                         | valor, sub                     |

## Funções de transformação que faltam

| funcao      | descrição                                         | prioridade |
|-------------|---------------------------------------------------|------------|
| soma        | Soma de um campo numérico agrupado por outro      | média      |
| percentual  | Percentual de um valor em relação ao total        | alta       |
| tendencia   | Comparação entre período atual e anterior         | alta       |