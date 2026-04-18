function renderDropdown({ elementId, opcoes, placeholder, onChange }) {
  const wrapper = document.getElementById(elementId);
  if (!wrapper) return;

  wrapper.innerHTML = `
    <div style="position:relative;" id="fonte-wrapper-${elementId}">
      <input id="field-${elementId}"
             type="text"
             autocomplete="off"
             placeholder="${placeholder || 'buscar...'}"
             oninput="filtrarDropdown('${elementId}', this.value)"
             onfocus="abrirDropdownSimples('${elementId}')"
             style="background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 12px; color:#e8e8e6; font-size:11px; width:200px;">
      <div id="dropdown-${elementId}"
           style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--surface2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; max-height:200px; overflow-y:auto; z-index:200; margin-top:4px;">
        <div id="dropdown-opts-${elementId}"></div>
      </div>
    </div>`;

  window[`_dropdown_opts_${elementId}`] = opcoes;
  window[`_dropdown_onChange_${elementId}`] = onChange;

  renderDropdownOpcoes(elementId, opcoes);
}

function renderDropdownOpcoes(elementId, opcoes) {
  document.getElementById(`dropdown-opts-${elementId}`).innerHTML = opcoes.map(o => `
    <div onclick="selecionarDropdown('${elementId}', '${o.value}', '${o.label}')"
         style="padding:8px 12px; font-size:11px; color:#ccc; cursor:pointer;"
         onmouseover="this.style.background='var(--surface)'"
         onmouseout="this.style.background='transparent'">
      ${o.label}
    </div>`).join('');
}

function abrirDropdownSimples(elementId) {
  const opts = window[`_dropdown_opts_${elementId}`] || [];
  renderDropdownOpcoes(elementId, opts);
  document.getElementById(`dropdown-${elementId}`).style.display = 'block';
}

function filtrarDropdown(elementId, busca) {
  const todasOpcoes = window[`_dropdown_opts_${elementId}`] || [];
  const filtradas = busca
    ? todasOpcoes.filter(o => o.label.toLowerCase().includes(busca.toLowerCase()))
    : todasOpcoes;
  renderDropdownOpcoes(elementId, filtradas);
  document.getElementById(`dropdown-${elementId}`).style.display = 'block';
}

function selecionarDropdown(elementId, value, label) {
  document.getElementById(`field-${elementId}`).value = label;
  document.getElementById(`field-${elementId}`).dataset.value = value;
  document.getElementById(`dropdown-${elementId}`).style.display = 'none';
  const cb = window[`_dropdown_onChange_${elementId}`];
  if (cb) cb(value, label);
}

document.addEventListener('click', e => {
  if (!e.target.closest('[id^="fonte-wrapper-"]') && !e.target.matches('[id^="field-"]')) {
    document.querySelectorAll('[id^="dropdown-"]:not([id^="dropdown-opts-"])').forEach(d => {
      d.style.display = 'none';
    });
  }
});