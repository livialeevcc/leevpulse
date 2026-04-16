function renderBarStacked({ elementId, categorias, series, horizontal = true }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: 350,
      stacked: true,
      background: 'transparent'
    },
    theme: { mode: 'dark' },
    plotOptions: {
      bar: { horizontal, borderRadius: 4 }
    },
    dataLabels: { enabled: false },
    series,
    xaxis: { categories: categorias },
    colors: ['#ff4d4d', '#ffaa00', '#6b8cff', '#c084fc'],
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    legend: { position: 'top' },
    tooltip: { theme: 'dark' }
  }).render();
}