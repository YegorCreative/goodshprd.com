/* Calendar-only date ranges. No financial calculations or persisted state. */
(function(root){
 'use strict';
 function day(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);}
 function range(preset,now=new Date()) {
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());let end=new Date(start);
  if(preset==='custom')return null;
  if(preset==='week')start.setDate(start.getDate()-((start.getDay()+6)%7));
  else if(preset==='month')start.setDate(1);
  else if(preset==='last-month'){start.setMonth(start.getMonth()-1,1);end=new Date(now.getFullYear(),now.getMonth(),0);}
  else if(preset==='year')start.setMonth(0,1);
  else if(preset!=='today')throw Error('Unknown period');
  return {from:day(start),to:day(end)};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={range,day};else root.FinanceDates={range,day};
})(typeof globalThis!=='undefined'?globalThis:this);
