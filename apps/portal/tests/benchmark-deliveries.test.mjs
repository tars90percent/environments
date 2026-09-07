import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({entryPoints:[new URL('../app/benchmark-deliveries.ts',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false});
const { benchmarkDeliveries } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const task = (id, direction, kind='task', format='harbor') => ({id,benchmark:{id:direction},kind,format});
test('delivery counts use exact direction and submission, include malformed tasks, exclude traces and inventory',()=>{
  const vendors = [{id:'v',name:'Vendor',interactions:[{eventType:'inventory_reported:tb'}],submissions:[
    {id:'later',date:'2026-09-04',label:'Mixed delivery',tasks:[task('a','tb'),task('b','tb','task','non_harbor'),task('c','tb','trace'),task('d','science')]},
    {id:'earlier',date:'2026-08-04',label:'Earlier delivery',tasks:[task('e','tb')]},
    {id:'same-day',date:'2026-09-04',label:'Another delivery',tasks:[task('f','tb')]},
  ]},{id:'stock-only',name:'Stock only',interactions:[{eventType:'inventory_reported:tb'}],submissions:[]}];
  const entries = benchmarkDeliveries(vendors,'tb');
  assert.deepEqual(entries.map(x=>[x.submissionId,x.taskCount,x.harborCount]),[['earlier',1,1],['later',2,1],['same-day',1,1]]);
  assert.equal(benchmarkDeliveries(vendors,'science')[0].taskCount,1);
  assert.deepEqual(benchmarkDeliveries(vendors,'unknown'),[]);
  assert.equal(vendors[0].submissions[0].id,'later');
});
