const {vercel}=require('../server/adapters'); module.exports=vercel(); module.exports.config={api:{bodyParser:false}};
