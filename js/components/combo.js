function renderCombo({ elementId, categorias, valoresBarra, valoresLinha, labelBarra, labelLinha, height = 300, formatoBarra, formatoLinha }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const TOP_N = 8;
  function calcularCorte(arr) {
    const validos = (arr || []).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (!validos.length) return Infinity;
    const ordenados = [...validos].sort((a, b) => b - a);
    return ordenados.length > TOP_N ? ordenados[TOP_N - 1] : -Infinity;
  }
  const corteBarra = calcularCorte(valoresBarra);
  const corteLinha = calcularCorte(valoresLinha);
  const mostrarTodos = categorias.length <= 11;

  function formatar(val, fmt) {
    if (val === null || val === undefined) return '—';
    if (fmt === 'moeda') return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (fmt === 'percentual') return val.toFixed(1) + '%';
    return Number(val).toLocaleString('pt-BR');
  }

  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({
      xaxis: { categories: categorias },
      dataLabels: {
        formatter: function(val, opts) {
          const fmt = opts.seriesIndex === 0 ? formatoBarra : formatoLinha;
          const corte = opts.seriesIndex === 0 ? corteBarra : corteLinha;
          if (!mostrarTodos && val <= corte) return '';
          return formatar(val, fmt);
        }
      }
    });
    graficosInstancias[elementId].updateSeries([
      { name: labelBarra, data: valoresBarra },
      { name: labelLinha, data: valoresLinha }
    ]);
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
    series: [
      { name: labelBarra, type: 'bar', data: valoresBarra },
      { name: labelLinha, type: 'line', data: valoresLinha }
    ],
    stroke: {
      width: [0, 3],
      curve: 'smooth'
    },
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: '60%' }
    },
    markers: {
      size: [0, 5],
      strokeWidth: 0,
      hover: { size: 7 }
    },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [0, 1],
      formatter: function(val, opts) {
        const fmt = opts.seriesIndex === 0 ? formatoBarra : formatoLinha;
        const corte = opts.seriesIndex === 0 ? corteBarra : corteLinha;
        if (!mostrarTodos && val <= corte) return '';
        return formatar(val, fmt);
      },
      style: {
        fontSize: '9px',
        fontFamily: 'Montserrat',
        fontWeight: 500,
        colors: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.5)']
      },
      background: { enabled: false },
      offsetY: -5
    },
    xaxis: {
      categories: categorias,
      labels: {
        style: { colors: '#666', fontSize: '9px', fontFamily: 'Montserrat' },
        rotate: -45,
        rotateAlways: categorias.length > 6,
        hideOverlappingLabels: true
      },
      tickAmount: Math.min(categorias.length, 20)
    },
    yaxis: [
      {
        title: { text: labelBarra, style: { color: '#666', fontSize: '9px' } },
        labels: {
          style: { colors: '#666', fontSize: '9px' },
          formatter: (val) => formatar(val, formatoBarra)
        }
      },
      {
        opposite: true,
        title: { text: labelLinha, style: { color: '#666', fontSize: '9px' } },
        labels: {
          style: { colors: '#666', fontSize: '9px' },
          formatter: (val) => formatar(val, formatoLinha)
        }
      }
    ],
    colors: [paletaCores[0], paletaCores[1]],
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#888' },
      fontSize: '10px',
      fontFamily: 'Montserrat'
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function(val, opts) {
          const fmt = opts.seriesIndex === 0 ? formatoBarra : formatoLinha;
          return formatar(val, fmt);
        }
      }
    }
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}