// Keep visible website branding separate from the clean canonical/Google image.
const ORIGIN = 'https://www.winigenmaterials.com';
const localPath = value => {
  if (!value) return '';
  try { const u = new URL(value, ORIGIN); return u.origin === ORIGIN ? u.pathname : ''; }
  catch { return ''; }
};
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function cleanProductImage(product) {
  const image = product.merchantImage || product.image;
  if (/\/product-images\/website\//.test(image || '')) {
    throw new Error(`${product.slug}: website-branded image cannot be used by Google.`);
  }
  return image;
}

export function synchronizeProductImages(markup, products) {
  const byPath = new Map();
  for (const product of products) {
    if (!product.imageKind) continue;
    cleanProductImage(product);
    if (product.originalImage && product.originalImage !== product.image) {
      // Metadata/JSON-LD keep the clean asset. Visible <img> tags are switched below.
      markup = markup.split(localPath(product.originalImage)).join(localPath(product.image));
    }
    for (const path of [product.image, product.websiteImage, product.originalImage]) {
      if (path) byPath.set(localPath(path), product);
    }
  }
  let used = false;
  let next = markup.replace(/<img\b[^>]*>/gi, tag => {
    const source = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const product = byPath.get(localPath(source));
    if (!product) return tag;
    used = true;
    let image = tag.replace(/\bsrc=["'][^"']*["']/i, `src="${escape(product.websiteImage || product.image)}"`)
      .replace(/\s(?:data-product-image|data-website-branded|width|height)=["'][^"']*["']/gi, '');
    return image.replace(/\s*\/?>$/, ` data-product-image="${escape(product.imageKind)}"${product.websiteImage ? ' data-website-branded="true"' : ''} width="${product.websiteImageWidth}" height="${product.websiteImageHeight}">`);
  });
  // Qualification stays outside scientific pixels and is regenerated with the page.
  next = next.replace(/<p class="product-image-caption">[\s\S]*?<\/p>/g, '');
  next = next.replace(/(<aside\b[^>]*class=["'][^"']*\bstructure-panel\b[^"']*["'][^>]*>[\s\S]*?<img\b[^>]*>)/gi, prefix => {
    const source=prefix.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    const product=byPath.get(localPath(source));
    return product?.imageCaption ? prefix+`<p class="product-image-caption">${escape(product.imageCaption)}</p>` : prefix;
  });
  if (used) next = next.replace(/product-images\.css\?v=[^"\s]+/g, 'product-images.css?v=checkpoint-b-final-v1');
  if (used && !next.includes('/assets/css/product-images.css')) {
    next = next.replace('</head>', '<link rel="stylesheet" href="/assets/css/product-images.css?v=checkpoint-b-final-v1">\n</head>');
  }
  return next;
}
