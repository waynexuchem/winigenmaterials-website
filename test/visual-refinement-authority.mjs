// Explicit presentation derivative exception. Every source graph and nonlisted image remains frozen.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const lockPath='design/option-a/scientific-artwork/chemistry/structures-2f.lock.json';
const records=JSON.parse(read(lockPath));
export function expectedVisualBytes(path,before){
 const record=records.find(r=>r.asset===path);
 if(record){const bytes=read(path);if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error('Unapproved derivative hash: '+path);return bytes;}
 if(path===lockPath)return read(path);
 return before;
}
