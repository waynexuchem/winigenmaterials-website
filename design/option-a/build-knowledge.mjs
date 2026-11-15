import {replaceLatpIllustration} from './website-images.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {knowledgePages,renderKnowledgePage} from './knowledge-template.mjs';
export {knowledgePages,renderKnowledgePage};
export const root=fileURLToPath(new URL('../../',import.meta.url));
export async function buildKnowledge({check=false}={}){const changed=[];for(const path of knowledgePages){const before=await readFile(resolve(root,path),'utf8'),after=await renderKnowledgePage(path,replaceLatpIllustration(before,path));if(before!==after){changed.push(path);if(!check)await writeFile(resolve(root,path),after);}}const registry=JSON.parse(await readFile(resolve(root,'knowledge/articles.registry.json'),'utf8'));for(const p of registry.pages.filter(p=>p.status==='published'&&!knowledgePages.includes(p.url))){const before=await readFile(resolve(root,p.url),'utf8'),after=replaceLatpIllustration(before,p.url);if(before!==after){changed.push(p.url);if(!check)await writeFile(resolve(root,p.url),after);}}if(check&&changed.length)throw new Error('Stale Knowledge pilot: '+changed.join(', '));return changed;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({changed:await buildKnowledge({check:process.argv.includes('--check')})}));
