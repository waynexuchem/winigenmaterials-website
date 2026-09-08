/* Scoped presentation controls. These are casual copy deterrents, not security. */
(() => {
  const protectedElement = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest('[data-copy-protected="true"]');
  const scientificImage = node => node?.closest?.('img[src*="/images/mxene/"]');
  document.querySelectorAll('img[src*="/images/mxene/"]').forEach(img => {
    img.dataset.copyProtected = 'true';
    img.draggable = false;
  });
  document.addEventListener('copy', event => {
    const selection = window.getSelection();
    if (protectedElement(selection?.anchorNode) || protectedElement(selection?.focusNode)) event.preventDefault();
  });
  document.addEventListener('dragstart', event => { if (scientificImage(event.target)) event.preventDefault(); });
  document.addEventListener('contextmenu', event => { if (scientificImage(event.target)) event.preventDefault(); });

  const shell = document.querySelector('.mxene-sticky-shell');
  if (!shell) return;
  const header = document.querySelector('.header');
  const links = [...shell.querySelectorAll('nav a[href^="#"]')];
  const targets = links.map(link => document.querySelector(link.hash));
  const scroller = shell.querySelector('nav .container');
  let offset = 0, observer, pending = false;
  function highlight() {
    pending = false;
    // Compare section starts, including nested specifications/packages inside Overview.
    let active = 0, latestTop = -Infinity;
    targets.forEach((target, index) => {
      const top = target?.getBoundingClientRect().top;
      if (top <= offset + 18 && top > latestTop) { active = index; latestTop = top; }
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) active = links.length - 1;
    links.forEach((link, index) => {
      const selected = index === active;
      if (selected && link.getAttribute('aria-current') !== 'location') {
        const item = link.getBoundingClientRect(), region = scroller.getBoundingClientRect();
        if (item.left < region.left || item.right > region.right) scroller.scrollTo({left: scroller.scrollLeft + item.left - region.left - (region.width-item.width)/2, behavior:'auto'});
      }
      if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(highlight); } }
  function measure() {
    const headerHeight = Math.ceil(header?.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty('--mxene-header-height', `${headerHeight}px`);
    offset = headerHeight + Math.ceil(shell.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--mxene-anchor-offset', `${offset + 12}px`);
    observer?.disconnect();
    observer = new IntersectionObserver(schedule, {rootMargin:`-${offset}px 0px 0px 0px`, threshold:[0,1]});
    targets.filter(Boolean).forEach(target => observer.observe(target));
    schedule();
  }
  new ResizeObserver(measure).observe(header);
  new ResizeObserver(measure).observe(shell);
  window.addEventListener('scroll', schedule, {passive:true});
  links.forEach(link => link.addEventListener('click', event => {
    const target = document.querySelector(link.hash);
    if (!target) return;
    event.preventDefault();
    window.scrollTo({top:window.scrollY + target.getBoundingClientRect().top - offset - 12, behavior:'instant'});
    history.replaceState(null, '', link.hash);
    target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});
    schedule();
  }));
  measure();
})();
