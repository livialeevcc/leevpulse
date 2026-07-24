function renderLinha({ elementId, categorias, valores, label, height = 300, formato, meta, numeradores, denominadores }) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const validos = valores.filter(v => v !== null && v !== undefined && !isNaN(v));
  const TOP_N = 8;
  const ordenados = [...validos].sort((a, b) => b - a);
  const corte = ordenados.length > TOP_N ? ordenados[TOP_N - 1] : -Infinity;

  const annotations = meta ? {
    yaxis: [{
      y: meta,
      borderColor: '#e8637a',
      strokeDashArray: 4,
      label: {
        text: 'meta: ' + formatarValor(meta),
        position: 'left',
        style: { color: '#e8637a', background: 'transparent', border: 'none', fontSize: '9px', fontFamily: 'Montserrat' }
      }
    }]
  } : {};

  function formatarValor(val) {
    if (val === null || val === undefined) return '—';
    if (formato === 'moeda') return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (formato === 'percentual') return val.toFixed(1) + '%';
    return Number(val).toLocaleString('pt-BR');
  }

  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({
      xaxis: { categories: categorias },
      dataLabels: { formatter: (val) => (categorias.length <= 12 || val > corte) ? formatarValor(val) : '' }
    });
    graficosInstancias[elementId].updateSeries([{ name: label, data: valores }]);
    return;
  }

  const chart = new ApexCharts(el, {
    chart: {
      type: 'line',
      height,
      background: 'transparent',
      toolbar: { show: true, offsetY: -4 },
      parentHeightOffset: 0,
    },
    theme: { mode: 'dark' },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    markers: {
      size: 5,
      strokeWidth: 0,
      hover: { size: 7 }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => (categorias.length <= 11 || val > corte) ? formatarValor(val) : '',
      style: {
        fontSize: '10px',
        fontFamily: 'Montserrat',
        fontWeight: 500,
        colors: ['#ccc']
      },
      background: { enabled: false },
      offsetY: -8
    },
    series: [{ name: label, data: valores }],
    xaxis: {
      categories: categorias,
      labels: { style: { colors: '#666', fontSize: '10px', fontFamily: 'Montserrat' } }
    },
    yaxis: {
      labels: {
        style: { colors: '#666', fontSize: '10px', fontFamily: 'Montserrat' },
        formatter: (val) => formatarValor(val)
      }
    },
    colors: [paletaCores[1]],
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val, opts) => {
          const i = opts?.dataPointIndex;
          if (numeradores && denominadores && i != null && denominadores[i] != null) {
            const num = Number(numeradores[i]).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const den = Number(denominadores[i]).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            return `${num} / ${den} = ${formatarValor(val)}`;
          }
          return formatarValor(val);
        }
      }
    },
    annotations
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}