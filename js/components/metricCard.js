function renderMetricCard({ elementId, label, value, sub }) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `
    <div style="background:#131315; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:16px 20px;">
      <div style="font-size:10px; color:#666; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.08em;">${label}</div>
      <div style="font-size:28px; font-weight:700; color:#e8e8e6; line-height:1;">${value}</div>
      ${sub ? `<div style="font-size:11px; color:#666; margin-top:6px;">${sub}</div>` : ''}
    </div>
  `;
}