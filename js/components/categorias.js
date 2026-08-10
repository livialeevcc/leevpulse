function renderCategorias({ containerId, categorias, categoriaAtiva, onSelect }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (categorias.length <= 1) return;

  container.style.cssText = 'display:flex; gap:24px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:12px;';

  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.className = 'cat-btn';
    btn.style.cssText = `font-size:12px; padding:8px 0; border:none; background:transparent; color:${cat === categoriaAtiva ? 'var(--accent)' : '#555'}; cursor:pointer; font-family:Montserrat; font-weight:${cat === categoriaAtiva ? '600' : '400'}; border-bottom:2px solid ${cat === categoriaAtiva ? 'var(--accent)' : 'transparent'}; margin-bottom:-9px; transition:all 0.15s;`;
    btn.onclick = () => {
      sessionStorage.setItem('pulse_categoria', cat);
      container.querySelectorAll('.cat-btn').forEach(b => {
        const isAtiva = b.textContent === cat;
        b.style.color = isAtiva ? 'var(--accent)' : '#555';
        b.style.fontWeight = isAtiva ? '600' : '400';
        b.style.borderBottom = `2px solid ${isAtiva ? 'var(--accent)' : 'transparent'}`;
      });
      onSelect(cat);
    };
    container.appendChild(btn);
  });
}