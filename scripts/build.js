'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
// Explicit public allowlist: never publish backend, migrations, env, or Finance HTML.
for(const file of fs.readdirSync(root)) if(file.endsWith('.html') || file==='CNAME') fs.copyFileSync(path.join(root,file),path.join(out,file));
for(const dir of ['css','js','img','data','content']) fs.cpSync(path.join(root,dir),path.join(out,dir),{recursive:true});
fs.mkdirSync(path.join(out,'admin','cms'),{recursive:true});
fs.copyFileSync(path.join(root,'admin','index.html'),path.join(out,'admin','cms','index.html'));
for(const file of ['config.yml','form.html']) fs.copyFileSync(path.join(root,'admin',file),path.join(out,'admin',file));
console.log('Public site built; Finance HTML and server files excluded.');
