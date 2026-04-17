# Pulse — Arquitetura de Infraestrutura

## Visão Geral

O Pulse é uma plataforma de KPIs e registro de ocorrências operacionais da Leev. A arquitetura é multi-tenant com isolamento por schema no banco de dados e subdomínio por cliente na URL.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + CSS + JS vanilla |
| Hospedagem | Vercel (deploy automático via GitHub) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Gráficos | ApexCharts |

---

## Arquitetura Multi-tenant

### Subdomínio por cliente

Cada cliente acessa o Pulse pelo seu próprio subdomínio:

```
solutionlog.pulse.leev.com.br
hevile.pulse.leev.com.br
hospitalar.pulse.leev.com.br
```

O código no Vercel é único e compartilhado. Ao inicializar, o `supabase.js` lê o subdomínio via `window.location.hostname` e define o `cliente_id` ativo para filtrar todas as queries automaticamente.

### Isolamento de dados — Row Level Security (RLS)

Todas as tabelas compartilhadas têm a coluna `cliente_id`. O Supabase RLS garante que cada usuário autenticado só enxerga os dados do seu cliente, independente do código. Mesmo com um bug no frontend, o banco bloqueia o acesso cruzado.

---

## Organização do Banco de Dados

### Schemas

O banco é dividido em schemas para separar responsabilidades:

```
Schema "public"         → infraestrutura compartilhada da Leev
Schema "solutionlog"    → tabelas específicas do SolutionLog
Schema "hospitalar_sp"  → tabelas específicas do Hospitalar SP
Schema "hevile"         → tabelas específicas da Hevile
```

### Tabelas do schema public (compartilhadas)

| Tabela | Descrição | cliente_id |
|--------|-----------|------------|
| `events` | Event log principal de ocorrências | ✅ |
| `event_schemas` | Schema dinâmico de campos por evento | ✅ |
| `event_actions` | Botões e abas por tipo de evento | ✅ |
| `kpi_config` | Configuração dinâmica de KPIs e gráficos | ✅ |
| `clients` | Cadastro de clientes da Leev | — |
| `contacts` | Contatos por cliente | ✅ |
| `tabelas_auxiliares` | Metadados de tabelas específicas por cliente | ✅ |

### Tabelas específicas por cliente (schemas dedicados)

Cada cliente pode ter tabelas próprias no seu schema. Exemplos:

```
solutionlog.romaneios
solutionlog.notas_fiscais
solutionlog.veiculos

hospitalar_sp.medicamentos
hospitalar_sp.leitos

hevile.fornecedores
hevile.ordens_compra
```

### Tabela de metadados

Para rastrear de onde veio cada tabela auxiliar:

```sql
CREATE TABLE public.tabelas_auxiliares (
  tabela      TEXT NOT NULL,
  cliente_id  TEXT NOT NULL,
  descricao   TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Estrutura de Arquivos do Frontend

```
/
├── index.html          → Tela de registro de ocorrências
├── kpis2.html          → Dashboard de KPIs dinâmico
├── css/
│   └── style.css       → CSS compartilhado (variáveis, componentes)
├── js/
│   ├── supabase.js     → Inicialização do cliente Supabase
│   ├── pulse.js        → Lógica do index.html
│   ├── kpis2.js        → Lógica do dashboard de KPIs
│   └── components/
│       ├── metricCard.js     → Card de número grande
│       ├── barHorizontal.js  → Barras horizontais com linha de média
│       ├── barStacked.js     → Barras empilhadas (horizontal e vertical)
│       └── donut.js          → Gráfico de rosca
├── ARQUITETURA.md      → Este arquivo
└── COMPONENTS.md       → Documentação de componentes disponíveis
```

---

## kpi_config — Como funciona

Cada linha da tabela `kpi_config` define um elemento do dashboard. O frontend lê a tabela e monta o layout dinamicamente, sem nenhum HTML hardcoded.

### Colunas

| Coluna | Descrição |
|--------|-----------|
| `evento` | Tipo de evento do qual os dados vêm |
| `elemento_id` | ID único do elemento no DOM |
| `titulo` | Título exibido no card ou gráfico |
| `funcao` | Nome da função de transformação de dados |
| `campo_grupo` | Campo pelo qual agrupar |
| `campo_valor` | Campo de valor secundário (para empilhados) |
| `tipo_grafico` | Tipo de componente a renderizar |
| `linha_matriz` | Número da linha no layout (define ordem vertical) |
| `posicao` | Posição dentro da linha (define ordem horizontal) |
| `filtros` | Array de filtros que afetam esse elemento |
| `aba` | Nome da aba onde o elemento aparece |
| `cliente_id` | Cliente ao qual esse elemento pertence (a implementar) |

### Funções de transformação disponíveis

| Função | Descrição |
|--------|-----------|
| `contar` | Conta ocorrências agrupadas por campo |
| `contar_por_data` | Conta por data agrupando por campo |
| `contar_empilhado` | Conta por dois campos (grupo × valor) |
| `media_tempo` | Média de tempo entre hora_relato e timestamp |
| `contar_total` | Total de eventos |
| `media_tempo_geral` | Média geral de tempo de resolução |
| `taxa_bio` | Percentual de ocorrências do tipo bio |
| `resolucao_rapida` | Percentual resolvido em menos de 60min |
| `reincidencia` | Percentual de relatores com mais de 1 ocorrência |
| `tendencia` | Variação percentual vs semana anterior |

### Tipos de gráfico disponíveis

| tipo_grafico | Componente | Descrição |
|-------------|-----------|-----------|
| `metric_card` | metricCard.js | Número grande com label e subtítulo |
| `donut` | donut.js | Gráfico de rosca |
| `bar_horizontal` | barHorizontal.js | Barras horizontais com linha de média |
| `bar_stacked` | barStacked.js | Barras empilhadas horizontais |
| `bar_vertical` | barStacked.js | Barras empilhadas verticais |
| `titulo` | — | Título de seção |
| `filtro_cliente` | dropdown.js | Dropdown de seleção de cliente |
| `filtro_periodo` | — | Botões hoje / 7 dias / 30 dias |

---

## Próximos passos de infraestrutura

1. Configurar domínio `pulse.leev.com.br` no Vercel com wildcard `*.pulse.leev.com.br`
2. Atualizar `supabase.js` para ler subdomínio e definir `cliente_id` ativo
3. Adicionar coluna `cliente_id` em `event_schemas`, `event_actions` e `kpi_config`
4. Configurar Row Level Security em todas as tabelas
5. Criar schema dedicado para cada cliente no Supabase
6. Criar tabela `tabelas_auxiliares` para rastrear tabelas específicas por cliente
