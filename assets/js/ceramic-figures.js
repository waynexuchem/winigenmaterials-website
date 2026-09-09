/* Progressive figure inspection: full composition first, readable detail on demand. */
for (const button of document.querySelectorAll('.ceramic-series .figure-zoom')) {
  const viewport = document.getElementById(button.getAttribute('aria-controls'));
  const hint = button.parentElement.querySelector('.figure-hint');
  if (!viewport) continue;
  button.hidden = false;
  button.addEventListener('click', () => {
    const inspecting = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(inspecting));
    button.textContent = inspecting ? 'Fit full diagram' : 'Inspect diagram';
    viewport.dataset.inspecting = String(inspecting);
    if (hint) hint.hidden = !inspecting;
    if (!inspecting) viewport.scrollLeft = 0;
  });
}
