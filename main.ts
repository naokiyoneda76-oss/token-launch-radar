// Nightwatch: build the board, its offline dashboard data, and the required dossier.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, type Snapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root=fileURLToPath(new URL('.',import.meta.url));
function arg(name:string,fallback:string):string { const i=process.argv.indexOf(`--${name}`); if(i>=0&&process.argv[i+1])return process.argv[i+1]!; const eq=process.argv.find(a=>a.startsWith(`--${name}=`)); return eq?eq.slice(name.length+3):fallback; }
const inputArg=arg('input','/input/snapshot.json');
const input=inputArg.endsWith('.json')?inputArg:join(inputArg,'snapshot.json');
if(!existsSync(input)){process.stderr.write(`No snapshot found at ${input}\n`);process.exit(2);}
const out=arg('output',process.env.MAKEFUN_OUTPUT_DIR??'/output');
const snapshot=JSON.parse(readFileSync(input,'utf8')) as Snapshot;
const {board,radar}=buildRadar(snapshot), issue=boardIssue(board,snapshot);
if(issue){process.stderr.write(`Board validation failed: ${issue}\n`);process.exit(1);}
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows:board})+'\n');
writeFileSync(join(out,'data.js'),dataScript(radar));
function copyDir(from:string,to:string):string[]{ if(!existsSync(from))return[]; mkdirSync(to,{recursive:true}); const copied:string[]=[]; for(const name of readdirSync(from)){if(name.startsWith('.'))continue;const p=join(from,name);if(!statSync(p).isFile())continue;copyFileSync(p,join(to,name));copied.push(name);} return copied; }
copyDir(join(root,'dashboard'),join(out,'dashboard'));
const shots=copyDir(join(root,'screenshots'),join(out,'screenshots'));
if(shots.length<3){process.stderr.write(`screenshots/ has ${shots.length} files; 3 real view captures are required before grading.\n`);process.exit(1);}
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65_536,screenshots:{max:4,max_bytes:524_288},dashboard:{max_files:400,max_bytes:4_194_304}}));
process.stdout.write(`Nightwatch: ${board.length} pre-token rows, ${radar.live.length} tokenized comparables; wrote board, dashboard, screenshots and dossier to ${out}\n`);
