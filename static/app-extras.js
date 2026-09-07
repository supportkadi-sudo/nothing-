'use strict';
$('view-product').addEventListener('click',()=>{$('turn-result').textContent='';openWindow($('showcase-dialog'),$('view-product'),'showcase-title');});
$('rotate').addEventListener('click',()=>{
 if(turnTimer)return;$('rotate').disabled=true;
 motion($('showcase'),[{opacity:1,transform:'scaleX(1)'},{opacity:.45,transform:'scaleX(.985)'},{opacity:1,transform:'scaleX(1)'}]);
 turnTimer=setTimeout(()=>{turnTimer=null;$('turn-result').textContent='С другой стороны тоже ничего';$('rotate').disabled=false;},reduced()?0:200);
});
const answers=[['Где мой заказ?','Проверьте, ничего ли у вас нет'],['Что входит в PRO?','То же ничего, но с уважением'],['Чем отличается дорогой тариф?','Суммой, которую вы больше не увидите'],['Когда доставка?','Ничего уже на месте.'],['Есть гарантия?','Гарантируем отсутствие содержания.']];
function setQuestionsDisabled(value){$('chat-questions').querySelectorAll('button').forEach(b=>{b.disabled=value;});}
function bubble(text,question=false){const p=document.createElement('p');p.className='bubble'+(question?' question':'');p.textContent=text;$('chat-log').append(p);while($('chat-log').children.length>15)$('chat-log').firstElementChild.remove();$('chat-log').scrollTop=$('chat-log').scrollHeight;}
answers.forEach(([question,answer])=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=question;b.addEventListener('click',()=>{
 if(chatTimer)return;bubble(question,true);setQuestionsDisabled(true);$('chat-typing').textContent='Поддержка набирает ничего…';
 chatTimer=setTimeout(()=>{chatTimer=null;$('chat-typing').textContent='';bubble(answer);setQuestionsDisabled(false);b.focus({preventScroll:true});},650);
});$('chat-questions').append(b);});
$('open-chat').addEventListener('click',()=>openWindow($('chat-dialog'),$('open-chat'),'chat-title'));
function shareText(){return 'Я купил NOTHING #'+order.id+' за '+money(order.price)+'.\nДа, буквально ничего.';}
function legacyCopy(text){const field=$('share-text');field.value=text;$('manual-share').hidden=false;field.focus();field.select();field.setSelectionRange(0,text.length);let copied=false;try{copied=typeof document.execCommand==='function'&&document.execCommand('copy');}catch(error){copied=false;}if(copied){$('manual-share').hidden=true;$('share').focus();}$('share-status').textContent=copied?'Текст скопирован. Поделитесь ничем.':'Текст готов — скопируйте его ниже.';}
async function copyText(text){if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);$('share-status').textContent='Текст скопирован. Поделитесь ничем.';return;}catch(error){legacyCopy(text);return;}}legacyCopy(text);}
$('share').addEventListener('click',async()=>{if(sharing||!order?.id)return;sharing=true;const text=shareText();$('share-status').textContent='';try{if(typeof navigator.share==='function'){try{await navigator.share({title:'Моё NOTHING',text});return;}catch(error){if(error.name==='AbortError')return;}}await copyText(text);}finally{sharing=false;}});
// Canvas uses only text and geometric lines: no external images or tainted pixels.
function drawCertificate(snapshot){
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
 const font=document.fonts?.check('16px Geologica')?'Geologica, sans-serif':'Arial, sans-serif';
 function text(value,y,size,color='#f7f7fa',weight=400){ctx.fillStyle=color;let actual=size;ctx.font=weight+' '+actual+'px '+font;while(ctx.measureText(value).width>860&&actual>20){actual--;ctx.font=weight+' '+actual+'px '+font;}ctx.fillText(value,540,y);}
 ctx.fillStyle='#05070a';ctx.fillRect(0,0,1080,1920);ctx.strokeStyle='#292c34';ctx.lineWidth=2;ctx.strokeRect(60,60,960,1800);ctx.textAlign='center';
 text('NOTHING',205,46,'#f7f7fa',700);text('by KADI',250,26,'#aaaab4');
 ctx.strokeStyle='#a78bfa';ctx.beginPath();ctx.moveTo(498,340);ctx.lineTo(582,340);ctx.stroke();
 text('Официально',570,59);text('владею ничем',647,59);
 text('NOTHING',855,30,'#aaaab4',500);text('#'+snapshot.id,1010,142,'#a78bfa',700);
 ctx.strokeStyle='#292c34';ctx.beginPath();ctx.moveTo(145,1135);ctx.lineTo(935,1135);ctx.stroke();
 text(snapshot.name,1230,32,'#f7f7fa',500);text(money(snapshot.price),1305,46,'#f7f7fa',500);text(dateText(snapshot.date),1370,28,'#aaaab4');
 text('Да, буквально ничего',1635,32);text('Сертификат NOTHING',1755,26,'#aaaab4');return canvas;
}
function makeBlob(canvas){return new Promise((resolve,reject)=>{if(canvas.toBlob){canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG unavailable')),'image/png');}else{try{const raw=atob(canvas.toDataURL('image/png').split(',')[1]);resolve(new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'image/png'}));}catch(error){reject(error);}}});}
function downloadCertificate(){if(!certificateURL)return;$('download-certificate').click();$('certificate-status').textContent='Если PNG открылся вместо скачивания, сохраните изображение долгим нажатием.';}
$('save-certificate').addEventListener('click',async()=>{
 if(!order?.id)return;
 const snapshot=order,generation=certificateGeneration,button=$('save-certificate');button.disabled=true;
 try{
 if(!certificateURL){const blob=await makeBlob(drawCertificate(snapshot));if(generation!==certificateGeneration)return;
 certificateURL=URL.createObjectURL(blob);certificateFile=typeof File==='function'?new File([blob],'NOTHING-'+snapshot.id+'.png',{type:'image/png'}):null;
 $('certificate-preview').src=certificateURL;$('download-certificate').href=certificateURL;$('download-certificate').download='NOTHING-'+snapshot.id+'.png';
 let canShare=false;try{canShare=!!(certificateFile&&navigator.share&&navigator.canShare?.({files:[certificateFile]}));}catch(error){canShare=false;}$('share-certificate').hidden=!canShare;
 }
 $('certificate-panel').hidden=false;downloadCertificate();$('download-certificate').focus({preventScroll:true});$('certificate-panel').scrollIntoView({block:'nearest',behavior:'auto'});
 }catch(error){$('share-status').textContent='Не удалось создать PNG в этом браузере. Можно поделиться текстом.';}finally{button.disabled=false;}
});
$('share-certificate').addEventListener('click',async()=>{
 if(!certificateFile||sharing)return;sharing=true;$('certificate-status').textContent='';
 try{await navigator.share({title:'Моё NOTHING',files:[certificateFile]});}
 catch(error){if(error.name!=='AbortError'){$('certificate-status').textContent='Отправка файла недоступна. Скачайте PNG ниже.';$('download-certificate').focus();}}
 finally{sharing=false;}
});
