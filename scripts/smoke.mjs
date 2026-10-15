import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { dispatch, commands, readCommands } from './rules.mjs';
import { validate, solve, convertDecisionRules } from './lib/engine.mjs';
import { page, table } from './lib/render.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'business-rules-test-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
const covered=new Set();let checks=0,db;
const fixture=n=>path.join(REPO_ROOT,'fixtures',n);
const tempJSON=(n,x)=>{const f=path.join(tmp,n);fs.writeFileSync(f,JSON.stringify(x));return f;};
const actor='--actor=Test operator';
const cli=async(cmd,...a)=>{covered.add(cmd);checks++;return dispatch(db,[cmd,...a]);};
const refuse=async(cmd,a,pattern)=>{checks++;await assert.rejects(()=>cli(cmd,...a),pattern);};
const count=async(t)=>(await db.query(`select count(*)::int n from ${t}`))[0].n;
function child(script,a=[],expected=0){const r=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script),...a],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(r.status,expected,`${script}: ${r.stdout}\n${r.stderr}`);checks++;return r;}
try{
 db=await getDb();assert.equal((await db.query("select tablename from pg_tables where schemaname='public'")).length,0,'Tests require an empty database');assert.equal((await migrate(db)).ran.length,1);assert.equal((await migrate(db)).ran.length,0);checks+=2;
 const seed=fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8');await db.exec(seed);await db.exec(seed);
 assert.equal(await count('rules'),3);assert.equal(await count('test_cases'),9);assert.equal(await count('decisions'),3);checks+=3;
 // Real engine semantics: type checks, boundaries, overlapping rows and row order.
 const d={inputs:{weight:'number',region:'string',urgent:'boolean'},strategy:'all',rows:[{conditions:[{field:'weight',op:'gte',value:10},{field:'region',op:'in',value:['NZ','AU']}],output:{queue:'freight'}},{conditions:[{field:'urgent',op:'eq',value:true}],output:{queue:'priority'}}]};
 assert.deepEqual(solve(d,{weight:10,region:'NZ',urgent:true}).output,[{queue:'freight'},{queue:'priority'}]);
 assert.deepEqual(solve({...d,strategy:'first'},{weight:10,region:'NZ',urgent:true}).matches,[1]);
 assert.deepEqual(solve(d,{weight:9,region:'NZ',urgent:false}).output,[]);
 for(const op of ['eq','ne','gt','gte','lt','lte','in','not-in']){
  const value=['in','not-in'].includes(op)?[10]:10;
  const def={inputs:{n:'number'},strategy:'first',rows:[{conditions:[{field:'n',op,value}],output:{yes:true}}]};
  const expect=['eq','gte','lte','in'].includes(op);assert.equal(solve(def,{n:10}).matches.length,expect?1:0);checks++;
 }
 assert.throws(()=>solve(d,{weight:'10',region:'NZ',urgent:true}),/must be number/);
 assert.throws(()=>solve(d,{weight:10,region:'NZ',urgent:true,extra:1}),/Unexpected/);
 assert.throws(()=>solve(d,{weight:10,region:'NZ'}),/must be boolean/);
 assert.throws(()=>validate({...d,strategy:'execute'}),/strategy/);checks+=7;
 for(const cmd of readCommands){if(cmd==='rule')continue;const result=await cli(cmd);assert(result);}
 assert.equal((await cli('rules')).length,3);
 assert.equal((await cli('rule','--rule=ORDER ROUTING')).versions.length,2);
 assert.equal((await cli('rule','--rule=00000000-0000-4000-8000-000000000003')).register[0].name,'Returns routing');
 await refuse('rule',['--rule=routing'],/Ambiguous.*Order routing.*Returns routing/);
 await refuse('rule',['--rule=does not exist'],/No match.*Candidates/);
 const c=await cli('compliance');for(const r of ['REVIEW_DUE','EXCEPTION_OVERDUE','RETENTION_REVIEW','ACCURACY_REVIEW'])assert(c.some(x=>x.rule===r));checks+=4;
 const sim=await cli('simulate','--rule=Order routing','--version=2',`--input=${fixture('input.json')}`);assert.equal(sim.output[0].queue,'Wellington dispatch');
 const failed=await cli('test-rule','--rule=Order routing','--version=2',actor);assert.equal(failed.passed,false);
 const passed=await cli('test-rule','--rule=Order routing','--version=1',actor);assert.equal(passed.passed,true);
 await refuse('approve-rule',['--rule=Order routing','--version=2',actor],/Approval refused/);
 const before=await count('decisions');const dry=await cli('evaluate','--rule=Order routing',`--input=${fixture('input.json')}`,'--reference=TEST-1','--personal=no',actor,'--dry-run');assert(dry.dry_run);assert.equal(await count('decisions'),before);
 const ev=await cli('evaluate','--rule=Order routing',`--input=${fixture('input.json')}`,'--reference=TEST-2','--personal=no',actor);assert.deepEqual(ev.matches,[1]);assert.equal(await count('decisions'),before+1);
 await refuse('evaluate',['--rule=Order routing','--version=2',`--input=${fixture('input.json')}`,'--reference=X','--personal=no',actor],/approved/);
 await refuse('evaluate',['--rule=Order routing',`--input=${fixture('input.json')}`,'--reference=X',actor],/personal/);
 await refuse('evaluate',['--rule=Order routing',`--input=${fixture('input.json')}`,'--reference=X','--personal=yes',actor],/accuracy-checked/);
 await refuse('evaluate',['--rule=Order routing',`--input=${fixture('input.json')}`,'--reference=X','--personal=yes','--accuracy-checked=2026-01-01','--retain-until=2000-01-01',actor],/expired/);
 await refuse('evaluate',['--dryrun'],/Unknown flag/);
 await refuse('evaluate',['--dry-run=false'],/without a value/);
 const newArgs=['--name=Test dispatch','--owner=Tester','--purpose=Operational routing','--review-due=2099-01-01',`--file=${fixture('routing.json')}`,actor];
 const ruleBefore=await count('rules');await cli('add-rule',...newArgs,'--dry-run');assert.equal(await count('rules'),ruleBefore);
 const added=await cli('add-rule',...newArgs);assert.equal(added.status,'draft');
 await refuse('add-rule',newArgs,/unique/);
 await refuse('add-rule',newArgs.filter(x=>!x.startsWith('--actor')),/actor/);
 await refuse('add-rule',newArgs.map(x=>x.startsWith('--review-due')?'--review-due=2026-02-30':x),/valid/);
 await cli('add-case','--rule=Test dispatch',`--file=${fixture('case.json')}`,actor);
 const case2=tempJSON('case2.json',{name:'Unknown region',input:{region:'FJ'},expected:[]});await cli('add-case','--rule=Test dispatch',`--file=${case2}`,actor);
 await refuse('approve-rule',['--rule=Test dispatch','--version=1',actor],/differ/);
 const approved=await cli('approve-rule','--rule=Test dispatch','--version=1','--actor=Separate reviewer');assert.equal(approved.passed,true);
 const revision=await cli('revise-rule','--rule=Test dispatch',`--file=${fixture('routing.json')}`,'--reason=Reconfirm warehouse',actor);assert.equal(revision.version,2);
 await cli('approve-rule','--rule=Test dispatch','--version=2','--actor=Separate reviewer');
 assert.equal((await cli('rule','--rule=Test dispatch')).register[0].active_version,2);
 await assert.rejects(()=>db.query("update rule_versions set definition='{}' where id=$1",[added.id]),/immutable/);checks++;
 const ex=await cli('log-exception','--rule=Test dispatch','--summary=Unmapped island','--owner=Tester','--due=2026-01-01',actor);
 await cli('resolve-exception',`--exception=${ex.id.slice(0,8)}`,'--resolution=Assign manual review',actor);
 await refuse('resolve-exception',[`--exception=${ex.id}`,'--resolution=Again',actor],/already resolved/);
 await cli('review-rule','--rule=Test dispatch','--review-due=2099-02-01','--reason=Reviewed samples',actor);
 // Import round-trip identity, atomic rejection, raw source preservation and explicit strategy.
 const raw=JSON.parse(fs.readFileSync(fixture('decisionrules.json'),'utf8'));
 const imported=convertDecisionRules(raw,'all');assert.equal(solve(imported,{region:'NZ'}).output[0].queue,'Auckland dispatch');
 const importArgs=['decisionrules',`--file=${fixture('decisionrules.json')}`,'--strategy=first','--owner=Import owner','--review-due=2099-01-01',actor];
 const nb=await count('rules');await cli('import',...importArgs,'--dry-run');assert.equal(await count('rules'),nb);
 const imp=await cli('import',...importArgs);assert.equal(imp.status,'draft');assert.equal((await cli('import',...importArgs)).skipped,true);assert.equal(await count('rules'),nb+1);
 const [stored]=await db.query('select source_export from rule_versions where id=$1',[imp.id]);assert.deepEqual(stored.source_export,raw);
 await refuse('import',importArgs.map(x=>x==='--strategy=first'?'--strategy=all':x),/different content or strategy/);
 for(const mutate of [x=>x.type='script',x=>x.userVariables=[{name:'Discount'}],x=>x.decisionTable.rows[0].cells[0].scalarCondition.operator='>',x=>x.decisionTable.rows[0].active=false,x=>x.decisionTable.rows[0].cells[1].outputScalarValue.type='function',x=>x.decisionTable.rows[0].cells[0].scalarCondition.value='12',x=>x.decisionTable.rows[0].cells.pop(),x=>x.decisionTable.rows[0].cells[1].outputScalarValue.value='[1,2]',x=>x.decisionTable.rows[0].cells[0].scalarCondition.value='2026-10-15',x=>x.decisionTable.rows[0].cells[1].outputScalarValue.value='1e3']){
  const bad=structuredClone(raw);bad.ruleId='bad-'+checks;bad.name='Bad import '+checks;mutate(bad);const badPath=tempJSON('bad.json',bad),n=await count('rules');await refuse('import',importArgs.map(x=>x.startsWith('--file=')?`--file=${badPath}`:x),/Expected|manual|literal|incomplete/);assert.equal(await count('rules'),n);
 }
 const next=structuredClone(raw);next.version=2;const nextPath=tempJSON('next.json',next);assert.equal((await cli('import',...importArgs.map(x=>x.startsWith('--file=')?`--file=${nextPath}`:x))).version,2);
 const different=structuredClone(raw);different.name='Changed source';const differentPath=tempJSON('different.json',different);await refuse('import',importArgs.map(x=>x.startsWith('--file=')?`--file=${differentPath}`:x),/different content/);
 const draft=await cli('draft-review','--rule=Order routing');assert(fs.readFileSync(draft.file,'utf8').includes('Nothing sent'));
 const archive=path.join(tmp,'archive.json');const exp=await cli('export',`--out=${archive}`);assert.equal(exp.counts.rules,5);const snapshot=JSON.parse(fs.readFileSync(archive));assert.deepEqual(snapshot.rule_versions.find(v=>v.id===imp.id).source_export,raw);
 await refuse('export',[`--out=${archive}`],/EEXIST/);
 assert((await cli('help')).commands.includes('approve-rule'));
 assert.equal((await db.query('select relname from pg_class where relname=any($1::text[]) and relrowsecurity',[['rules','rule_versions','test_cases','test_runs','decisions','exceptions','audit_events']])).length,7);
 await assert.rejects(()=>db.query("update audit_events set actor='other'"),/Append-only/);checks++;
 assert(!page({title:'<script>alert(1)</script>',sections:[{title:'x',html:table([{name:'<img onerror=alert(1)>'}])}]}).includes('<script>'));
 assert.deepEqual([...covered].sort(),commands.slice().sort());
 await db.close();db=null;
 child('rules.mjs',['rules','--json']);child('rules.mjs',['rule','--rule=routing'],1);
 const failedCLI=child('rules.mjs',['test-rule','--rule=Order routing','--version=2',actor,'--json'],1);assert.equal(JSON.parse(failedCLI.stdout).passed,false);
 child('seed.mjs');child('migrate.mjs');child('view.mjs');child('docs.mjs');
 assert.equal(fs.readdirSync(path.join(tmp,'views')).length,3);
 assert.equal(fs.readdirSync(path.join(tmp,'docs-out/rule-card')).length,5);
 assert(fs.readFileSync(path.join(tmp,'views/week.html'),'utf8').includes('Rule review desk'));
 assert(fs.readFileSync(path.join(REPO_ROOT,'README.md'),'utf8').includes('Your first hour: ten things to ask for'));
 const slash=fs.readdirSync(path.join(REPO_ROOT,'.claude/commands')).filter(x=>x.endsWith('.md')&&x!=='README.md');assert.equal(slash.length,25);
 console.log(`PASS: ${checks} checked operations; ${covered.size} CLI commands; ${slash.length} slash commands; migration, import, rule lifecycle, rollback, documents and views.`);
}finally{if(db)await db.close();fs.rmSync(tmp,{recursive:true,force:true});}
