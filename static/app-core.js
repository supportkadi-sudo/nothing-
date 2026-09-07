'use strict';
const $=id=>document.getElementById(id);
const format=n=>new Intl.NumberFormat('ru-RU').format(n);
const money=n=>format(n)+' сум';
const dateText=date=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long',year:'numeric'}).format(date);
let stats={total:0,count:0,max:0};
let publicConfig={payment_card_number:'',payment_card_label:'HUMOCARD',order_ttl_minutes:5};
document.querySelectorAll('[data-stat]').forEach(el=>{el.textContent=el.dataset.stat==='total'?'0 сум':'0';});
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function motion(el,frames){if(!reduced()&&typeof el.animate==='function')el.animate(frames,{duration:220,easing:'cubic-bezier(.22,.7,.2,1)'});}
function animateCount(el,target,prefix='',suffix=''){if(!el||reduced()){if(el)el.textContent=prefix+format(target)+suffix;return;}const duration=900;const start=performance.now();function frame(now){const progress=Math.min((now-start)/duration,1);const eased=1-Math.pow(1-progress,3);el.textContent=prefix+format(Math.round(target*eased))+suffix;if(progress<1)requestAnimationFrame(frame);}requestAnimationFrame(frame);}
function renderStats(animate=false){const set=(selector,value,suffix='')=>{const el=document.querySelector(selector);if(!el)return;if(animate)animateCount(el,value,'',suffix);else el.textContent=format(value)+suffix;};set('[data-stat="total"]',stats.total,' сум');set('[data-stat="count"]',stats.count);set('[data-stat="total-number"]',stats.total);set('[data-stat="max"]',stats.max);}
function apiDate(value){if(!value)return null;return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:value+'Z');}
function relativeTime(value){const date=apiDate(value);if(!date||Number.isNaN(date.getTime()))return '';const seconds=Math.max(0,Math.round((Date.now()-date.getTime())/1000));if(seconds<60)return 'только что';if(seconds<3600)return Math.floor(seconds/60)+' мин назад';if(seconds<86400)return Math.floor(seconds/3600)+' ч назад';return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit'}).format(date);}
function renderRecent(items){const list=$('recent-list');if(!list)return;list.textContent='';if(!items.length){const li=document.createElement('li');li.className='empty-recent';li.innerHTML='<span>Пока никто ничего не купил.</span>';list.append(li);return;}items.forEach(item=>{const li=document.createElement('li');const serial=document.createElement('span');serial.className='serial';serial.textContent='#'+item.receipt_number;const amount=document.createElement('span');amount.textContent=money(item.amount);const time=document.createElement('time');time.textContent=relativeTime(item.paid_at);li.append(serial,amount,time);list.append(li);});}
async function loadStats(animate=false){try{const response=await fetch('/api/stats',{cache:'no-store'});if(!response.ok)throw new Error('stats');const data=await response.json();stats={total:Number(data.total)||0,count:Number(data.count)||0,max:Number(data.max)||0};renderStats(animate);renderRecent(Array.isArray(data.recent)?data.recent:[]);}catch(error){renderStats(false);}}
async function loadConfig(){try{const response=await fetch('/api/config',{cache:'no-store'});if(!response.ok)throw new Error('config');publicConfig=await response.json();}catch(error){}const label=$('payment-card-label'),number=$('payment-card-number');if(label)label.textContent=publicConfig.payment_card_label||'Карта';if(number){number.textContent=publicConfig.payment_card_number||'Карта не настроена';number.classList.toggle('not-ready',!publicConfig.payment_card_number);}}
function setupReveal(){const nodes=[...document.querySelectorAll('.reveal')];if(!nodes.length)return;if(reduced()||!('IntersectionObserver' in window)){nodes.forEach(n=>n.classList.add('in-view'));return;}const seen=new WeakSet();const io=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting||seen.has(entry.target))return;seen.add(entry.target);entry.target.classList.add('in-view');io.unobserve(entry.target);});},{threshold:.16,rootMargin:'0px 0px -8% 0px'});nodes.forEach(n=>io.observe(n));}
const dialogs=[...document.querySelectorAll('dialog')];
const openers=new WeakMap();let activeDialog=null;
let pollTimer=null,countdownTimer=null,transitionTimer=null,chatTimer=null,turnTimer=null;
function cleanUp(d){
 if(d.id==='purchase-dialog'){stopOrderWatch();clearTimeout(transitionTimer);transitionTimer=null;}
 if(d.id==='chat-dialog'){clearTimeout(chatTimer);chatTimer=null;$('chat-typing').textContent='';setQuestionsDisabled(false);}
 if(d.id==='showcase-dialog'){clearTimeout(turnTimer);turnTimer=null;$('rotate').disabled=false;}
}
function closeWindow(d){cleanUp(d);d.close();if(activeDialog===d)activeDialog=null;document.body.classList.toggle('modal-open',!!activeDialog);}
function openWindow(d,opener,title){
 if(activeDialog)closeWindow(activeDialog);
 openers.set(d,opener);activeDialog=d;d.showModal();document.body.classList.add('modal-open');$(title).focus({preventScroll:true});
}
dialogs.forEach(d=>{
 d.addEventListener('cancel',e=>{e.preventDefault();closeWindow(d);});
 d.addEventListener('close',()=>{cleanUp(d);if(activeDialog===d)activeDialog=null;document.body.classList.toggle('modal-open',!!activeDialog);if(!activeDialog)openers.get(d)?.focus({preventScroll:true});});
 d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))closeWindow(d);});
 d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeWindow(d)));
});
const dialog=$('purchase-dialog'),panels=['payment','checking','success'];
let selected={price:4900,name:'NOTHING+',code:'plus'},order=null,sharing=false,certificateFile=null,certificateURL=null,certificateGeneration=0;
function showPanel(name){panels.forEach(id=>{$(id).hidden=id!==name;});const title=name==='payment'?'dialog-title':name+'-title';dialog.setAttribute('aria-labelledby',title);$(title).focus({preventScroll:true});dialog.scrollTop=0;}
document.querySelectorAll('input[name="nothing"]').forEach(input=>input.addEventListener('change',()=>{
 selected={price:Number(input.value),name:input.dataset.name,code:input.dataset.code};$('buy-label').textContent='Купить ничего за '+money(selected.price);
 motion($('buy-label'),[{opacity:.4,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}]);
 $('expensive-note').textContent=selected.price===49900?'Вы уверены? Нам даже немного неловко':'';
}));
['close','cancel','done'].forEach(id=>$(id).addEventListener('click',()=>closeWindow(dialog)));
function resetCertificate(){certificateGeneration++;certificateFile=null;if(certificateURL)URL.revokeObjectURL(certificateURL);certificateURL=null;$('certificate-panel').hidden=true;$('certificate-preview').removeAttribute('src');$('download-certificate').removeAttribute('href');$('certificate-status').textContent='';$('share-certificate').hidden=true;}
function stopOrderWatch(){clearTimeout(pollTimer);pollTimer=null;clearInterval(countdownTimer);countdownTimer=null;}
function updateCountdown(){if(!order?.expiresAt)return;const remaining=order.expiresAt-Date.now();const timer=$('payment-timer');if(!timer)return;if(remaining<=0){timer.textContent='5 минут истекли. Проверяем ещё несколько секунд…';timer.classList.add('expired');return;}const total=Math.ceil(remaining/1000),m=Math.floor(total/60),s=String(total%60).padStart(2,'0');timer.textContent='На оплату '+String(m).padStart(2,'0')+':'+s+' · проверяем автоматически';timer.classList.remove('expired');}
function fillReceipt(paid){order={...order,status:'paid',id:paid.receipt_number,date:apiDate(paid.paid_at)||new Date(),exact:paid.exact_amount};$('receipt-id').textContent='NOTHING #'+order.id;$('receipt-plan').textContent=order.name;$('receipt-price').textContent=money(order.price);$('receipt-total').textContent=money(order.exact);$('receipt-date').textContent=dateText(order.date);}
function finishPaid(paid){stopOrderWatch();fillReceipt(paid);showPanel('checking');transitionTimer=setTimeout(()=>{transitionTimer=null;if(!dialog.open)return;showPanel('success');loadStats(true);},520);}
async function checkOrder({manual=false}={}){if(!order?.publicId)return;try{if(manual){$('paid').disabled=true;$('paid').textContent='Проверяем…';}const response=await fetch('/api/orders/'+encodeURIComponent(order.publicId),{cache:'no-store'});if(!response.ok)throw new Error('status');const data=await response.json();if(data.status==='paid'){finishPaid(data);return;}const grace=30000;if(Date.now()<(order.expiresAt+grace)){pollTimer=setTimeout(()=>checkOrder(),2000);}else{stopOrderWatch();$('payment-timer').textContent='Заказ истёк. Создайте новый, если ещё хотите ничего.';$('payment-timer').classList.add('expired');$('paid').disabled=true;}}catch(error){if(Date.now()<(order.expiresAt+30000))pollTimer=setTimeout(()=>checkOrder(),3000);}finally{if(manual&&order?.status!=='paid'&&Date.now()<(order.expiresAt+30000)){$('paid').disabled=false;$('paid').textContent='Проверить оплату';}}}
function startOrderWatch(){stopOrderWatch();updateCountdown();countdownTimer=setInterval(updateCountdown,1000);pollTimer=setTimeout(()=>checkOrder(),1200);}
$('buy').addEventListener('click',async()=>{
 if(dialog.open||$('buy').disabled)return;
 if(!publicConfig.payment_card_number){$('expensive-note').textContent='Карта для оплаты ещё не настроена.';return;}
 $('buy').disabled=true;resetCertificate();$('expensive-note').textContent='';
 try{
  const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_code:selected.code})});
  if(!response.ok)throw new Error('order create failed');
  const created=await response.json();
  const ttl=(Number(publicConfig.order_ttl_minutes)||5)*60000;
  order={...selected,publicId:created.public_id,exact:created.exact_amount,id:null,date:null,status:created.status,expiresAt:Date.now()+ttl};
  $('payment-product').textContent=order.name+' · '+money(order.price);$('exact-amount').textContent=format(order.exact);
  $('share-status').textContent='';$('manual-share').hidden=true;$('paid').disabled=false;$('paid').textContent='Проверить оплату';
  panels.forEach(id=>{$(id).hidden=id!=='payment';});dialog.setAttribute('aria-labelledby','dialog-title');
  openWindow(dialog,$('buy'),'dialog-title');showPanel('payment');startOrderWatch();
 }catch(error){$('expensive-note').textContent='Не удалось создать заказ. Попробуйте ещё раз.';}
 finally{$('buy').disabled=false;}
});
$('paid').addEventListener('click',()=>{if(!order||$('payment').hidden)return;clearTimeout(pollTimer);pollTimer=null;checkOrder({manual:true});});
