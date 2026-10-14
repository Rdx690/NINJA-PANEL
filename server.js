'use strict';
const express=require('express'),session=require('express-session'),helmet=require('helmet'),path=require('path'),fs=require('fs'),crypto=require('crypto');
const app=express(),PORT=Number(process.env.PORT||3000);
const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||''),SECRET=String(process.env.SESSION_SECRET||'');
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data'),DB=path.join(DATA_DIR,'users.json');
if(ADMIN_PASSWORD.length<12)throw Error('ADMIN_PASSWORD must be at least 12 characters');
if(SECRET.length<32)throw Error('SESSION_SECRET must be at least 32 characters');
fs.mkdirSync(DATA_DIR,{recursive:true});
if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify({users:[]},null,2),{mode:0o600});
const readDB=()=>JSON.parse(fs.readFileSync(DB,'utf8'));
const writeDB=d=>fs.writeFileSync(DB,JSON.stringify(d,null,2),{mode:0o600});
const hash=(password,salt=crypto.randomBytes(16).toString('hex'))=>({salt,hash:crypto.scryptSync(password,salt,64).toString('hex')});
const verify=(password,record)=>{try{const a=crypto.scryptSync(password,record.salt,64),b=Buffer.from(record.hash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}catch{return false}};
const usernameOK=s=>typeof s==='string'&&/^[a-zA-Z0-9_.-]{3,24}$/.test(s);
app.disable('x-powered-by');app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'32kb'}));
app.use(session({name:'ninja.sid',secret:SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:8*60*60*1000}}));
const signedIn=(req,res,next)=>req.session?.user?next():res.status(401).json({error:'Login required'});
const adminOnly=(req,res,next)=>req.session?.user?.role==='admin'?next():res.status(403).json({error:'Admin access only'});
const publicUser=u=>({username:u.username,role:u.role,createdAt:u.createdAt,limits:u.limits||{ramMb:512,serverCount:1}});
function ensureAdmin(){const db=readDB();if(!db.users.some(u=>u.role==='admin')){const h=hash(ADMIN_PASSWORD);db.users.push({username:String(process.env.ADMIN_USERNAME||'admin'),...h,role:'admin',createdAt:new Date().toISOString(),limits:{ramMb:0,serverCount:0}});writeDB(db)}}
ensureAdmin();
app.get('/api/health',(_q,r)=>r.json({ok:true,name:'NINJA PANEL'}));
app.get('/api/me',(q,r)=>r.json({authenticated:!!q.session?.user,user:q.session?.user||null}));
app.post('/api/register',(q,r)=>{const username=String(q.body?.username||'').trim(),password=String(q.body?.password||'');if(!usernameOK(username))return r.status(400).json({error:'Username must be 3–24 letters, numbers, dot, dash or underscore.'});if(password.length<12)return r.status(400).json({error:'Password must be at least 12 characters.'});const db=readDB();if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return r.status(409).json({error:'Username already exists.'});const h=hash(password);db.users.push({username,...h,role:'user',createdAt:new Date().toISOString(),limits:{ramMb:512,serverCount:1}});writeDB(db);r.json({ok:true,message:'Account created. Sign in to continue.'})});
app.post('/api/login',(q,r,next)=>{const username=String(q.body?.username||'').trim(),password=String(q.body?.password||'');const db=readDB();let u=db.users.find(x=>x.username.toLowerCase()===username.toLowerCase());if(u? !verify(password,u):!verify(password,hash('dummy-password-just-for-timing')))return r.status(401).json({error:'Incorrect username or password'});reqLogin();function reqLogin(){q.session.regenerate(err=>{if(err)return next(err);q.session.user={username:u.username,role:u.role};q.session.save(err2=>err2?next(err2):r.json({ok:true,user:q.session.user}))})}});
app.post('/api/logout',signedIn,(q,r)=>q.session.destroy(()=>r.json({ok:true})));
app.get('/api/servers',signedIn,(q,r)=>r.json({servers:[],note:'Secure Docker runner not connected. No bot processes can run yet.'}));

