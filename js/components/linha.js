function renderLinha({ elementId, categorias, valores, label, height = 300, formato, meta }) {
  const el = document.getElementById(elementId);
  if (!el) return;

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
    graficosInstancias[elementId].updateOptions({ xaxis: { categories: categorias } });
    graficosInstancias[elementId].updateSeries([{ name: label, data: valores }]);
    return;
  }

  const chart = new ApexCharts(el, {
    chart: {
      type: 'line',
      height,
      background: 'transparent',
      toolbar: { show: true },
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
      formatter: (val) => formatarValor(val),
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
      y: { formatter: (val) => formatarValor(val) }
    },
    annotations
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}