const paletaMetricCard = [
  { bg: '#d4e87a', texto: '#2a3010' },
  { bg: '#f0a0b0', texto: '#4a1020' },
  { bg: '#a8b8d8', texto: '#1a2540' },
  { bg: '#c8d890', texto: '#2a3010' },
  { bg: '#f5c0c0', texto: '#4a1010' },
  { bg: '#b8cce8', texto: '#0e1e38' },
];

let metricCardIndex = 0;

function resetMetricCardIndex() {
  metricCardIndex = 0;
}

function renderMetricCard({ elementId, label, value, sub, formato = 'numero' }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const cor = paletaMetricCard[metricCardIndex % paletaMetricCard.length];
  metricCardIndex++;

  el.closest('div[id]')?.parentElement?.style && Object.assign(
    el.closest('div') ,{ }
  );

  function formatar(val) {
    if (val === null || val === undefined) return '—';
    if (formato === 'moeda') return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (formato) return val + ' ' + formato;
    return val;
  }

  el.innerHTML = `
    <div style="
      background: ${cor.bg};
      border-radius: 10px;
      padding: 14px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    ">
      <div style="font-size:9px; color:${cor.texto}99; text-transform:uppercase; letter-spacing:0.07em; line-height:1.3;">${label}</div>
      <div style="font-size:22px; font-weight:700; color:${cor.texto}; line-height:1; margin-top:6px;">${formatar(value)}</div>
      <div style="font-size:9px; color:${cor.texto}77; margin-top:4px;">${sub || ''}</div>
    </div>
  `;
}