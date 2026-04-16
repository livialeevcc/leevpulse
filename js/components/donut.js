function renderDonut({ elementId, labels, valores }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  new ApexCharts(el, {
    chart: {
      type: 'donut',
      height: 350,
      background: 'transparent'
    },
    theme: { mode: 'dark' },
    series: valores,
    labels,
    colors: ['#ff4d4d', '#ffaa00', '#6b8cff', '#c084fc'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: true },
    tooltip: { theme: 'dark' }
  }).render();
}