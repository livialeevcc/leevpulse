function renderBarStacked({ elementId, categorias, series, horizontal = true, height = 350 }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({ xaxis: { categories: categorias } });
    graficosInstancias[elementId].updateSeries(series);
    return;
  }

  const coresAjustadas = series.map((_, i) => paletaCores[i % paletaCores.length]);
  const chart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: height,
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
    colors: coresAjustadas,
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    legend: { position: 'bottom', offsetY: 0 },
    tooltip: { theme: 'dark' }
  });
  chart.render();
  graficosInstancias[elementId] = chart;
}