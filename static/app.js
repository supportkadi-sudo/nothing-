(async()=>{
  const files=['/static/app-core.js','/static/app-extras.js','/static/app-init.js'];
  for(const src of files){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Failed to load '+src));
      document.head.append(script);
    });
  }
})().catch(error=>console.error('NOTHING frontend failed to initialize',error));
