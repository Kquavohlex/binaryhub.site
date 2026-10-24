const $ = (id) => document.getElementById(id);
let authMode = 'login', currentUser = null, pendingTrade = null;
const money = n => 'KSh ' + Number(n || 0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
async function api(url, options={}) {
  const res = await fetch(url, { credentials:'same-origin', headers:{'Content-Type':'application/json',...(options.headers||{})}, ...options });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function message(id, text, bad=false){ $(id).textContent=text; $(id).style.color=bad?'#ff657b':'#21d6a1'; }
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
  authMode=b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
  $('nameLabel').classList.toggle('hidden',authMode!=='register');
  $('authSubmit').textContent=authMode==='login'?'Sign in':'Create account';
  $('authForm').elements.password.autocomplete=authMode==='login'?'current-password':'new-password';
  message('authMessage','');
}));
$('authForm').addEventListener('submit',async e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const body={email:f.get('email'),password:f.get('password')};
  if(authMode==='register') body.displayName=f.get('displayName');
  try{
    const d=await api('/api/auth/'+(authMode==='login'?'login':'register'),{method:'POST',body:JSON.stringify(body)});
    currentUser=d.user; await showApp();
  }catch(err){message('authMessage',err.message,true);}
});
async function showApp(){
  $('authPanel').classList.add('hidden');$('appPanel').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');
  $('userName').textContent=currentUser.display_name||currentUser.displayName||currentUser.email;
  await Promise.all([refreshWallet(),refreshTrades(),checkMpesa()]);
  drawChart();
}
$('logoutBtn').addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});currentUser=null;$('appPanel').classList.add('hidden');$('authPanel').classList.remove('hidden');$('logoutBtn').classList.add('hidden');});
async function refreshWallet(){const d=await api('/api/wallet/');$('balance').textContent=money(d.wallet.balance);}
$('topupBtn').addEventListener('click',async()=>{const raw=prompt('Add virtual demo funds (100–5,000). No money will be charged.','1000');if(raw===null)return;try{const d=await api('/api/wallet/demo-credit',{method:'POST',body:JSON.stringify({amount:Number(raw)})});$('balance').textContent=money(d.balance);message('tradeMessage',d.message);}catch(e){message('tradeMessage',e.message,true);}});
document.querySelectorAll('[data-stake]').forEach(b=>b.addEventListener('click',()=>$('stake').value=b.dataset.stake));
async function placeTrade(direction){
  try{
    message('tradeMessage','Submitting demo trade…');
    const d=await api('/api/trades/',{method:'POST',body:JSON.stringify({asset:$('asset').value,direction,stake:Number($('stake').value),durationSeconds:Number($('duration').value)})});
    pendingTrade=d.trade; $('balance').textContent=money(d.balance);
    message('tradeMessage',`${direction.toUpperCase()} trade opened. Waiting ${d.trade.duration_seconds}s to settle…`);
    setTimeout(()=>settleTrade(d.trade.id),Number(d.trade.duration_seconds)*1000+250);
    await refreshTrades();
  }catch(e){message('tradeMessage',e.message,true);}
}
$('upBtn').addEventListener('click',()=>placeTrade('up'));$('downBtn').addEventListener('click',()=>placeTrade('down'));
async function settleTrade(id){
  try{const d=await api(`/api/trades/${id}/settle`,{method:'POST',body:'{}'});message('tradeMessage',`Trade settled: ${d.trade.result.toUpperCase()}. Virtual payout: ${money(d.trade.payout)}.`);$('balance').textContent=money(d.balance);await refreshTrades();}
  catch(e){message('tradeMessage',e.message,true);}
}
async function refreshTrades(){
  const d=await api('/api/trades/');const body=$('tradeRows');
  if(!d.trades.length){body.innerHTML='<tr><td colspan="6" class="muted">No trades yet. Open a demo trade to begin.</td></tr>';return;}
  body.innerHTML=d.trades.map(t=>`<tr><td>${escapeHtml(t.asset)}</td><td>${t.direction==='up'?'↗ UP':'↘ DOWN'}</td><td>${money(t.stake)}</td><td class="${t.result==='win'?'result-win':t.result==='loss'?'result-loss':''}">${t.result.toUpperCase()}</td><td>${money(t.payout)}</td><td>${new Date(t.created_at).toLocaleString()}</td></tr>`).join('');
}
$('refreshBtn').addEventListener('click',()=>refreshTrades().catch(e=>message('tradeMessage',e.message,true)));
$('asset').addEventListener('change',()=>{$('assetLabel').textContent=$('asset').value;drawChart();});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function checkMpesa(){try{const d=await api('/api/mpesa/status');$('mpesaStatus').textContent=d.enabled?'Enabled flag set, but transaction endpoints are still a scaffold. Do not use for live payments.':'Disabled. Daraja credentials and verified callbacks have not been configured.';}catch{$('mpesaStatus').textContent='M-Pesa status unavailable.';}}
function drawChart(){
 const c=$('chart'),ctx=c.getContext('2d'),rect=c.getBoundingClientRect(),scale=window.devicePixelRatio||1;
 c.width=rect.width*scale;c.height=rect.height*scale;ctx.scale(scale,scale);
 const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);
 ctx.strokeStyle='#233149';ctx.lineWidth=1;
 for(let y=20;y<h;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 for(let x=20;x<w;x+=65){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
 let vals=[],v=h*.58;for(let i=0;i<70;i++){v+= (Math.random()-.47)*10;v=Math.max(25,Math.min(h-35,v));vals.push(v);}
 ctx.beginPath();vals.forEach((y,i)=>i?ctx.lineTo(i*w/(vals.length-1),y):ctx.moveTo(0,y));ctx.strokeStyle='#21d6a1';ctx.lineWidth=2;ctx.stroke();
 ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#21d6a133');grad.addColorStop(1,'#21d6a100');ctx.fillStyle=grad;ctx.fill();
 $('price').textContent=({ 'EUR/USD':'1.08425','GBP/USD':'1.27190','USD/JPY':'149.820','BTC/USD':'67250.00','ETH/USD':'3520.00'})[$('asset').value];
}
window.addEventListener('resize',()=>{if(!$('appPanel').classList.contains('hidden'))drawChart();});
(async()=>{try{const d=await api('/api/auth/me');currentUser=d.user;await showApp();}catch{/* signed out */}})();
