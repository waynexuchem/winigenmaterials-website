(function () {
  const script = document.currentScript;
  const target = script?.dataset.redirectTarget;
  if (!target) return;
  const suffix = script.hasAttribute('data-preserve-location')
    ? `${window.location.search}${window.location.hash}`
    : '';
  window.location.replace(`${target}${suffix}`);
}());
