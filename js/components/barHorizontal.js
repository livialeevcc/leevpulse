function renderBarHorizontal({ elementId, categorias, valores, label, media }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const annotations = media ? {
    xaxis: [{
      x: media,
      borderColor: '#00e5a0',
      strokeDashArray: 4,
      label: {
        text: 'média',
        style: { color: '#00e5a0', background: 'transparent', fontSize: '11px' }
      }
    }]
  } : {};

  new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: 300,
      background: 'transparent'
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
    annotations,
    tooltip: { theme: 'dark' }
  }).render();
}