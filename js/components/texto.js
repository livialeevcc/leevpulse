function renderTexto({ elementId, texto }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!texto) {
    el.innerHTML = '<div style="color:#888; font-size:11px;">sem conteúdo</div>';
    return;
  }

  el.innerHTML = `<div style="font-size:12px; color:#ccc; line-height:1.7; white-space:pre-wrap;">${texto}</div>`;
}