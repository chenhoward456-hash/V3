const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const base=process.argv[2]||process.env.HOWARD_QA_BASE_URL||'http://localhost:3011';
const out=process.argv[3]||'/tmp/howard-coach-after';
const secret='coach-workflow-local-fixture-secret';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Fixture QA only supports localhost');
const scenario=process.env.HOWARD_QA_SCENARIO||'normal';
if(!['normal','empty','read','error','single'].includes(scenario))throw Error('Unknown fixture scenario');
const id='11111111-1111-4111-8111-111111111111';
const day=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)};
const client={id,unique_code:'QAOnly01',name:'測試學員・案例一',age:32,gender:'男性',height:175,weight:82,status:'normal',is_active:true,expires_at:day(-45),subscription_tier:'premium',client_mode:'body_composition',goal_type:'cut',calories_target:2200,protein_target:165,carbs_target:250,fat_target:60,target_weight:78,target_date:day(-60),diet_start_date:day(25),prep_phase:null,competition_date:null,next_checkup_date:day(-21),coach_last_viewed_at:day(8),coach_weekly_note:'先確認最近兩晚睡眠與外食份量，維持熱量到週日再看週平均。',coach_summary:'此次處理重點：最近兩天體重上升，先核對水分與紀錄，勿直接砍熱量。',health_goals:'維持力量並降低腰圍',competition_enabled:false,health_mode_enabled:false,body_composition_enabled:true,nutrition_enabled:true,wellness_enabled:true,training_enabled:true,supplement_enabled:false,lab_enabled:false,ai_chat_enabled:false,simple_mode:false,auto_adjust_enabled:false,onboarding_notes_rendered:'每週三次訓練、久坐工作',health_screening:null,line_user_id:null,last_line_activity:day(0),created_at:day(30),training_plan:[]};
const bodyData=Array.from({length:14},(_,i)=>({id:'body'+i,client_id:id,date:day(13-i),weight:83-i*.06+(i>11?.7:0),height:175,body_fat:22}));
const nutritionLogs=Array.from({length:14},(_,i)=>({id:'nut'+i,client_id:id,date:day(13-i),compliant:i!==12,calories:2200+(i===12?300:0),protein_grams:160,carbs_grams:250,fat_grams:62,water_ml:2400}));
const wellness=Array.from({length:7},(_,i)=>({id:'well'+i,client_id:id,date:day(6-i),energy_level:7,sleep_hours:i>4?5.5:7.5,sleep_quality:6,stress_level:5,mood:7}));
const trainingLogs=[1,3,5,8,10,12].map(n=>({id:'train'+n,client_id:id,date:day(n),training_type:'weight',rpe:7,duration:60,note:n===1?'肩推最後兩組肩膀不舒服，已停止。':''}));
const overview={client,supplements:[],supplementLogs:[],wellness,trainingLogs,bodyData,labResults:[],nutritionLogs,trainingSets:[],personalNotes:[{id:'note1',category:'lifestyle',note:'最近工作輪班，睡眠不足時先詢問作息。',weight:8,relevant_until:day(-30)}]};
const dashboard={clients:[client],supplements:[],supplementLogs:[],todayWellness:[{client_id:id}],todayLogs:[],todayTraining:[],todayNutrition:[{client_id:id}],todayBody:[{client_id:id}],recentBody:bodyData,recentNutrition:nutritionLogs,recentWellness:wellness,recentTrainingRPE:trainingLogs,activityBody:bodyData,activityNutrition:nutritionLogs,activityWellness:wellness,activityTraining:trainingLogs,pushClientIds:[]};
const reason={kind:'signal',priority:100,reason:'10/6 他寫：「肩推最後兩組肩膀不舒服，已停止。」—— 有提到不舒服',action:'打開訓練筆記，先回覆他提出的問題或不舒服的地方',review:{date:null,label:'回覆後約定複核日；目前未設定'}};
const items=[0,1,2,3].map((n)=>{const cid=n===0?id:`${n+1}${'1'.repeat(7)}-1111-4111-8111-111111111111`;const r=n===0?reason:{kind:n===1?'lab':n===2?'offline':'proposal',priority:100-n*20,reason:n===1?'血檢回檢逾期 3 天':n===2?'5 天沒有任何紀錄':'2 筆提案待你審核',action:n===1?'確認回檢安排與要追蹤的項目':n===2?'先確認近況，請他回報一筆目前的記錄':'打開提案檢查依據，再決定套用或退回',review:{date:n===1?day(3):null,label:n===1?'既有回檢日，待確認':'目前未設定'}};return {clientId:cid,name:n===0?client.name:`測試學員・案例${['二','三','四'][n-1]}`,priority:r.priority,reason:r.reason,action:r.action,review:r.review,href:`/admin/clients/${cid}/overview?workflow=1`,reasons:[r,{kind:'proposal',priority:40,reason:'另有一筆營養提案待審',action:'確認依據與最近記錄',review:{date:null,label:'目前未設定'}}],signals:[{kind:'student_note',sev:3,text:r.reason}],latestMessage:{sentAt:day(2)+'T09:00:00+08:00',readAt:n===0?null:day(1)+'T12:00:00+08:00'}}});
if(scenario==='single'){items[0].reasons=[reason];items[0].signals=[{kind:'student_note',sev:3,text:reason.reason}]}
const proposals=[0,1].map(n=>({id:'qa-proposal-'+n,client_id:id,proposed_at:day(n)+'T09:00:00+08:00',expires_at:null,proposal_type:'nutrition',current_state:{calories_target:2200},proposed_changes:{calories_target:2300+n*100},reasoning:'合成案例：核對兩週紀錄後提出，待教練查證。',clients:{name:client.name}}));
const history={messages:[{id:'msg1',title:'先維持原熱量，看週平均',body:'請先回報最近兩晚睡眠和肩膀狀況，週日再看週平均。',created_at:day(2)+'T09:00:00+08:00',read_at:scenario==='read'?day(1)+'T12:00:00+08:00':null,sent_via:'app'}],adjustments:[{id:'macro1',applied_at:day(4)+'T10:00:00+08:00',reason:'確認記錄後維持蛋白質，增加碳水作為起點。',applied_by:'coach',old_macros:{calories:2100,protein:165,carbs:225,fat:60},new_macros:{calories:2200,protein:165,carbs:250,fat:60}}],unavailable:false};
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
 const log={scenario,requests:[],blocked:[],unknown:[],errors:[],screens:[],checks:[]};
 const check=(name,pass)=>{log.checks.push({name,pass});if(!pass)throw Error('Failed: '+name)};
 try{
 for(const [label,width,height] of [['mobile',430,932],['desktop',1280,900]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  await ctx.addInitScript(()=>localStorage.setItem('cookie_consent','declined'));
  const exp=String(Date.now()+3600000);const sig=crypto.createHmac('sha256',secret).update(`admin:${exp}`).digest('hex');
  await ctx.addCookies([{name:'admin_session',value:`${exp}.${sig}`,domain:new URL(base).hostname,path:'/'}]);
  let workflowCalls=0, failMode=scenario==='error';
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(!['GET','HEAD'].includes(req.method())){log.blocked.push({method:req.method(),path:u.pathname});return route.abort('blockedbyclient')}
   if(u.origin!==new URL(base).origin){return route.abort('blockedbyclient')}
   if(u.pathname.startsWith('/api/')){
    log.requests.push(u.pathname);let data;
    if(u.pathname==='/api/admin/coach-workflow'){
      workflowCalls++;
      if(failMode)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Fixture temporary failure'})});
      data={today:day(0),items:scenario==='empty'?[]:u.searchParams.has('clientId')?items.filter(i=>i.clientId===u.searchParams.get('clientId')):items,...(u.searchParams.has('clientId')?{history}:{} )};
    }
    else if(u.pathname==='/api/admin/dashboard')data=dashboard;
    else if(u.pathname==='/api/client-overview')data=overview;
    else if(u.pathname==='/api/admin/verify')data={success:true};
    else if(u.pathname==='/api/admin/notifications')data={notifications:[]};
    else if(u.pathname==='/api/admin/proposals'){await new Promise(r=>setTimeout(r,450));data={success:true,data:scenario==='empty'?[]:proposals};}
    else if(u.pathname==='/api/admin/ai-audit/pending')data={success:true,data:{count:0}};
    else if(u.pathname==='/api/nutrition-suggestions')data={suggestion:{status:'insufficient_data',reason:'測試情境：先核對回報'},meta:{}};
    else if(u.pathname==='/api/admin/coach-digest')data={text:'測試晨報：案例一先核對睡眠与外食，不自動改熱量。'};
    else {log.unknown.push(u.pathname);return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'QA fixture unavailable'})})}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   return route.continue();
  });
  const pg=await ctx.newPage();pg.on('pageerror',e=>log.errors.push(e.message));
  for(const [pageLabel,url] of [['admin','/admin'],['overview',`/admin/clients/${id}/overview`]]){
   await pg.goto(base+url,{waitUntil:'networkidle',timeout:120000});
   await pg.waitForTimeout(750);
   if(await pg.locator('body').innerText().then(t=>t.includes('登入')&&!t.includes(client.name)))throw Error('Auth redirect: check synthetic cookie format');
   if(scenario==='error'&&pageLabel==='admin'){
    await pg.locator('#coach-workflow').getByRole('alert').waitFor();
    await pg.screenshot({path:path.join(out,`error-${label}.png`),fullPage:false});
    failMode=false;
    await pg.locator('#coach-workflow').getByRole('button',{name:'重試',exact:true}).click();
    await pg.locator('#coach-workflow').getByRole('link',{name:'查證與處理'}).first().waitFor();
    check(label+': retry button recovers',true);
   }
   if(pageLabel==='overview'&&scenario==='single')check(label+': no empty reason details',await pg.locator('#coach-workflow').getByText('查看判斷依據與其他關注',{exact:true}).count()===0);
   if(pageLabel==='overview'&&scenario==='read')check(label+': read still needs confirmation',(await pg.locator('#coach-workflow').innerText()).includes('訊息卡已收起；仍需確認是否執行。'));
   await pg.screenshot({path:path.join(out,`${pageLabel}-${label}-viewport.png`),fullPage:false,animations:'disabled'});
   const file=path.join(out,`${pageLabel}-${label}.png`);await pg.screenshot({path:file,fullPage:true,animations:'disabled'});
   const scrollWidth=await pg.evaluate(()=>document.documentElement.scrollWidth);
   check(`${label}: ${pageLabel} no horizontal overflow`,scrollWidth===width);
   log.screens.push({file,url:pg.url(),width,scrollWidth});
   fs.writeFileSync(path.join(out,`${pageLabel}-${label}.txt`),await pg.locator('body').innerText());
  }
  // Reversible interaction tests: no send, save, or production API.
  await pg.goto(base+'/admin',{waitUntil:'networkidle'});
  let panel=pg.locator('#coach-workflow');
  if(scenario==='normal')await panel.getByRole('link',{name:'查證與處理'}).first().waitFor();
  if(scenario==='normal'){
   check(label+': first3',await panel.getByRole('link',{name:'查證與處理'}).count()===3);
   check(label+': fourth initially hidden',!(await panel.getByText('測試學員・案例四',{exact:true}).isVisible()));
   await panel.getByText('其他 1 位需關注學員',{exact:true}).click();
   check(label+': fourth expands',await panel.getByText('測試學員・案例四',{exact:true}).isVisible());
   await panel.getByText('查看判斷依據與其他關注',{exact:true}).first().click();
   check(label+': reason expands',await panel.getByText('另有一筆營養提案待審',{exact:true}).first().isVisible());
   await panel.getByRole('link',{name:'查證與處理'}).first().click();
   await pg.waitForURL('**/overview?workflow=1');await pg.locator('#coach-workflow').getByRole('button',{name:'記處理備註',exact:true}).waitFor();
   panel=pg.locator('#coach-workflow');
   check(label+': null review honest',(await panel.innerText()).includes('目前未設定'));
   check(label+': read not execution',(await panel.innerText()).includes('尚無收起紀錄；不代表學員未執行。'));
   check(label+': review link',await panel.getByRole('link',{name:'查看／設定複核'}).getAttribute('href')===`/admin/clients/${id}/longevity`);
   await panel.getByRole('link',{name:'查看待審提案',exact:true}).click();
   await pg.waitForURL('**/admin?proposalClientId='+id+'#coach-proposals-'+id);
   const proposalRow=pg.locator('[id="coach-proposals-'+id+'"]');
   await proposalRow.waitFor();await pg.waitForTimeout(600);
   check(label+': proposal anchor unique',await proposalRow.count()===1);
   check(label+': delayed proposals open',await pg.locator('#coach-proposals').evaluate(el=>el.open));
   const rowBox=await proposalRow.boundingBox();
   if(!rowBox||rowBox.y<0||rowBox.y>=height){await pg.screenshot({path:path.join(out,'proposal-position-failure-'+label+'.png'),fullPage:false});console.error(JSON.stringify({rowBox,height,scrollY:await pg.evaluate(()=>window.scrollY)}));}
   check(label+': correct proposal positioned',!!rowBox&&rowBox.y>=0&&rowBox.y<height);
   check(label+': real proposal controls visible',await proposalRow.getByRole('button',{name:'套用',exact:true}).isVisible()&&await proposalRow.getByRole('button',{name:'不要',exact:true}).isVisible());
   await pg.screenshot({path:path.join(out,'proposal-open-'+label+'.png'),fullPage:false});
   await pg.goto(base+'/admin/clients/'+id+'/overview?workflow=1',{waitUntil:'networkidle'});
   panel=pg.locator('#coach-workflow');await panel.getByRole('button',{name:'發訊息',exact:true}).waitFor();
   await panel.getByRole('button',{name:'發訊息',exact:true}).click();
   check(label+': compose opens',await pg.getByRole('heading',{name:'發訊息給 '+client.name}).isVisible());
   await pg.getByRole('button',{name:'✕',exact:true}).click();
   check(label+': compose closes',!(await pg.getByRole('heading',{name:'發訊息給 '+client.name}).isVisible()));
   await panel.getByRole('button',{name:'記處理備註',exact:true}).click();
   await pg.waitForTimeout(1200);
   check(label+': note editor opens',await pg.getByText('本週教練備註',{exact:true}).isVisible());
   const noteBox=await pg.getByText('本週教練備註',{exact:true}).boundingBox();
   check(label+': note editor in viewport',!!noteBox&&noteBox.y>=0&&noteBox.y<height-100);
   await pg.screenshot({path:path.join(out,'note-open-'+label+'.png'),fullPage:false});
  }
  if(scenario==='empty')check(label+': empty honest',(await panel.innerText()).includes('不代表所有學員已達標'));
  // error scenario first failure was screenshot pass; now subsequent retries recover.
  if(scenario==='error')check(label+': error recovered',await panel.getByRole('link',{name:'查證與處理'}).count()===3);
  await ctx.close();

 }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'qa-log.json'),JSON.stringify(log,null,2))}
 if(log.errors.length||log.blocked.length||log.unknown.length)throw Error('Unexpected browser error, writer, or unmocked API; inspect qa-log.json');
 console.log(JSON.stringify({out,screens:log.screens,errors:log.errors,blocked:log.blocked,unknown:[...new Set(log.unknown)],checks:log.checks}));
})().catch(e=>{console.error(e.message);process.exit(1)});
