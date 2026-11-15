// Exact reviewed UI deltas to historical snapshots; commerce, schema, documents and science remain guarded.
import{refineUxPage}from'../design/option-a/ux-review.mjs';import{documentInventory}from'../design/option-a/visual-refinement.mjs';import{readFileSync}from'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../catalog/products.source.json',import.meta.url)));
const payloadHelper=`// The optional role is carried in the existing bounded message field; no schema or delivery changes.
export function contactPayload(form) {
  const data = Object.fromEntries(fields.map(field => [field, form.elements.namedItem(field)?.value || '']));
  const title = (form.elements.namedItem('job_title')?.value || '').replace(/[\\r\\n\\x00-\\x1f]/g, ' ').trim().slice(0, 120);
  if (title) data.message = \`Job Title: \${title}\\n\\n\${data.message}\`;
  return data;
}
`;
export function expectedJobTitleTransport(text){return text.replace("const data = Object.fromEntries(fields.map((field) => [field, form.elements.namedItem(field)?.value || '']));",'const data = contactPayload(form);');}
export function expectedUxBytes(path,bytes){
 if(path==='assets/js/contact.js'){let text=bytes.toString();if(!text.includes('export function contactPayload'))text=text.replace('export async function initContactForm',payloadHelper+'export async function initContactForm');return Buffer.from(expectedJobTitleTransport(text));}
 if(path.endsWith('.html'))return Buffer.from(refineUxPage(path,bytes.toString(),{product:catalog.products.find(p=>p.url.slice(1)===path),documents:path==='quality.html'?documentInventory():[]}));
 return bytes;
}
