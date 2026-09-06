const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {execFileSync}=require('node:child_process');
test('public build preserves storefront/product admin and excludes private source',()=>{
 execFileSync(process.execPath,['scripts/build.js']);
 for(const file of ['index.html','shop.html','product.html','admin/cms/index.html','admin/form.html','admin/config.yml','data/products.json'])assert.ok(fs.existsSync('dist/'+file),file);
 for(const file of ['admin/index.html','admin/gateway.html','admin/finance/index.html','server','db','.env.example','api','node_modules'])assert.ok(!fs.existsSync('dist/'+file),file);
});
