function renderBarStacked({ elementId, categorias, series, horizontal = true, height = 350 }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const alturaReal = horizontal ? Math.max(height, categorias.length * 28) : height;

  if (graficosInstancias[elementId]) {
    graficosInstancias[elementId].updateOptions({ xaxis: { categories: categorias } });
    graficosInstancias[elementId].updateSeries(series);
    return;
  }

  const coresAjustadas = series.map((_, i) => paletaCores[i % paletaCores.length]);
  const chart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: alturaReal,
      stacked: true,
      background: 'transparent'
    },
    theme: { mode: 'dark' },
    plotOptions: {
      bar: { horizontal, borderRadius: 4 }
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['rgba(255,255,255,0.45)']
      }
    },
    series,
    xaxis: { categories: categorias },
    colors: coresAjustadas,
    grid: { borderColor: 'rgba(255,255,255,0.06)' },
    legend: { show: false },
    tooltip: { theme: 'dark' }
  });
  chart.render();
  graficosInstancias[elementId] = chart;

  const legendaId = elementId + '-legenda';
  const legendaEl = document.getElementById(legendaId);
  if (legendaEl) {
    legendaEl.innerHTML = series.map((s, i) => 
      `<span style="display:inline-flex; align-items:center; gap:4px; margin-right:12px; font-size:11px; color:#ccc;">` +
      `<span style="width:10px; height:10px; border-radius:2px; background:${paletaCores[i % paletaCores.length]};"></span>` +
      `${s.name}</span>`
    ).join('');
  }
}