import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import { createHash } from 'node:crypto';

// Match the site's existing content-addressed, twelve-hex asset-token convention.
export function fingerprint(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}

// Only real same-site stylesheet/script tags are cache-addressed; examples and comments are ignored.
export function fingerprintHtmlAssets(html, siteRoot, pagePath='', selectedAssets=null) {
  return html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<link\b[^>]*>/gi,tag=>{
    if(tag.startsWith('<!--'))return tag;
    const end=tag.indexOf('>')+1;
    return tag.slice(0,end).replace(/\b(src|href)=(["'])(.*?)\2/g,(attr,name,quote,src)=>{
      const url=new URL(src,'https://www.winigenmaterials.com/'+pagePath.replace(/^\//,''));
      if(url.hostname!=='www.winigenmaterials.com'||!/^\/assets\/(?:css|js)\/[^?]+\.(?:css|js)$/.test(url.pathname))return attr;
      const publicPath=url.pathname.slice(1);if(selectedAssets&&!selectedAssets.has(publicPath))return attr;
      const version=fingerprint(readFileSync(resolve(siteRoot,publicPath)));
      url.searchParams.set('v',version);
      const base=src.split(/[?#]/)[0];return `${name}=${quote}${base}?${url.searchParams.toString()}${url.hash}${quote}`;
    })+tag.slice(end);
  });
}
