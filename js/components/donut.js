function renderDonut({ elementId, labels, valores, height = 350 }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({ labels });
    graficosInstancias[elementId].updateSeries(valores);
    return;
  }

  const chart = new ApexCharts(el, {
    chart: {
      type: 'donut',
      height: height,
      background: 'transparent'
    },
    theme: { mode: 'dark' },
    series: valores,
    labels,
    colors: ['#ff4d4d', '#ffaa00', '#6b8cff', '#c084fc'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: true },
    tooltip: { theme: 'dark' }
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}