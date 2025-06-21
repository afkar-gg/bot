(function(){
  const _0x1f4b=["express","node-fetch","ngrok","random","floor","use","json","BOT_TOKEN","CHANNEL_ID","process","env","exit","headers","Authorization","Bot ","application/json","Content-Type","json","/send","ok","id","Error: ","/","🤖","Online.","send","listen","log","connect"];
  const e=require(_0x1f4b[0]);
  const f=require(_0x1f4b[1]);
  const g=require(_0x1f4b[2]);
  const h=e();
  const i=Math[_0x1f4b[4]](Math[_0x1f4b[3]]()*3001)+1000;
  const j=process[_0x1f4b[10]].BOT_TOKEN||"YOUR_BOT_TOKEN_HERE";
  const k=process[_0x1f4b[10]].CHANNEL_ID||"YOUR_CHANNEL_ID_HERE";
  if(!j||!k){console }
  h[_0x1f4b[5]](e[_0x1f4b[6]]());
  h[_0x1f4b[24]](_0x1f4b[23],(a,b)=>{b[_0x1f4b[24]](_0x1f4b[25])});
  h[_0x1f4b[18]]("/send",async(a,b)=>{try{
    const l=await f(`https://discord.com/api/v10/channels/${k}/messages?limit=1`,{[_0x1f4b[12]]:{[_0x1f4b[15]]:_0x1f4b[14]+j}}).then(r=>r[_0x1f4b[16]]());
    if(Array.isArray(l)&&l[0]){
      const m=l[0][_0x1f4b[20]];
      await f(`https://discord.com/api/v10/channels/${k}/messages/${m}`,{method:"DELETE",[_0x1f4b[12]]:{[_0x1f4b[15]]:_0x1f4b[14]+j}});
    }
    const n=a.body.content||"No content.";
    const o=await f(`https://discord.com/api/v10/channels/${k}/messages`,{
      method:"POST",
      [_0x1f4b[12]]:{
        [_0x1f4b[16]]:_0x1f4b[15],
        [_0x1f4b[15]]:_0x1f4b[14]+j
      },
      body:JSON.stringify({content:n})
    });
    const p=await o[_0x1f4b[16]]();
    b.json({[_0x1f4b[19]]:true,[_0x1f4b[20]]:p[_0x1f4b[20]]});
  }catch(q){
    console[_0x1f4b[26]]("❌ "+_0x1f4b[21]+q.message);
    b.status(500).json({error:q.message});
  }});
  (async()=>{
    h[_0x1f4b[25]](i,()=>console[_0x1f4b[26]]("🟢 Local on port",i));
    const r=await g[_0x1f4b[27]](i);
    console[_0x1f4b[26]]("🌍 Ngrok URL:",r+"/send");
  })();
})();