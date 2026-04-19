function renderDonut({ elementId, labels, valores, height = 350 }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({ labels });
    graficosInstancias[elementId].updateSeries(valores);
    return;
  }

  const coresAjustadas = labels.map((_, i) => paletaCores[i % paletaCores.length]);

  const chart = new ApexCharts(el, {
    chart: {
      type: 'donut',
      height: height,
      background: 'transparent',
    },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: '40%'
        }
      }
    },
    theme: { mode: 'dark' },
    series: valores,
    labels,
    colors: coresAjustadas,
    legend: { position: 'bottom' },
    dataLabels: { enabled: true },
    tooltip: { theme: 'dark' }
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}