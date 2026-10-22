/* Business Empire v0.5 | all shares, cash, property and stock prices are fictional. */
const businessDefs = [
  ['Lemonade Stand','🍋',500,5,'Starter'],['Food Truck','🚚',1400,14,'Starter'],
  ['Coffee Shop','☕',2500,25,'Starter'],['Car Wash','🚗',6500,65,'Local'],
  ['Pizza Restaurant','🍕',12000,120,'Local'],['Gym','🏋️',28000,280,'Local'],
  ['Clothing Store','👕',42000,420,'Local'],['Tech Startup','💻',65000,650,'Growing'],
  ['Hotel','🏨',180000,1800,'Growing'],['Shopping Mall','🏬',350000,3500,'Growing'],
  ['Car Dealership','🏎️',750000,7500,'Big Business'],['Factory','🏭',2000000,20000,'Big Business'],
  ['Airline','✈️',10000000,100000,'Empire'],['Bank','🏦',50000000,500000,'Empire'],
  ['Space Company','🚀',250000000,2500000,'Legendary']
].map(([name,icon,cost,profit,tier])=>({name,icon,cost,profit,tier}));
const stockDefs = [
  ['PixelTech','PXL',120,'Technology'],['GreenEnergy','GRN',65,'Renewables'],
  ['MegaRetail','MRT',240,'Retail'],['NovaAI','NVA',38,'Artificial intelligence'],
  ['MediSphere','MDS',87,'Healthcare'],['CloudMatrix','CMT',310,'Cloud computing'],
  ['OrbitalWorks','ORB',420,'Space'],['FreshFoods','FST',22,'Food'],
  ['ArcadiaGames','ARC',175,'Gaming'],['AquaGrid','AQR',54,'Water and utilities']
].map(([name,symbol,price,sector])=>({name,symbol,price,sector}));
const propertyDefs=[
  ['Small Apartment','🏠',20000,90],['Office Building','🏢',250000,1300],
  ['Luxury Tower','🌆',3000000,17000],['Resort Island','🏝️',45000000,260000]
].map(([name,icon,cost,rent])=>({name,icon,cost,rent}));
const GOAL=1_000_000_000;
const SOLO_KEY='business-empire-v05-solo';
const olderKeys=['business-empire-v04','business-empire-v03','business-empire-v02','business-empire-v01'];
const $=id=>document.getElementById(id);
const money=n=>'$'+Math.floor(Math.max(0,n)).toLocaleString('en-CA');
const signedMoney=n=>(n<0?'−':'')+money(Math.abs(n));
const count=n=>Math.floor(n).toLocaleString('en-CA');
const safe=(x,fallback=0)=>Number.isFinite(Number(x))?Math.max(0,Number(x)):fallback;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({cash:10000,levels:businessDefs.map(()=>0),staff:0,debt:0,stocks:stockDefs.map(()=>0),prices:stockDefs.map(s=>s.price),properties:propertyDefs.map(()=>0),history:stockDefs.map(s=>[s.price]),marketTick:0,elapsed:0,won:false});
function normalize(s){
  if(!s||!Array.isArray(s.levels))return fresh();
  const next=fresh();
  next.cash=safe(s.cash,10000);next.debt=safe(s.debt);next.staff=Math.min(5000,Math.floor(safe(s.staff)));
  next.elapsed=safe(s.elapsed);next.marketTick=safe(s.marketTick)%10;next.won=!!s.won;
  next.levels=businessDefs.map((_,i)=>Math.min(120,Math.floor(safe(s.levels?.[i]))));
  next.stocks=stockDefs.map((_,i)=>Math.min(1e15,Math.floor(safe(s.stocks?.[i]))));
  next.prices=stockDefs.map((d,i)=>Math.max(1,Math.round(safe(s.prices?.[i],d.price))));
  next.properties=propertyDefs.map((_,i)=>Math.min(1e8,Math.floor(safe(s.properties?.[i]))));
  next.history=stockDefs.map((_,i)=>Array.isArray(s.history?.[i]) ? s.history[i].filter(p=>Number.isFinite(p)&&p>0).slice(-60) : [next.prices[i]]);
  return next;
}
function readStore(key){try{let raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
function persist(){try{localStorage.setItem(activeKey,JSON.stringify(state))}catch{}}
function loadSolo(){let source=readStore(SOLO_KEY);if(!source){for(const k of olderKeys){source=readStore(k);if(source)break}}return normalize(source)}
let activeKey=SOLO_KEY;
let state=loadSolo();
let currentTab='businesses';
let selectedStock=0;
let marketRoom=null;
let room=null;
let remotePlayers=[];
let unsubscribePlayers=null;
let firebase=null;
let firebaseLoading=null;
let authUser=null;
let db=null;
let lastFrame=Date.now();
let syncTimer=null;
let syncBusy=false;
let toastTimer=null;
const multiplayerConfigured=()=>{const c=window.BUSINESS_EMPIRE_FIREBASE_CONFIG||{};return Boolean(c.apiKey&&!c.apiKey.includes('PASTE')&&c.projectId&&!c.projectId.includes('PASTE')&&c.appId&&!c.appId.includes('PASTE'))};
function announce(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3900)}
function staffBoost(){return 1+state.staff*.08}
function businessRevenue(){return businessDefs.reduce((s,b,i)=>s+b.profit*state.levels[i]*(state.levels[i]?Math.pow(1.22,state.levels[i]-1):1),0)*staffBoost()}
function rentRevenue(){return propertyDefs.reduce((s,p,i)=>s+p.rent*state.properties[i],0)}
function gross(){return businessRevenue()+rentRevenue()}
function wages(){return state.staff*35}
function interest(){return state.debt*.000025}
function income(){return gross()-wages()-interest()}
function priceToBuy(i){return Math.ceil(businessDefs[i].cost*Math.pow(1.7,state.levels[i]))}
function businessValue(){return businessDefs.reduce((s,b,i)=>{let n=state.levels[i];return s+b.cost*(Math.pow(1.7,n)-1)/.7},0)}
function propertyValue(){return propertyDefs.reduce((s,p,i)=>s+p.cost*state.properties[i],0)}
function portfolio(){return state.stocks.reduce((s,n,i)=>s+n*state.prices[i],0)}
function netWorth(){return state.cash+businessValue()+propertyValue()+portfolio()-state.debt}
function commit(message){persist();if(message)announce(message);render(true);queueSync()}
function purchase(i){const cost=priceToBuy(i);if(state.cash+1e-7<cost)return announce('Not enough cash for that business.');state.cash-=cost;state.levels[i]++;commit(`Bought ${businessDefs[i].name}, level ${state.levels[i]}!`)}
function propertyBuy(i){const p=propertyDefs[i];if(state.cash<p.cost)return announce('Not enough cash for this property.');state.cash-=p.cost;state.properties[i]++;commit(`Purchased ${p.name}!`)}
function hire(){let c=1000+state.staff*500;if(state.cash<c)return announce('Not enough cash to hire.');state.cash-=c;state.staff++;commit('Hired an employee. Business revenue is boosted!')}
function fire(){if(state.staff<=0)return;state.staff--;commit('Employee dismissed. Wages are lower now.')}
function borrow(){let limit=100000+businessValue()*.5;if(state.debt+10000>limit)return announce('Borrowing limit reached.');state.cash+=10000;state.debt+=10000;commit('Borrowed $10,000. Interest is charged each second.')}
function repay(){let n=Math.min(10000,state.debt,state.cash);if(n<=0)return announce('No debt or cash to repay.');state.cash-=n;state.debt-=n;commit(`Repaid ${money(n)} of debt.`)}
function trade(i,action,quantity){
  let price=state.prices[i],held=state.stocks[i];
  let qty=quantity==='max'?Math.floor(state.cash/price):quantity==='all'?held:Number(quantity);
  if(!Number.isSafeInteger(qty)||qty<1)return announce('Enter a positive whole number of shares.');
  if(action==='buy'&&qty*price>state.cash+1e-7)return announce('Not enough cash to buy those shares.');
  if(action==='sell'&&qty>held)return announce(`You only own ${count(held)} ${stockDefs[i].symbol} shares.`);
  let total=qty*price;
  if(action==='buy'){state.cash-=total;state.stocks[i]+=qty}else{state.cash+=total;state.stocks[i]-=qty}
  commit(`${action==='buy'?'Bought':'Sold'} ${count(qty)} ${stockDefs[i].symbol} shares for ${money(total)}.`)
}
function sellEntirePortfolio(){let n=state.stocks.reduce((s,v)=>s+v,0);if(!n)return announce('You do not own any shares.');let total=portfolio();if(!confirm(`Sell all ${count(n)} shares across every stock for ${money(total)}?`))return;state.cash+=total;state.stocks=stockDefs.map(()=>0);commit(`Sold ${count(n)} shares for ${money(total)}.`)}
function resetEmpire(){if(!confirm('Reset your current '+(room?'multiplayer room':'solo')+' empire to $10,000? This cannot be undone.'))return;state=fresh();if(room)updateSharedMarket();commit('A new empire begins!')}
// Deterministic room market: all participants calculate the same fictional prices
// from a room-specific seed + shared start time. Not a server-authoritative exchange.
function seededPrice(i,t,seed){
  const s=seed*0.0019+i*13.31;
  const waves=.17*Math.sin(t/8+s)+.085*Math.sin(t/2.7+s*2.3)+.045*Math.sin(t*.9+s*.7);
  const gentleGrowth=Math.min(2.5,1+t*.00012);
  return Math.max(1,Math.round(stockDefs[i].price*gentleGrowth*(1+waves)));
}
function roomTick(){return Math.max(0,Math.floor((Date.now()-marketRoom.startedAt)/10000))}
function updateSharedMarket(){
  if(!marketRoom)return false;
  const tick=roomTick();
  const prices=stockDefs.map((_,i)=>seededPrice(i,tick,marketRoom.seed));
  const changed=prices.some((p,i)=>p!==state.prices[i]);
  state.prices=prices;
  state.history=stockDefs.map((_,i)=>Array.from({length:Math.min(60,tick+1)},(_,j)=>seededPrice(i,Math.max(0,tick-59)+j,marketRoom.seed)));
  state.marketTick=((Date.now()-marketRoom.startedAt)%10000+10000)%10000/1000;
  return changed;
}
function updateSoloMarket(dt){
  state.marketTick+=dt;
  let changed=false;
  while(state.marketTick>=10){
    state.marketTick-=10;changed=true;
    state.prices=state.prices.map((p,i)=>{
      const change=.93+Math.random()*.14;
      const next=Math.max(1,Math.round(p*change));
      state.history[i].push(next);if(state.history[i].length>60)state.history[i].shift();
      return next;
    });
  }
  return changed;
}
function lineSVG(points,{large=false,uid=0}={}){
  const data=points.length>=2?points:[points[0]||1,points[0]||1];
  const w=large?750:150,h=large?160:55,pad=large?8:3;
  const lo=Math.min(...data)*.98,hi=Math.max(...data)*1.02,span=Math.max(1,hi-lo);
  const xy=data.map((v,i)=>[(pad+i*(w-2*pad)/(data.length-1)),pad+(h-2*pad)*(1-(v-lo)/span)]);
  const path=xy.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ');
  const area=path+` L${xy.at(-1)[0].toFixed(2)} ${h} L${xy[0][0].toFixed(2)} ${h} Z`;
  const up=data.at(-1)>=data[0];const color=up?'#6feac0':'#fa8596';
  const grad='stock-gradient-'+uid+(large?'-big':'-small');
  const grid=large?`<path d="M0 40H${w}M0 80H${w}M0 120H${w}" fill="none" stroke="#2b4155" stroke-dasharray="4,5" stroke-width=".8"/>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${grad}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".23"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${grad})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="${large?2.6:2}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderBusiness(){
  $('owned-businesses').textContent=count(state.levels.reduce((s,v)=>s+v,0))+' owned';
  $('businesses').innerHTML=businessDefs.map((b,i)=>{let n=state.levels[i],c=priceToBuy(i),unit=b.profit*Math.pow(1.22,Math.max(0,n-1))*staffBoost();return `<article class="business"><div class="icon">${b.icon}</div><div class="tier">${b.tier.toUpperCase()}</div><h3>${esc(b.name)}</h3><p>Owned: <b>${count(n)}</b> · Next unit: <b>${money(unit)}/sec</b></p><div class="owned">${n?'● OPERATING':'○ NOT OWNED'}</div><button class="btn btn-primary" data-buy="${i}" ${state.cash<c?'disabled':''}>${n?'Expand business':'Buy business'} · ${money(c)}</button></article>`}).join('');
}
function renderStocks(){
  const previousQty=stockDefs.map((_,i)=>$('qty-'+i)?.value);
  $('portfolio-value').textContent=money(portfolio());
  const shares=state.stocks.reduce((s,v)=>s+v,0);
  $('stock-holdings').textContent=`${count(shares)} shares across ${state.stocks.filter(Boolean).length} companies`;
  $('sell-portfolio').disabled=!shares;
  $('next-market').textContent=`Next update in ${Math.max(1,Math.ceil(10-state.marketTick))}s`;
  const s=stockDefs[selectedStock];let points=state.history[selectedStock];
  let delta=points.length>=2?100*(points.at(-1)/points[0]-1):0;
  $('chart-ticker').textContent=s.symbol+' · '+s.name.toUpperCase();
  $('chart-price').textContent=money(state.prices[selectedStock]);
  $('chart-change').textContent=(delta>=0?'+':'')+delta.toFixed(1)+'%';
  $('chart-change').className=delta>=0?'price-up':'price-down';
  $('large-chart').innerHTML=lineSVG(points,{large:true,uid:selectedStock});
  $('large-chart').setAttribute('aria-label',`${s.name} price chart: ${count(points.length)} samples, currently ${money(state.prices[selectedStock])}`);
  $('chart-range').innerHTML='<span>Older</span><span>Latest</span>';
  $('stocks').innerHTML=stockDefs.map((d,i)=>{
    const hist=state.history[i];const change=hist.length>=2?100*(hist.at(-1)/hist[0]-1):0;
    const gain=change>=0;
    return `<article class="stock-row ${i===selectedStock?'selected':''}"><div class="stock-top"><div class="stock-identity"><div class="ticker">${d.symbol} · ${esc(d.sector)}</div><h3>${esc(d.name)}</h3><small>Owned: ${count(state.stocks[i])} · ${money(state.stocks[i]*state.prices[i])}</small></div><div class="spark">${lineSVG(hist,{uid:i})}</div><div class="stock-cost"><strong>${money(state.prices[i])}</strong><span class="${gain?'price-up':'price-down'}">${gain?'+':''}${change.toFixed(1)}%</span></div></div><button class="view-chart" data-chart="${i}">${i===selectedStock?'● Viewing price history':'View price history ↑'}</button><div class="stock-controls"><label for="qty-${i}">Shares</label><input class="trade-input" id="qty-${i}" aria-label="${d.symbol} shares" type="number" min="1" step="1" inputmode="numeric" value="1"><button class="btn btn-primary" data-stockbuy="${i}" ${state.cash<state.prices[i]?'disabled':''}>Buy</button><button class="btn btn-outline" data-stockmax="${i}" ${state.cash<state.prices[i]?'disabled':''}>Buy Max</button><button class="btn btn-outline" data-stocksell="${i}" ${!state.stocks[i]?'disabled':''}>Sell</button><button class="btn btn-danger" data-stockall="${i}" ${!state.stocks[i]?'disabled':''}>Sell All</button></div></article>`
  }).join('');
  previousQty.forEach((v,i)=>{if(v!==undefined)$('qty-'+i).value=v});
}
function renderProperty(){
  $('properties').innerHTML=propertyDefs.map((p,i)=>`<article class="content-card"><h3>${p.icon} ${p.name}</h3><p>Owned: <b>${count(state.properties[i])}</b><br>Rent: ${money(p.rent)}/sec each</p><button class="btn btn-primary" data-property="${i}" ${state.cash<p.cost?'disabled':''}>Purchase · ${money(p.cost)}</button></article>`).join('')
}
function renderOperations(){
  $('employees').innerHTML=`<div class="detail-line"><span>Employees</span><strong>${count(state.staff)}</strong></div><div class="detail-line"><span>Revenue boost</span><strong>+${count(state.staff*8)}%</strong></div><div class="detail-line"><span>Wage bill / second</span><strong>${money(wages())}</strong></div><button class="btn btn-primary" data-operation="hire" ${state.cash<1000+state.staff*500?'disabled':''}>Hire · ${money(1000+state.staff*500)}</button><button class="btn btn-outline" data-operation="fire" ${!state.staff?'disabled':''}>Dismiss</button>`;
  $('loans').innerHTML=`<div class="detail-line"><span>Outstanding debt</span><strong>${money(state.debt)}</strong></div><div class="detail-line"><span>Interest / second</span><strong>${money(interest())}</strong></div><div class="detail-line"><span>Loan limit</span><strong>${money(100000+businessValue()*.5)}</strong></div><button class="btn btn-primary" data-operation="borrow" ${state.debt+10000>100000+businessValue()*.5?'disabled':''}>Borrow $10,000</button><button class="btn btn-outline" data-operation="repay" ${!state.debt||!state.cash?'disabled':''}>Repay up to $10,000</button>`;
  const lines=[['Cash',money(state.cash)],['Business assets',money(businessValue())],['Real estate',money(propertyValue())],['Stocks',money(portfolio())],['Debt','−'+money(state.debt)],['Gross revenue / second',money(gross())],['Wages + interest / second',money(wages()+interest())]];
  $('breakdown').innerHTML=lines.map(([k,v])=>`<div class="detail-line"><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function showLeaderboard(){
  const all=room?remotePlayers.map(r=>({name:r.name||'Player',amount:safe(r.worth),you:r.uid===authUser?.uid,updatedAt:r.updatedAt})): [
    {name:'Alex (AI)',amount:15000+state.elapsed*13},{name:'Jordan (AI)',amount:9000+state.elapsed*18},
    {name:'Taylor (AI)',amount:12000+state.elapsed*9},{name:'You',amount:netWorth(),you:true}
  ];
  if(room&&!all.some(p=>p.you))all.push({name:readName(),amount:netWorth(),you:true});
  all.sort((a,b)=>b.amount-a.amount);
  $('leaderboard').innerHTML=all.length?all.map((r,i)=>`<div class="leader ${r.you?'you':''}"><span class="name"><span class="rank">${i+1}</span>${esc(r.name)}${r.you?' (you)':''}</span><strong>${money(r.amount)}</strong></div>`).join(''):'<p class="footnote">No players yet.</p>';
  $('leaderboard-status').textContent=room?'● LIVE':'SOLO';
  $('leaderboard-desc').textContent=room?'Real players in room '+room.code+'. Rankings sync about every 8 seconds.':'AI rivals in solo mode. Create a room to compete with real friends.';
}
function render(force=false){
  $('cash').textContent=money(state.cash);
  $('income').textContent=signedMoney(income());$('income').classList.toggle('negative',income()<0);
  $('worth').textContent=signedMoney(netWorth());$('portfolio-stat').textContent=money(portfolio());
  $('portfolio-shares').textContent=count(state.stocks.reduce((s,v)=>s+v,0))+' shares owned';
  const pct=Math.max(0,Math.min(100,netWorth()/GOAL*100));
  $('goal-percentage').textContent=pct.toFixed(2)+'%';
  $('progress-fill').style.width=pct+'%';$('progress-track').setAttribute('aria-valuenow',pct.toFixed(2));
  $('progress-remaining').textContent=netWorth()>=GOAL?'You became a billionaire!':money(Math.max(0,GOAL-netWorth()))+' to go';
  if(netWorth()>=GOAL&&!state.won){state.won=true;announce('🏆 You made it! Your empire is worth $1 billion!');queueSync()}
  if(force){renderBusiness();renderStocks();renderProperty();renderOperations()}else if(currentTab==='operations'){renderOperations()}
  $('next-market').textContent=`Next update in ${Math.max(1,Math.ceil(10-state.marketTick))}s`;
  showLeaderboard();
  $('mode-badge').textContent=room?'● MULTIPLAYER':'● SOLO MODE';
  $('room-summary').innerHTML=room?`<p>You are playing in <strong>${esc(room.code)}</strong> with ${remotePlayers.length||1} player(s). First to $1 billion wins.</p><button class="btn btn-primary full-width" id="room-cta">Manage room →</button>`:'<p>Bring your friends into the billionaire race. Each player manages their own empire.</p><button class="btn btn-primary full-width" id="room-cta">Create or join room →</button>';
}
// Event delegation: controls continue working after UI refreshes.
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-buy],button[data-property],button[data-stockbuy],button[data-stocksell],button[data-stockmax],button[data-stockall],button[data-chart],button[data-operation],button[data-tab]');
  if(!b)return;
  const d=b.dataset;
  if(d.buy!==undefined)purchase(Number(d.buy));
  else if(d.property!==undefined)propertyBuy(Number(d.property));
  else if(d.stockbuy!==undefined)trade(Number(d.stockbuy),'buy',$('qty-'+d.stockbuy).valueAsNumber);
  else if(d.stocksell!==undefined)trade(Number(d.stocksell),'sell',$('qty-'+d.stocksell).valueAsNumber);
  else if(d.stockmax!==undefined)trade(Number(d.stockmax),'buy','max');
  else if(d.stockall!==undefined)trade(Number(d.stockall),'sell','all');
  else if(d.chart!==undefined){selectedStock=Number(d.chart);renderStocks();$('large-chart').scrollIntoView({behavior:'smooth',block:'nearest'})}
  else if(d.operation==='hire')hire();else if(d.operation==='fire')fire();else if(d.operation==='borrow')borrow();else if(d.operation==='repay')repay();
  else if(d.tab){currentTab=d.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===currentTab));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('active',x.id==='tab-'+currentTab));render(true)}
});
$('sell-portfolio').addEventListener('click',sellEntirePortfolio);
$('reset').addEventListener('click',resetEmpire);
function readName(){let stored=localStorage.getItem('business-empire-player-name')||'Player';return stored.slice(0,20)}
$('player-name').value=readName()==='Player'?'':readName();
$('player-name').addEventListener('input',()=>{try{localStorage.setItem('business-empire-player-name',$('player-name').value.trim().slice(0,20))}catch{}});
function openModal(){
  $('multiplayer-modal').classList.remove('hidden');document.body.classList.add('modal-open');
  $('multiplayer-config-status').classList.toggle('warning',!multiplayerConfigured());
  $('multiplayer-config-status').textContent=multiplayerConfigured()?'✅ Firebase is configured. You can create or join multiplayer rooms.':'⚙️ Multiplayer setup needed: add your Firebase project settings to firebase-config.js and publish the Firestore rules. See README.md in your download.';
  $('room-details').classList.toggle('hidden',!room);
  if(room)$('room-code-display').textContent=room.code;
}
function closeModal(){$('multiplayer-modal').classList.add('hidden');document.body.classList.remove('modal-open')}
$('open-multiplayer').addEventListener('click',openModal);
document.addEventListener('click',e=>{if(e.target.closest('#room-cta'))openModal()});
$('close-multiplayer').addEventListener('click',closeModal);
$('multiplayer-modal').addEventListener('click',e=>{if(e.target===$('multiplayer-modal'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function roomMessage(message){$('room-message').textContent=message}
function ensureName(){const n=$('player-name').value.trim().slice(0,20);if(!n){roomMessage('Enter a display name first.');$('player-name').focus();return null}try{localStorage.setItem('business-empire-player-name',n)}catch{}return n}
async function getFirebase(){
  if(firebase)return firebase;
  if(!multiplayerConfigured())throw new Error('Firebase has not been set up yet. Follow README.md.');
  if(firebaseLoading)return firebaseLoading;
  // Browser module CDN: no build tool or install required.
  firebaseLoading=(async()=>{
    const version='13.0.0';const base=`https://www.gstatic.com/firebasejs/${version}/`;
    const [app,auth,firestore]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
    const application=app.initializeApp(window.BUSINESS_EMPIRE_FIREBASE_CONFIG);
  const a=auth.getAuth(application);
db=firestore.initializeFirestore(application, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});
    if(!a.currentUser)await auth.signInAnonymously(a);
    authUser=a.currentUser;
    firebase={firestore,auth};return firebase;
  })();
  try{return await firebaseLoading}catch(err){firebaseLoading=null;throw err}
}
function codeGenerator(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bits=new Uint8Array(8);crypto.getRandomValues(bits);return Array.from(bits,b=>alphabet[b%alphabet.length]).join('')}
function localRoomKey(code){return 'business-empire-v05-room-'+code}
function cloudPayload(name){return {uid:authUser.uid,name,worth:Math.max(0,Math.floor(netWorth())),cash:Math.max(0,Math.floor(state.cash)),updatedAt:firebase.firestore.serverTimestamp(),saved:JSON.parse(JSON.stringify({...state,history:undefined}))}}
function queueSync(){if(!room||!firebase)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncPlayer().catch(err=>announce('Could not sync game progress: '+err.message))},950)}
async function syncPlayer(){
  if(!room||!firebase||syncBusy)return;
  syncBusy=true;
  const {doc,setDoc}=firebase.firestore;
  const code=room.code;
  try{await setDoc(doc(db,'rooms',code,'players',authUser.uid),cloudPayload(readName()),{merge:true})}finally{syncBusy=false}
}
async function enterRoom(code,roomDoc){
  const {collection,doc,getDoc,onSnapshot,setDoc}=firebase.firestore;
  // Separate saves make the multiplayer race fair: fresh $10k in a new room.
  if(room){await leaveRoom(false)}
  persist();
  let next=normalize(readStore(localRoomKey(code)));
  const ref=doc(db,'rooms',code,'players',authUser.uid);
  const mine=await getDoc(ref);
  if(mine.exists()&&mine.data().saved)next=normalize(mine.data().saved);
  activeKey=localRoomKey(code);state=next;
  room={code};marketRoom={seed:safe(roomDoc.seed,1),startedAt:safe(roomDoc.startedAt,Date.now())};
  remotePlayers=[];updateSharedMarket();persist();
  const payload=cloudPayload(readName());
  await setDoc(ref,payload,{merge:true});
  unsubscribePlayers=onSnapshot(collection(db,'rooms',code,'players'),snapshot=>{
    if(room?.code!==code)return;
    remotePlayers=snapshot.docs.map(d=>({uid:d.id,...d.data()}));
    showLeaderboard();
    $('room-summary').innerHTML=`<p>You are playing in <strong>${esc(code)}</strong> with ${remotePlayers.length||1} player(s). First to $1 billion wins.</p><button class="btn btn-primary full-width" id="room-cta">Manage room →</button>`;
  },error=>{announce('Leaderboard connection issue: '+error.message)});
  $('room-details').classList.remove('hidden');$('room-code-display').textContent=code;
  $('mode-badge').textContent='● MULTIPLAYER';
  const url=new URL(location.href);url.searchParams.set('room',code);history.replaceState(null,'',url);
  render(true);roomMessage('Connected to room '+code+'! Share the invite link with your friends.');
  announce('Joined multiplayer room '+code+'!');
}
async function leaveRoom(showNotice=true){
  clearTimeout(syncTimer);
  if(room&&firebase){try{await syncPlayer()}catch{}}
  if(unsubscribePlayers){unsubscribePlayers();unsubscribePlayers=null}
  const previousCode=room?.code;
  room=null;marketRoom=null;remotePlayers=[];
  activeKey=SOLO_KEY;state=loadSolo();lastFrame=Date.now();
  $('room-details').classList.add('hidden');
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
  render(true);
  if(showNotice){roomMessage('Left '+(previousCode||'the room')+'. Your solo game is back.');announce('Returned to solo mode.')}
}
$('leave-room').addEventListener('click',()=>leaveRoom().catch(err=>roomMessage(err.message)));
$('copy-room-link').addEventListener('click',async()=>{
  if(!room)return;
  const url=new URL(location.href);url.searchParams.set('room',room.code);
  try{await navigator.clipboard.writeText(url.href);roomMessage('Invite link copied!')}catch{prompt('Copy this room invite:',url.href)}
});
$('create-room').addEventListener('click',async()=>{
  const name=ensureName();if(!name)return;
  const b=$('create-room');b.disabled=true;roomMessage('Connecting to multiplayer...');
  try{
    await getFirebase();const {doc,getDoc,setDoc}=firebase.firestore;
    let code;for(let attempt=0;attempt<5;attempt++){const candidate=codeGenerator();if(!(await getDoc(doc(db,'rooms',candidate))).exists()){code=candidate;break}}
    if(!code)throw new Error('Could not create a unique room code.');
    const info={createdBy:authUser.uid,seed:Math.floor(Math.random()*1e9)+1,startedAt:Date.now(),createdAt:firebase.firestore.serverTimestamp()};
    await setDoc(doc(db,'rooms',code),info);
    await enterRoom(code,info);
  }catch(err){roomMessage('Could not create room: '+err.message)}finally{b.disabled=false}
});
$('join-room').addEventListener('click',async()=>{
  const name=ensureName();if(!name)return;
  const code=$('room-code-input').value.trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){roomMessage('Enter a valid 8-character invite code.');return}
  const b=$('join-room');b.disabled=true;roomMessage('Looking for room '+code+'...');
  try{await getFirebase();const ref=firebase.firestore.doc(db,'rooms',code);const found=await firebase.firestore.getDoc(ref);if(!found.exists())throw new Error('Room not found. Check the code.');await enterRoom(code,found.data())}
  catch(err){roomMessage('Could not join: '+err.message)}finally{b.disabled=false}
});
const prefillCode=new URLSearchParams(location.search).get('room');
if(prefillCode){$('room-code-input').value=prefillCode.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);openModal();roomMessage('Invite detected. Enter your name and press Join room.');}
let autosaveSeconds=0;
setInterval(()=>{
  const now=Date.now(),dt=Math.max(0,Math.min(5,(now-lastFrame)/1000));lastFrame=now;
  state.cash=Math.max(0,state.cash+income()*dt);state.elapsed+=dt;
  const marketChanged=room?updateSharedMarket():updateSoloMarket(dt);
  autosaveSeconds+=dt;
  if(autosaveSeconds>=3){persist();autosaveSeconds=0}
  if(marketChanged){render(true)}else{render(false)}
},1000);
setInterval(()=>{if(room)syncPlayer().catch(err=>console.warn('Multiplayer sync issue',err))},8000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();if(room)syncPlayer().catch(()=>{})}});
window.addEventListener('beforeunload',persist);
render(true);
