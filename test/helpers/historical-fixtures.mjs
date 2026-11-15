// Reviewed historical test authority. Never shells out to Git or fetches missing data.
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=new URL('../../',import.meta.url),fixture=new URL('../fixtures/preservation-history/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyHistoricalBytes(bytes,expected,label='historical fixture'){
 if(!/^[a-f0-9]{64}$/.test(expected)||sha(bytes)!==expected)throw Error('Historical fixture SHA-256 mismatch: '+label);
 return bytes;
}
const manifestBytes=readFileSync(new URL('manifest.json',fixture));
verifyHistoricalBytes(manifestBytes,'8a4f485b444d17da4f8a888b9fdb9ec834b6a6189fe19123e3c2f92321f3634c','manifest.json');
const manifest=JSON.parse(manifestBytes);
let blobs;
function archive(){
 if(!blobs){const compressed=readFileSync(new URL('blobs.json.gz',fixture));verifyHistoricalBytes(compressed,manifest.archiveSHA256,'blobs.json.gz');blobs=JSON.parse(gunzipSync(compressed));}
 return blobs;
}
function snapshot(rev){const full=manifest.aliases[rev]||rev,s=manifest.snapshots[full];if(!s)throw Error('Unreviewed historical commit: '+rev);return s;}
export function historicalBytes(rev,path){
 if(typeof path!=='string'||path.startsWith('/')||path.split('/').some(p=>p==='..'||p==='.'||!p))throw Error('Invalid historical path');
 const expected=snapshot(rev).files[path];if(!expected)throw Error('Unreviewed historical path: '+rev+':'+path);
 const current=new URL(path,root);
 // A reviewed historical hash is independent authority, even when the bytes already exist in the release tree.
 if(existsSync(current)){const bytes=readFileSync(current);if(sha(bytes)===expected)return bytes;}
 const hex=archive()[expected];if(typeof hex!=='string')throw Error('Historical bytes unavailable or modified: '+rev+':'+path);
 return verifyHistoricalBytes(Buffer.from(hex,'hex'),expected,rev+':'+path);
}
export function historicalPaths(rev,roots){const paths=snapshot(rev).trees[JSON.stringify(roots)];if(!paths)throw Error('Unreviewed historical tree request');return [...paths];}
// Preserve existing test inputs and encodings, replacing only their historical data access.
export function historicalSnapshot(args,options={}){
 let bytes;
 if(args.length===2&&args[0]==='show'){
  const colon=args[1].indexOf(':');if(colon<1)throw Error('Invalid historical show request');bytes=historicalBytes(args[1].slice(0,colon),args[1].slice(colon+1));
 }else if(args[0]==='ls-tree'&&args[1]==='-r'&&args[2]==='--name-only'&&args.length>=5){bytes=Buffer.from(historicalPaths(args[3],args.slice(4)).join('\n')+'\n');}
 else throw Error('Unsupported historical snapshot request');
 return options.encoding?bytes.toString(options.encoding):bytes;
}
