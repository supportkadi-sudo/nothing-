'use strict';
document.querySelectorAll('.faq-list details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)document.querySelectorAll('.faq-list details').forEach(other=>{if(other!==detail)other.open=false;});}));

// Ambient background follows the pointer a little, because static emptiness was apparently not enough.
const root=document.documentElement;
let ambientFrame=0;
function setAmbient(x,y){
 if(reduced())return;
 cancelAnimationFrame(ambientFrame);
 ambientFrame=requestAnimationFrame(()=>{
  root.style.setProperty('--mx',x+'%');root.style.setProperty('--my',y+'%');
  root.style.setProperty('--drift-x',((x-50)*.12).toFixed(1)+'px');
  root.style.setProperty('--drift-y',((y-50)*.08).toFixed(1)+'px');
 });
}
window.addEventListener('pointermove',e=>setAmbient((e.clientX/window.innerWidth)*100,(e.clientY/window.innerHeight)*100),{passive:true});
window.addEventListener('pointerleave',()=>setAmbient(50,28),{passive:true});

async function bootstrap(){await Promise.all([loadConfig(),loadStats(false)]);setupReveal();}
bootstrap();

// Optional stylesheet never blocks initialization or interactions.
const fontLink=document.createElement('link');fontLink.rel='stylesheet';fontLink.href='https://fonts.googleapis.com/css2?family=Geologica:wght@400;500;600;700;800&display=swap';document.head.append(fontLink);
