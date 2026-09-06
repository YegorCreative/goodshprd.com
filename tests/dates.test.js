const {test}=require('node:test');const assert=require('node:assert/strict');const {range}=require('../js/admin/finance-dates');
test('date presets use local calendar days, Monday weeks, and equivalent month boundaries',()=>{
 const date=new Date(2026,0,4,12);
 assert.deepEqual(range('today',date),{from:'2026-01-04',to:'2026-01-04'});
 assert.deepEqual(range('week',date),{from:'2025-12-29',to:'2026-01-04'});
 assert.deepEqual(range('month',date),{from:'2026-01-01',to:'2026-01-04'});
 assert.deepEqual(range('last-month',date),{from:'2025-12-01',to:'2025-12-31'});
 assert.deepEqual(range('year',date),{from:'2026-01-01',to:'2026-01-04'});
 assert.deepEqual(range('last-month',new Date(2024,2,31,12)),{from:'2024-02-01',to:'2024-02-29'});
 assert.equal(range('custom',date),null);
});
