function renderBarVerticalSimples({ elementId, categorias, valores, label, height = 300, formato }) {
  const el = document.getElementById(elementId);
  if (!el) return;

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
      type: 'bar',
      height,
      background: 'transparent',
      toolbar: { show: true },
      parentHeightOffset: 0,
    },
    theme: { mode: 'dark' },
    dataLabels: {
      enabled: true,
      formatter: (val) => formatarValor(val),
      style: {
        fontSize: '9px',
        fontFamily: 'Montserrat',
        fontWeight: 500,
        colors: ['rgba(255,255,255,0.5)']
      },
      offsetY: -15,
      dropShadow: { enabled: false }
    },
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: '60%', dataLabels: { position: 'top' } }
    },
    series: [{ name: label, data: valores }],
    xaxis: {
      categories: categorias,
      labels: { style: { colors: '#666', fontSize: '9px', fontFamily: 'Montserrat' }, rotate: -45, rotateAlways: categorias.length > 8 }
    },
    yaxis: {
      labels: {
        style: { colors: '#666', fontSize: '9px', fontFamily: 'Montserrat' },
        formatter: (val) => formatarValor(val)
      }
    },
    colors: [paletaCores[1]],
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => formatarValor(val) }
    }
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}