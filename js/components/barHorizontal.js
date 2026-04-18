function renderBarHorizontal({ elementId, categorias, valores, label, media, height = 300 }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const annotations = media ? {
    xaxis: [{
      x: media,
      borderColor: '#00e5a0',
      strokeDashArray: 4,
      label: {
        text: 'média',
        style: { color: '#00e5a0', background: 'var(--surface)', border: 'none', fontSize: '11px', fontFamily: 'Montserrat' }
      }
    }]
  } : {};

  const alturaReal = Math.max(height, categorias.length * 28);


  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({ xaxis: { categories: categorias }, annotations });
    graficosInstancias[elementId].updateSeries([{ name: label, data: valores }]);
    return;
  }

  const chart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: alturaReal,
      background: 'transparent',
      toolbar: { show: true },
      sparkline: { enabled: false },
      parentHeightOffset: 0,
    },
    theme: { mode: 'dark' },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4 }
    },
    dataLabels: { enabled: false },
    series: [{ name: label, data: valores }],
    xaxis: { categories: categorias },
    colors: ['#00e5a0'],
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    yaxis: { labels: { offsetX: 0 } },
    annotations,
    tooltip: { theme: 'dark' }
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}