#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { validate, solve, equal, convertDecisionRules } from './lib/engine.mjs';

export const readCommands=['rules','rule','reviews-due','test-coverage','exceptions','decisions','activity','attention','compliance','weekly-review'];
export const commands=[...readCommands,'simulate','evaluate','test-rule','add-rule','revise-rule','add-case','approve-rule','log-exception','resolve-exception','review-rule','import','export','draft-review','help'];
const views={rules:'select * from rule_register order by name','reviews-due':'select * from reviews_due','test-coverage':"select r.name,v.version,v.status,(select count(*)::int from test_cases c where c.rule_id=r.id) as cases,(select passed from test_runs t where t.version_id=v.id order by created_at desc,id limit 1) as last_passed from rules r join rule_versions v on v.rule_id=r.id order by r.name,v.version",exceptions:'select * from exception_queue order by due,rule',decisions:'select * from decision_summary order by name,version',activity:'select actor,action,subject,created_at from audit_events order by created_at desc,id limit 100'};
function args(argv){const flags={},pos=[];for(const a of argv){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(Object.hasOwn(flags,k))throw Error(`Duplicate flag --${k}`);flags[k]=i<0?true:a.slice(i+1);}else pos.push(a);}return {flags,pos};}
const required=(f,k)=>{if(typeof f[k]!=='string'||!f[k].trim())throw Error(`Required: --${k}=value`);return f[k].trim();};
const jsonFile=(f,k)=>JSON.parse(fs.readFileSync(path.resolve(required(f,k)),'utf8'));
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('Expected valid YYYY-MM-DD');return s;}
async function match(db,tableName,needle){
 const rows=await db.query(tableName==='rules'?'select id,name from rules order by name':"select id,summary as name from exceptions order by summary");
 const exact=rows.filter(r=>r.id===needle||r.name.toLowerCase()===needle.toLowerCase());
 const hits=exact.length?exact:rows.filter(r=>r.id.startsWith(needle)||r.name.toLowerCase().includes(needle.toLowerCase()));
 if(hits.length!==1)throw Error(`${hits.length?'Ambiguous':'No'} match for ${needle}. Candidates: ${JSON.stringify(hits.length?hits:rows)}`);
 return hits[0];
}
async function version(db,f,lock=false){
 const r=await match(db,'rules',required(f,'rule'));
 if(lock)await db.query('select id from rules where id=$1 for update',[r.id]);
 if(f.version!==undefined&&(!/^\d+$/.test(f.version)||Number(f.version)<1))throw Error('version must be a positive integer');
 const rows=await db.query(`select v.*,r.name from rule_versions v join rules r on r.id=v.rule_id where r.id=$1 ${f.version?'and v.version=$2':'and v.id=r.active_version_id'}`,[r.id,...(f.version?[Number(f.version)]:[])]);
 if(!rows.length)throw Error('No selected version. Supply --version for a draft.');return rows[0];
}
async function runTests(db,v){const cases=await db.query('select * from test_cases where rule_id=$1 order by name',[v.rule_id]);return cases.map(c=>{try{const actual=solve(v.definition,c.input).output;return {name:c.name,passed:equal(actual,c.expected),expected:c.expected,actual};}catch(e){return {name:c.name,passed:false,error:e.message};}});}
async function compliance(db){
 const out=[];const push=(rule,subject,detail,source)=>out.push({rule,subject,detail,source});
 for(const r of await db.query('select * from rule_register order by name')){
  if(r.review_due<new Date().toISOString().slice(0,10))push('REVIEW_DUE',r.name,`Review due ${r.review_due}`,'docs/compliance.md#house-controls');
  if(!r.active_version)push('NOT_APPROVED',r.name,'No approved active version','docs/compliance.md#house-controls');
  if(r.test_cases<2)push('TEST_COVERAGE',r.name,'Fewer than two regression cases','docs/compliance.md#house-controls');
 }
 for(const r of await db.query('select * from exception_queue where days_overdue>0'))push('EXCEPTION_OVERDUE',r.rule,r.summary,'docs/compliance.md#house-controls');
 for(const r of await db.query("select d.reference,d.retain_until,d.accuracy_checked from decisions d where d.personal and (d.retain_until<current_date or d.accuracy_checked<current_date-30)")){
  if(r.retain_until<new Date().toISOString().slice(0,10))push('RETENTION_REVIEW',r.reference,`Retention review was due ${r.retain_until}`,'https://www.privacy.org.nz/privacy-principles/9/');
  if(r.accuracy_checked<new Date(Date.now()-30*86400000).toISOString().slice(0,10))push('ACCURACY_REVIEW',r.reference,'Accuracy evidence exceeds the 30-day house review interval','https://www.privacy.org.nz/privacy-principles/8/');
 }
 return out;
}
export async function dispatch(db,argv){
 const {flags:f,pos}=args(argv);const cmd=pos[0]||'help';if(!commands.includes(cmd))throw Error(`Unknown command ${cmd}. Run help.`);
 const allowed=new Set(['json','actor','dry-run','rule','version','input','out','file','name','owner','purpose','review-due','reason','reference','personal','accuracy-checked','retain-until','summary','due','exception','resolution','strategy']);
 for(const k of Object.keys(f))if(!allowed.has(k))throw Error(`Unknown flag --${k}`);
 for(const k of ['json','dry-run'])if(f[k]!==undefined&&f[k]!==true)throw Error(`--${k} is a flag without a value`);
 if(pos.length>(cmd==='import'?2:1))throw Error('Unexpected positional argument');
 if(cmd==='help')return {commands,usage:'npm run rules -- <command> --json; selectors --rule=name-or-id --version=N; writes --actor=Name [--dry-run]; import decisionrules --file=export.json --strategy=first|all --owner=Name --review-due=YYYY-MM-DD --actor=Name; add-rule --name=Name --owner=Name --purpose=Text --review-due=YYYY-MM-DD --file=definition.json --actor=Name; revise-rule --rule=Name --file=definition.json --reason=Text --actor=Name; add-case --rule=Name --file=case.json --actor=Name; approve-rule --rule=Name --version=N --actor=Reviewer; evaluate --rule=Name --input=input.json --reference=OrderID --personal=no --actor=Name; simulate --rule=Name --version=N --input=input.json; test-rule --rule=Name --version=N --actor=Name; log-exception --rule=Name --summary=Text --owner=Name --due=YYYY-MM-DD --actor=Name; resolve-exception --exception=ID --resolution=Text --actor=Name; review-rule --rule=Name --review-due=YYYY-MM-DD --reason=Text --actor=Name; export --out=archive.json; draft-review --rule=Name'};
 if(views[cmd])return db.query(views[cmd]);
 if(cmd==='compliance')return compliance(db);
 if(cmd==='attention')return {reviews:await db.query(views['reviews-due']),exceptions:await db.query(views.exceptions),checks:await compliance(db)};
 if(cmd==='weekly-review')return {reviews:await db.query(views['reviews-due']),decisions:await db.query(views.decisions),exceptions:await db.query(views.exceptions)};
 if(cmd==='rule'){
  const r=await match(db,'rules',required(f,'rule'));
  return {register:await db.query('select * from rule_register where id=$1',[r.id]),versions:await db.query('select id,version,status,definition,author,rationale,approver,approved_at from rule_versions where rule_id=$1 order by version',[r.id]),cases:await db.query('select name,input,expected from test_cases where rule_id=$1 order by name',[r.id]),exceptions:await db.query('select * from exceptions where rule_id=$1 order by due',[r.id])};
 }
 if(cmd==='simulate'){const v=await version(db,f);return {rule:v.name,version:v.version,...solve(v.definition,jsonFile(f,'input'))};}
 if(cmd==='export'){
  const out={format:'business-rules-v1',exported_at:new Date().toISOString()};for(const t of ['rules','rule_versions','test_cases','test_runs','decisions','exceptions','audit_events'])out[t]=await db.query(`select * from ${t} order by id`);
  const file=path.resolve(required(f,'out'));fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});return {file,counts:Object.fromEntries(Object.entries(out).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))};
 }
 if(cmd==='draft-review'){
  const r=await match(db,'rules',required(f,'rule'));const facts=await dispatch(db,['rule',`--rule=${r.id}`]);
  const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`review-${r.id}-${Date.now()}.md`);
  fs.writeFileSync(file,`# Draft review: ${r.name}\n\nFor internal review. Nothing sent.\n\n${JSON.stringify(facts,null,2)}\n`,{flag:'wx',mode:0o600});return {file};
 }
 const actor=required(f,'actor');let result;
 await db.exec('BEGIN');
 try{
  if(cmd==='add-rule'){
   const d=validate(jsonFile(f,'file'));const name=required(f,'name'),owner=required(f,'owner'),purpose=required(f,'purpose'),due=date(required(f,'review-due'));
   const [r]=await db.query('insert into rules(name,owner,purpose,review_due) values($1,$2,$3,$4) returning id,name',[name,owner,purpose,due]);
   const [v]=await db.query('insert into rule_versions(rule_id,version,definition,author,rationale) values($1,1,$2,$3,$4) returning id,version,status',[r.id,JSON.stringify(d),actor,'Initial rule']);result={rule:r.name,...v};
  }else if(cmd==='revise-rule'){
   const r=await match(db,'rules',required(f,'rule'));await db.query('select id from rules where id=$1 for update',[r.id]);const d=validate(jsonFile(f,'file'));
   const [{next}]=await db.query('select coalesce(max(version),0)+1 as next from rule_versions where rule_id=$1',[r.id]);
   const [v]=await db.query('insert into rule_versions(rule_id,version,definition,author,rationale) values($1,$2,$3,$4,$5) returning id,version,status',[r.id,next,JSON.stringify(d),actor,required(f,'reason')]);result={rule:r.name,...v};
  }else if(cmd==='add-case'){
   const r=await match(db,'rules',required(f,'rule'));await db.query('select id from rules where id=$1 for update',[r.id]);const c=jsonFile(f,'file');
   if(typeof c.name!=='string'||!c.name.trim()||!c.input||typeof c.input!=='object'||Array.isArray(c.input)||!Array.isArray(c.expected))throw Error('Case needs name, input object and expected output array');
   const [row]=await db.query('insert into test_cases(rule_id,name,input,expected,author) values($1,$2,$3,$4,$5) returning id,name',[r.id,c.name,JSON.stringify(c.input),JSON.stringify(c.expected),actor]);result=row;
  }else if(cmd==='test-rule'||cmd==='approve-rule'){
   const v=await version(db,f,true);const tests=await runTests(db,v);const passed=tests.length>=2&&tests.every(t=>t.passed);
   if(cmd==='approve-rule'){
    if(v.status!=='draft')throw Error('Only a draft version can be approved');if(v.author.trim().toLowerCase()===actor.toLowerCase())throw Error('Reviewer must differ from author');
    if(!passed)throw Error('Approval refused: need at least two passing cases');
    await db.query("update rule_versions set status='approved',approver=$2,approved_at=now() where id=$1",[v.id,actor]);
    await db.query('update rules set active_version_id=$2 where id=$1',[v.rule_id,v.id]);
   }
   await db.query('insert into test_runs(version_id,actor,passed,results) values($1,$2,$3,$4)',[v.id,actor,passed,JSON.stringify(tests)]);result={rule:v.name,version:v.version,passed,tests};
  }else if(cmd==='evaluate'){
   const v=await version(db,f,true);if(v.status!=='approved')throw Error('Only approved rules can evaluate recorded decisions');
   if(!['yes','no'].includes(f.personal))throw Error('Required: --personal=yes or --personal=no');const personal=f.personal==='yes';
   const accuracy=personal?date(required(f,'accuracy-checked')):null,retain=personal?date(required(f,'retain-until')):null;
   const today=new Date().toISOString().slice(0,10);if(personal&&(accuracy>today||retain<today))throw Error('Accuracy cannot be in the future and retention cannot already be expired');
   const input=jsonFile(f,'input'),answer=solve(v.definition,input);
   const [row]=await db.query('insert into decisions(version_id,reference,input,output,matches,actor,personal,accuracy_checked,retain_until) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id',[v.id,required(f,'reference'),JSON.stringify(input),JSON.stringify(answer.output),JSON.stringify(answer.matches),actor,personal,accuracy,retain]);result={...row,rule:v.name,version:v.version,...answer};
  }else if(cmd==='log-exception'){
   const r=await match(db,'rules',required(f,'rule'));[result]=await db.query('insert into exceptions(rule_id,summary,owner,due) values($1,$2,$3,$4) returning id,summary,due',[r.id,required(f,'summary'),required(f,'owner'),date(required(f,'due'))]);
  }else if(cmd==='resolve-exception'){
   const r=await match(db,'exceptions',required(f,'exception'));[result]=await db.query('update exceptions set resolved_at=now(),resolution=$2 where id=$1 and resolved_at is null returning id,resolution',[r.id,required(f,'resolution')]);if(!result)throw Error('Exception already resolved');
  }else if(cmd==='review-rule'){
   const r=await match(db,'rules',required(f,'rule'));required(f,'reason');const due=date(required(f,'review-due'));if(due<=new Date().toISOString().slice(0,10))throw Error('Next review must be in the future');
   [result]=await db.query('update rules set review_due=$2 where id=$1 returning id,name,review_due',[r.id,due]);
  }else if(cmd==='import'){
   if(pos[1]!=='decisionrules')throw Error('Supported import: decisionrules');const raw=jsonFile(f,'file'),d=convertDecisionRules(raw,f.strategy);
   await db.query("select pg_advisory_xact_lock(hashtext('decisionrules-import'))");
   const existing=await db.query('select id,source_export,definition from rule_versions where source_id=$1 and source_version=$2',[raw.ruleId,raw.version]);
   if(existing.length){if(!equal(existing[0].source_export,raw)||!equal(existing[0].definition,d))throw Error('Source version already imported with different content or strategy');result={id:existing[0].id,skipped:true};}
   else{
    const old=await db.query('select distinct rule_id from rule_versions where source_id=$1',[raw.ruleId]);let rid;
    if(old.length){rid=old[0].rule_id;await db.query('select id from rules where id=$1 for update',[rid]);}
    else {const [r]=await db.query('insert into rules(name,owner,purpose,review_due) values($1,$2,$3,$4) returning id',[raw.name,required(f,'owner'),raw.description||'Imported operational routing rule',date(required(f,'review-due'))]);rid=r.id;}
    const [{next}]=await db.query('select coalesce(max(version),0)+1 as next from rule_versions where rule_id=$1',[rid]);
    [result]=await db.query('insert into rule_versions(rule_id,version,definition,author,rationale,source_id,source_version,source_export) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,version,status',[rid,next,JSON.stringify(d),actor,'Imported: reconcile examples before approval',raw.ruleId,raw.version,JSON.stringify(raw)]);
   }
  }
  if(!result)throw Error('No result');
  await db.query('insert into audit_events(actor,action,subject) values($1,$2,$3)',[actor,cmd,String(result.id||result.rule||'batch')+(cmd==='review-rule'?': '+required(f,'reason'):'')]);
  await db.exec(f['dry-run']?'ROLLBACK':'COMMIT');return f['dry-run']?{dry_run:true,...result}:result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
function human(value){
 if(Array.isArray(value))return table(value.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v&&typeof v==='object'?JSON.stringify(v):v]))),Object.keys(value[0]||{}).map(key=>({key,label:key.replaceAll('_',' '),width:100})));
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}\n${typeof v==='object'?human(v):String(v)}`).join('\n\n');return String(value);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try {db=await getDb();const argv=process.argv.slice(2);const result=await dispatch(db,argv);console.log(argv.includes('--json')?JSON.stringify(result,null,2):human(result));if(argv[0]==='test-rule'&&!result.passed)process.exitCode=1;}
 catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
