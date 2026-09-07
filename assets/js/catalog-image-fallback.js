(function () {
  function revealFormulaFallback(image) {
    const fallback = image.nextElementSibling;
    if (!fallback?.classList.contains('structure-fallback')) return;
    image.hidden = true;
    fallback.classList.add('structure-fallback--solid');
  }

  document.querySelectorAll('img[data-structure-fallback]').forEach(image => {
    image.addEventListener('error', () => revealFormulaFallback(image), { once: true });
    if (image.complete && image.naturalWidth === 0) revealFormulaFallback(image);
  });
}());
