import { isDeepStrictEqual } from 'node:util';
export const equal = isDeepStrictEqual;
const object = x => x !== null && typeof x==='object' && !Array.isArray(x);
const fieldOK = x => typeof x==='string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(x) && !['constructor','prototype','__proto__'].includes(x);
export function validate(d) {
 if(!object(d)||!object(d.inputs)||!Object.keys(d.inputs).length) throw Error('inputs must declare at least one field');
 if(!['first','all'].includes(d.strategy)) throw Error('strategy must be first or all');
 for(const [f,t] of Object.entries(d.inputs)) if(!fieldOK(f)||!['string','number','boolean'].includes(t)) throw Error('Invalid input field or type');
 if(!Array.isArray(d.rows)||!d.rows.length) throw Error('rows must be a non-empty array');
 if(d.rows.length>10000) throw Error('Limit: 10000 rows per rule');
 for(const [i,r] of d.rows.entries()) {
  if(!object(r)||!Array.isArray(r.conditions)||!object(r.output)||!Object.keys(r.output).length) throw Error(`Row ${i+1}: conditions and output required`);
  for(const [k,v] of Object.entries(r.output)) if(!fieldOK(k)||!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)) throw Error(`Row ${i+1}: only flat scalar outputs supported`);
  for(const c of r.conditions) {
   if(!object(c)||!Object.hasOwn(d.inputs,c.field)||!['eq','ne','gt','gte','lt','lte','in','not-in'].includes(c.op)) throw Error(`Row ${i+1}: invalid condition`);
   const vals=['in','not-in'].includes(c.op)?c.value:[c.value];
   if(!Array.isArray(vals)||!vals.length||vals.some(v=>typeof v!==d.inputs[c.field]||typeof v==='number'&&!Number.isFinite(v))) throw Error(`Row ${i+1}: condition type mismatch`);
   if(['gt','gte','lt','lte'].includes(c.op)&&d.inputs[c.field]!=='number') throw Error('Ordered comparisons need numbers');
  }
 }
 return d;
}
export function solve(d,input) {
 validate(d);
 if(!object(input)) throw Error('Input must be an object');
 for(const [f,t] of Object.entries(d.inputs)) if(!Object.hasOwn(input,f)||typeof input[f]!==t||t==='number'&&!Number.isFinite(input[f])) throw Error(`Input ${f} must be ${t}`);
 for(const f of Object.keys(input)) if(!Object.hasOwn(d.inputs,f)) throw Error(`Unexpected input ${f}`);
 const output=[],matches=[],trace=[];
 for(const [i,r] of d.rows.entries()) {
  const checks=r.conditions.map(c=>{const v=input[c.field]; return ({eq:()=>v===c.value,ne:()=>v!==c.value,gt:()=>v>c.value,gte:()=>v>=c.value,lt:()=>v<c.value,lte:()=>v<=c.value,in:()=>c.value.includes(v),'not-in':()=>!c.value.includes(v)})[c.op]();});
  const match=checks.every(Boolean); trace.push({row:i+1,checks,match});
  if(match){output.push(r.output);matches.push(i+1);if(d.strategy==='first')break;}
 }
 return {output,matches,trace};
}
// The official Management API documents columns + rows/cells. Keep source verbatim.
// Deliberately reject functions, variables, flows, nested models and inactive rows.
function literalText(value) {
 // Restrict import to unambiguous text, since the vendor casts numbers, dates,
 // arrays and boolean-like strings. Complex cells must be mapped with examples.
 return typeof value==='string' && /^[A-Za-z][A-Za-z0-9 _.,/\-]*$/.test(value) && !/^(true|false|null|undefined|nan|infinity)$/i.test(value);
}
export function convertDecisionRules(raw,strategy) {
 if(raw.type!=='decision-table'||!raw.ruleId||!Number.isInteger(raw.version)||raw.version<1||!raw.name) throw Error('Expected one DecisionRules decision-table export with ruleId, version and name');
 if(!['first','all'].includes(strategy)) throw Error('Specify --strategy=first or --strategy=all to match your Solver strategy');
 if(raw.userVariables?.some(v=>v.name)||raw.ruleVariables?.length) throw Error('Rule variables need manual mapping');
 const cols=raw.decisionTable?.columns, rows=raw.decisionTable?.rows;
 if(!Array.isArray(cols)||!cols.length||!Array.isArray(rows)||!rows.length) throw Error('Missing decisionTable columns or rows');
 const inputs={}, outputs=new Set(), byId=new Map();
 for(const c of cols){
  if(!c.columnId||byId.has(c.columnId))throw Error('Duplicate or missing column id');
  byId.set(c.columnId,c);
  if(c.type==='input'){
   const f=c.condition?.inputVariable;
   if(c.condition?.type!=='simple'||!fieldOK(f)||Object.hasOwn(inputs,f))throw Error('Only unique flat simple input columns supported');
   inputs[f]='string';
  }else if(c.type==='output'){
   const f=c.columnOutput?.outputVariable;
   if(c.columnOutput?.type!=='simple'||!fieldOK(f)||outputs.has(f))throw Error('Only unique flat simple output columns supported');
   outputs.add(f);
  }else throw Error(`Unsupported column type: ${c.type}`);
 }
 const result=[];
 for(const [i,r] of rows.entries()){
  if(r.active!==true)throw Error(`Row ${i+1}: inactive or unspecified row needs manual mapping`);
  if(!Array.isArray(r.cells)||r.cells.length!==cols.length)throw Error(`Row ${i+1}: incomplete cells`);
  const seen=new Set(), conditions=[], output={};
  for(const cell of r.cells){
   const c=byId.get(cell.column);if(!c||seen.has(cell.column)||cell.type!==c.type)throw Error('Duplicate, unknown or mismatched cell');seen.add(cell.column);
   if(c.type==='input'){
    const sc=cell.scalarCondition;
    const op={'=':'eq','<>':'ne'}[sc?.operator];
    if(!op||sc.type!=='general'||!literalText(sc.value))throw Error(`Row ${i+1}: only literal text = and <> imports supported; map numeric, wildcard, function or variable conditions explicitly`);
    conditions.push({field:c.condition.inputVariable,op,value:sc.value});
   }else{
    const s=cell.outputScalarValue;
    if(s?.type!=='common'||!literalText(s.value))throw Error(`Row ${i+1}: only literal text output imports supported`);
    output[c.columnOutput.outputVariable]=s.value;
   }
  }
  result.push({conditions,output});
 }
 return validate({inputs,strategy,rows:result});
}
