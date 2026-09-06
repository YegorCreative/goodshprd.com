'use strict';
// Reuse the catalog actually consumed by the storefront. Do not import the disconnected CMS catalog.
const catalog = require('../data/products.json');
function products() {
 return catalog.map(p => {
  const value=String(p.price);
  if(!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Invalid catalog price');
  const [whole,decimal='']=value.split('.');
  return {id:p.id,name:p.name,unit_price:String(BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'))),currency:'USD',unit_cost:null,available:p.available};
 });
}
async function productsWithCosts(db) {
 const list=products();
 if(!db) return list;
 const rows=(await db.query('SELECT product_id,unit_cost,currency,notes,updated_at FROM product_costs')).rows;
 const costs=new Map(rows.map(r=>[r.product_id,r]));
 return list.map(p=>({...p,...(costs.has(p.id)?{unit_cost:String(costs.get(p.id).unit_cost),cost_currency:costs.get(p.id).currency,cost_notes:costs.get(p.id).notes}: {})}));
}
module.exports={products,productsWithCosts};