// Personal API tokens: plaintext is shown once; only a SHA-256 digest is stored.
const tokenDigest=token=>crypto.createHash('sha256').update(token).digest('hex');
function ensureApiKeyStore(db){if(!Array.isArray(db.apiKeys))db.apiKeys=[];return db}
app.get('/api/account/api-keys',signedIn,(q,r)=>{const db=ensureApiKeyStore(readDB());r.json({keys:db.apiKeys.filter(k=>k.username===q.session.user.username&&!k.revokedAt).map(k=>({id:k.id,name:k.name,prefix:k.prefix,createdAt:k.createdAt,lastUsedAt:k.lastUsedAt||null}))})});
app.post('/api/account/api-keys',signedIn,(q,r)=>{const name=String(q.body?.name||'').trim();if(!name||name.length>48)return r.status(400).json({error:'Key name must be 1–48 characters.'});const db=ensureApiKeyStore(readDB());const own=db.apiKeys.filter(k=>k.username===q.session.user.username&&!k.revokedAt);if(own.length>=10)return r.status(429).json({error:'Maximum 10 active API keys.'});const token='ninja_'+crypto.randomBytes(32).toString('base64url');const item={id:crypto.randomUUID(),username:q.session.user.username,name,prefix:token.slice(0,10),digest:tokenDigest(token),createdAt:new Date().toISOString(),lastUsedAt:null,revokedAt:null};db.apiKeys.push(item);writeDB(db);r.status(201).json({key:{id:item.id,name:item.name,token,createdAt:item.createdAt},warning:'Copy this token now. It will not be shown again.'})});
app.delete('/api/account/api-keys/:id',signedIn,(q,r)=>{const db=ensureApiKeyStore(readDB()),item=db.apiKeys.find(k=>k.id===q.params.id&&k.username===q.session.user.username&&!k.revokedAt);if(!item)return r.status(404).json({error:'API key not found.'});item.revokedAt=new Date().toISOString();writeDB(db);r.json({ok:true})});
function apiTokenAuth(q,r,next){const auth=String(q.headers.authorization||'');if(!auth.startsWith('Bearer '))return r.status(401).json({error:'Send Authorization: Bearer <API_TOKEN>.'});const token=auth.slice(7).trim();if(!token.startsWith('ninja_'))return r.status(401).json({error:'Invalid API token.'});const db=ensureApiKeyStore(readDB()),digest=tokenDigest(token),item=db.apiKeys.find(k=>!k.revokedAt&&k.digest===digest);if(!item)return r.status(401).json({error:'Invalid or revoked API token.'});item.lastUsedAt=new Date().toISOString();writeDB(db);q.apiUser={username:item.username};next()}
app.get('/api/v1/me',apiTokenAuth,(q,r)=>{const db=readDB(),u=db.users.find(x=>x.username===q.apiUser.username);if(!u)return r.status(401).json({error:'API key owner no longer exists.'});r.json({username:u.username,role:u.role,limits:u.limits||{ramMb:512,serverCount:1},servers:[],note:'Execution API becomes available after a secured runner is connected.'})});
app.get('/api/admin/users',signedIn,adminOnly,(_q,r)=>r.json({users:readDB().users.map(publicUser)}));
app.post('/api/admin/users',signedIn,adminOnly,(q,r)=>{const username=String(q.body?.username||'').trim(),password=String(q.body?.password||''),role=q.body?.role==='admin'?'admin':'user';if(!usernameOK(username))return r.status(400).json({error:'Username must be 3–24 safe characters.'});if(password.length<12)return r.status(400).json({error:'Password must be at least 12 characters.'});const db=readDB();if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return r.status(409).json({error:'Username already exists.'});const h=hash(password);db.users.push({username,...h,role,createdAt:new Date().toISOString(),limits:role==='admin'?{ramMb:0,serverCount:0}:{ramMb:512,serverCount:1}});writeDB(db);r.json({ok:true,user:publicUser(db.users[db.users.length-1])})});
app.use(express.static(path.join(__dirname,'public')));app.get('*',(_q,r)=>r.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log('NINJA PANEL listening on '+PORT));
