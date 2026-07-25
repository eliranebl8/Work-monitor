/*
Work Monitor app - JavaScript extensions and future changes.
File version: 6.10 BETA - functions2.js.
Loaded after functions1.js. All future functional JavaScript changes should be added here.
Do not move or duplicate APP_VERSION; its single source remains in functions1.js.

CHANGELOG 6.01 - פיצול קובץ JavaScript
1. functions.js פוצל לשני קבצים כדי לאפשר העתקה ותחזוקה נוחות יותר.
2. functions1.js מכיל את ליבת הקוד היציבה עד גבול בטוח של פונקציה מלאה.
3. functions2.js מכיל את יתרת הקוד וכל שינוי פונקציונלי עתידי יתווסף אליו.
4. index.html טוען את functions1.js ולאחריו את functions2.js לפי סדר התלויות.
*/

(function(){
  try{ if(typeof setAppVersionUI === "function") setAppVersionUI(); }catch(e){}

  const REMEMBER_COOKIE_V417 = "workSessionRememberV417";

  function byIdV417(id){ return document.getElementById(id); }
  function safeEscV417(s){
    try{ return esc(s); }catch(e){ return String(s||"").replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]}); }
  }
  function setCookieV417(name,value,days){
    try{
      const d=new Date();
      d.setTime(d.getTime() + (Number(days||365)*24*60*60*1000));
      document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + d.toUTCString() + "; path=/; SameSite=Lax";
    }catch(e){}
  }
  function getCookieV417(name){
    try{
      const parts=(document.cookie||"").split(";").map(x=>x.trim());
      for(const p of parts){
        if(p.indexOf(name+"=")===0) return decodeURIComponent(p.substring(name.length+1));
      }
    }catch(e){}
    return "";
  }
  function deleteCookieV417(name){
    try{ document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax"; }catch(e){}
  }
  function saveRememberCookieV417(sess){
    try{
      if(!sess || sess.role !== "worker" || !sess.remember){ deleteCookieV417(REMEMBER_COOKIE_V417); return; }
      const clean={
        role:"worker",
        workerId:sess.workerId||"",
        name:sess.name||"",
        authUid:sess.authUid||"",
        authEmail:sess.authEmail||"",
        remember:true,
        loginAt:sess.loginAt||Date.now(),
        expiresAt:null,
        savedAt:Date.now(),
        appVersion:"4.17"
      };
      setCookieV417(REMEMBER_COOKIE_V417, JSON.stringify(clean), 365);
      localStorage.setItem("workSession", JSON.stringify(clean));
      window.session = clean;
    }catch(e){}
  }
  function hydrateRememberFromCookieV417(){
    try{
      const current=localStorage.getItem("workSession");
      if(current) return;
      const raw=getCookieV417(REMEMBER_COOKIE_V417);
      if(!raw) return;
      const parsed=JSON.parse(raw);
      if(parsed && parsed.role==="worker" && parsed.workerId && parsed.remember){
        parsed.expiresAt=null;
        localStorage.setItem("workSession", JSON.stringify(parsed));
        window.session=parsed;
      }
    }catch(e){ deleteCookieV417(REMEMBER_COOKIE_V417); }
  }
  async function ensureLocalAuthPersistenceV417(){
    try{
      if(window.firebase && firebase.auth && auth && auth.setPersistence && firebase.auth.Auth && firebase.auth.Auth.Persistence){
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      }
    }catch(e){ console.warn("Auth persistence LOCAL skipped", e); }
  }

  // מחזיר סשן שמור עוד לפני שה־boot קורא localStorage
  hydrateRememberFromCookieV417();
  document.addEventListener("DOMContentLoaded", function(){
    hydrateRememberFromCookieV417();
    ensureLocalAuthPersistenceV417();
  });

  const oldOnloadV417 = window.onload;
  window.onload = async function(){
    hydrateRememberFromCookieV417();
    await ensureLocalAuthPersistenceV417();
    if(typeof oldOnloadV417 === "function") return oldOnloadV417.apply(this, arguments);
  };

  const oldWorkerLoginV417 = window.workerLogin;
  if(typeof oldWorkerLoginV417 === "function"){
    window.workerLogin = async function(){
      const rememberChecked = !!(byIdV417("rememberMe") && byIdV417("rememberMe").checked);
      await ensureLocalAuthPersistenceV417();
      const result = await oldWorkerLoginV417.apply(this, arguments);
      try{
        if(window.session && session.role === "worker"){
          session.remember = rememberChecked;
          session.expiresAt = rememberChecked ? null : (Date.now() + (2*60*60*1000));
          localStorage.setItem("workSession", JSON.stringify(session));
          if(rememberChecked) saveRememberCookieV417(session);
          else deleteCookieV417(REMEMBER_COOKIE_V417);
        }
      }catch(e){}
      return result;
    };
  }

  const oldLogoutV417 = window.logout;
  if(typeof oldLogoutV417 === "function"){
    window.logout = function(){
      deleteCookieV417(REMEMBER_COOKIE_V417);
      try{ localStorage.removeItem("workSession"); }catch(e){}
      return oldLogoutV417.apply(this, arguments);
    };
  }

  function showSavedNoticeAfterEditV417(){
    const msg = byIdV417("entryMsg") || byIdV417("dayPanel") || byIdV417("workerToolsMsg");
    if(msg){
      if(msg.id === "entryMsg"){
        msg.innerHTML = '<div class="notice">העבודה נשמרה בהצלחה ✅</div>';
      }else{
        const n=document.createElement("div");
        n.className="notice";
        n.textContent="העבודה נשמרה בהצלחה ✅";
        msg.prepend(n);
        setTimeout(()=>{ try{ n.remove(); }catch(e){} }, 4500);
      }
    }
    try{
      const panel=byIdV417("dayPanel");
      if(panel) panel.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(e){}
  }

  // גרסה מלאה של שמירת עריכת עבודה: שומר, סוגר את חלון העריכה, מרענן, ומציג הודעה במסך היום.
  window.saveEntryEdit = async function(){
    const id=val("editEntryId"), customerNumber=val("editEntryCustomer"), address=val("editEntryAddress"), notes=val("editEntryNotes");
    let amount=Number(val("editEntryAmount")||0);
    const editMsg=byIdV417("editEntryMsg");
    if(!customerNumber || !/^\d+$/.test(customerNumber)){
      if(editMsg) editMsg.innerHTML='<p class="danger">מספר לקוח חייב להיות ספרות בלבד.</p>';
      return;
    }
    if(!address){
      if(editMsg) editMsg.innerHTML='<p class="danger">חובה למלא כתובת.</p>';
      return;
    }
    const original=(window.monthEntries||[]).find(x=>x.id===id);
    const update={customerNumber,address,notes,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(original && original.workType === "install"){
      let edited=null;
      if(typeof window.getEditedInstallItems === "function") edited=window.getEditedInstallItems();
      else if(typeof window.getEditedInstallItemsV415 === "function") edited=window.getEditedInstallItemsV415();
      if(!edited || !edited.items || !edited.items.length){
        if(editMsg) editMsg.innerHTML='<p class="danger">חובה לבחור לפחות פריט התקנה אחד.</p>';
        return;
      }
      update.items=edited.items;
      update.amount=Number(edited.total||0);
      if(edited.kind){
        update.installKind=edited.kind;
        update.priceType=edited.kind;
        update.description = edited.kind === "rf" ? "התקנת RF" : "התקנת סיב";
      }
    }else{
      if(Number.isNaN(amount)||amount<0){
        if(editMsg) editMsg.innerHTML='<p class="danger">סכום לא תקין.</p>';
        return;
      }
      update.amount=amount;
    }
    try{
      if(editMsg) editMsg.innerHTML='<div class="notice">שומר...</div>';
      await db.collection("workEntries").doc(id).update(update);
      try{ hide("editEntryPanel"); }catch(e){ const p=byIdV417("editEntryPanel"); if(p)p.classList.add("hidden"); }
      await loadMonth();
      showSavedNoticeAfterEditV417();
    }catch(e){
      if(editMsg) editMsg.innerHTML='<p class="danger">שגיאה בשמירה: '+safeEscV417(e.message||e)+'</p>';
    }
  };
})();
;
(function(){
  function safeArrV419(a){ return Array.isArray(a) ? a : []; }
  function isPlannedSafeV419(e){
    try{ if(typeof window.isPlannedV49 === 'function') return !!window.isPlannedV49(e); }catch(_e){}
    return e && (e.entryStatus === 'planned' || e.status === 'planned' || e.planned === true);
  }
  function entryTimeV419(e){
    try{ return Number(e && e.createdAt && e.createdAt.seconds ? e.createdAt.seconds : 0); }catch(_e){ return 0; }
  }
  function countsV419(list){
    list = safeArrV419(list);
    return {
      total:list.length,
      installs:list.filter(function(e){return e.workType === 'install';}).length,
      services:list.filter(function(e){return e.workType === 'service';}).length
    };
  }
  function countsTextV419(c){
    return 'סה״כ ' + c.total + ' · התקנות ' + c.installs + ' · קריאות שירות ' + c.services;
  }
  function detailsV419(e){
    if(e.workType === 'service'){
      return 'מספר לקוח: ' + (e.customerNumber || '') + '\nכתובת: ' + (e.address || '') + '\n' + (e.notes || '');
    }
    return 'מספר לקוח: ' + (e.customerNumber || '') + '\nכתובת: ' + (e.address || '') + '\n' +
      safeArrV419(e.items).map(function(i){ return (i.name || '') + ' × ' + (i.quantity || 0) + ' = ' + money(i.total || 0); }).join('<br>') +
      '\n' + (e.notes || '');
  }
  function buildEntryRowV419(e, planned){
    var row=document.createElement('div');
    row.className='item' + (planned ? ' planned-card-v49' : '');
    var iconClass=e.workType==='install' ? 'install' : (e.isReturnCall ? 'return' : 'service');
    var icon=e.workType==='install' ? '🛠️' : (e.isReturnCall ? '🔁' : '☎️');
    row.innerHTML = '<div class="work-row-main"><div class="work-icon '+iconClass+'">'+(planned?'📋':icon)+'</div><div><div class="item-title">'+esc(e.description||'')+' '+(planned?'<span class="planned-badge-v49">מתוכנן</span>':'<span class="done-badge-v49">בוצע</span>')+'</div><div class="item-sub">'+nl2br(detailsV419(e))+'</div></div></div><div><div class="money '+(planned?'planned-money-v49':'')+'">'+money(e.amount||0)+'</div><div class="actions" style="margin-top:8px">'+(planned?'<button class="btn-green" onclick="markEntryDoneV49(\''+e.id+'\')">בוצע</button>':'')+'<button class="btn-yellow" onclick="openEntryEdit(\''+e.id+'\')">ערוך</button>'+((!planned && e.workType==='install')?'<button class="btn-light" onclick="saveEntryAsTemplate(\''+e.id+'\')">שמור כתבנית</button>':'')+'<button class="btn-red" onclick="deleteEntry(\''+e.id+'\')">מחק</button></div></div>';
    return row;
  }
  function sectionV419(title, subtitle, count, items, planned){
    var sec=document.createElement('section');
    sec.className='day-section-v419 ' + (planned ? 'day-section-planned-v419' : 'day-section-done-v419');
    sec.innerHTML = '<div class="day-section-head-v419"><div><h3 class="day-section-title-v419">'+title+'</h3><div class="day-section-sub-v419">'+subtitle+'</div></div><div class="day-count-pill-v419">'+countsTextV419(count)+'</div></div><div class="day-scroll-v419"></div>';
    var scroll=sec.querySelector('.day-scroll-v419');
    if(!items.length){
      scroll.innerHTML='<div class="day-empty-v419">אין '+(planned?'עבודות מתוזמנות':'עבודות שבוצעו')+' ביום הזה.</div>';
    }else{
      items.forEach(function(e){ scroll.appendChild(buildEntryRowV419(e, planned)); });
    }
    return sec;
  }
  window.renderDay=function(){
    try{ if(typeof ensurePlannedButtonsV49 === 'function') ensurePlannedButtonsV49(); }catch(_e){}
    if(!selectedDate){ hide('dayPanel'); show('selectDayHint'); return; }
    show('dayPanel'); hide('selectDayHint'); text('dateTitle','יום '+heDate(selectedDate));
    renderInstallItems(); setType(selectedType,false); updateServicePriceLabels();
    try{ if(typeof ensurePlannedButtonsV49 === 'function') ensurePlannedButtonsV49(); }catch(_e){}

    var entries=safeArrV419(monthEntries).filter(function(e){return e.date===selectedDate;}).sort(function(a,b){return entryTimeV419(b)-entryTimeV419(a);});
    var done=entries.filter(function(e){ var st=String((e && (e.entryStatus || e.status)) || 'done'); return !isPlannedSafeV419(e) && st!=='not_done'; });
    var planned=entries.filter(function(e){return isPlannedSafeV419(e);});
    var box=$('dayEntries'); if(!box) return;
    box.innerHTML='';
    var wrap=document.createElement('div');
    wrap.className='day-sections-v419';
    wrap.appendChild(sectionV419('✅ עבודות שבוצעו ביום הזה', 'נכנס להתחשבנות ולסיכומי החודש', countsV419(done), done, false));
    wrap.appendChild(sectionV419('📋 עבודות מתוזמנות ביום הזה', 'לא נכנס להתחשבנות עד סימון בוצע', countsV419(planned), planned, true));
    box.appendChild(wrap);
    if(typeof cleanVisibleSlashN === 'function') cleanVisibleSlashN();
  };
  window.addEventListener('load', function(){
    try{ window.APP_VERSION = APP_VERSION; document.title = "מעקב עבודה - גרסה " + APP_VERSION; setAppVersionUI && setAppVersionUI(); }catch(_e){}
  });
})();
;
(function(){
  window.openWorkerTabV420=function(tab){
    tab = tab || 'overview';
    document.querySelectorAll('.worker-tab-btn-v420').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-worker-tab') === tab);
    });
    document.querySelectorAll('.worker-tab-pane-v420').forEach(function(pane){
      pane.classList.toggle('active', pane.getAttribute('data-worker-pane') === tab);
    });
    try{
      if(tab === 'dashboard' && typeof renderSmartDashboard === 'function') renderSmartDashboard();
      if(tab === 'search' && typeof renderFullSummary === 'function') renderFullSummary();
      if(typeof cleanVisibleSlashN === 'function') cleanVisibleSlashN();
    }catch(e){ console.warn('openWorkerTabV420', e); }
  };

  function forcePanelsVisibleV420(){
    ['workerToolsPanel','workerSettingsPanel','smartDashboard','clientHistoryPanel','searchPanel'].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.classList.remove('hidden');
    });
  }

  var oldShowWorker = window.showWorker;
  if(typeof oldShowWorker === 'function'){
    window.showWorker = async function(worker){
      var res = await oldShowWorker(worker);
      forcePanelsVisibleV420();
      window.openWorkerTabV420('overview');
      return res;
    };
  }

  var oldShowWorkerById = window.showWorkerById;
  if(typeof oldShowWorkerById === 'function'){
    window.showWorkerById = async function(id){
      var res = await oldShowWorkerById(id);
      forcePanelsVisibleV420();
      return res;
    };
  }

  var oldToggleDashboard = window.toggleDashboard;
  window.toggleDashboard = function(){ window.openWorkerTabV420('dashboard'); if(typeof renderSmartDashboard === 'function') renderSmartDashboard(); };
  window.toggleClientHistory = function(){ window.openWorkerTabV420('client'); };
  window.toggleSearchPanel = function(){ window.openWorkerTabV420('search'); if(typeof renderFullSummary === 'function') renderFullSummary(); };
  window.toggleWorkerTools = function(){ window.openWorkerTabV420('tools'); };
  window.toggleWorkerSettings = function(){ window.openWorkerTabV420('settings'); try{ bindGoalMonthInputV556(); if(document.getElementById('selfGoalMonth')) document.getElementById('selfGoalMonth').value=currentCalendarMonthKeyV556(); if((typeof viewedWorker !== 'undefined' && viewedWorker)&&document.getElementById('selfMonthlyGoal')) document.getElementById('selfMonthlyGoal').value=getWorkerGoalForMonthV556(); }catch(e){} };

  window.addEventListener('DOMContentLoaded', function(){
    forcePanelsVisibleV420();
    window.openWorkerTabV420('overview');
  });
  window.addEventListener('load', function(){
    forcePanelsVisibleV420();
    try{ window.APP_VERSION = APP_VERSION; document.title = "מעקב עבודה - גרסה " + APP_VERSION; if(typeof setAppVersionUI === 'function') setAppVersionUI(); }catch(_e){}
  });
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ if(typeof APP_VERSION !== 'undefined'){} }catch(e){}
  function sum422(arr){return (arr||[]).reduce((s,e)=>s+Number(e.amount||0),0)}
  function done422(arr){return (typeof doneEntriesV49==='function')?doneEntriesV49(arr||[]):(arr||[]).filter(e=>!(typeof isPlannedV49==='function' && isPlannedV49(e)))}
  function planned422(arr){return (typeof plannedEntriesV49==='function')?plannedEntriesV49(arr||[]):(arr||[]).filter(e=>(typeof isPlannedV49==='function' && isPlannedV49(e))||e.entryStatus==='planned')}
  function group422(arr,keyFn){const o={};(arr||[]).forEach(e=>{const k=keyFn(e); if(!o[k])o[k]={count:0,total:0,items:[]}; o[k].count++; o[k].total+=Number(e.amount||0); o[k].items.push(e)}); return o}
  function pct422(a,b){return b?Math.round((a/b)*100):0}
  function bestKey422(obj,field){const ks=Object.keys(obj||{});return ks.length?ks.sort((a,b)=>Number(obj[b][field]||0)-Number(obj[a][field]||0))[0]:''}
  function weekdayName422(dateStr){try{return ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][parseDate(dateStr).getDay()]||''}catch(e){return ''}}
  function renderBars422(obj,limit){
    const rows=Object.keys(obj||{}).sort().slice(-limit||-7); const max=Math.max(1,...rows.map(k=>obj[k].total||0));
    if(!rows.length)return '<p class="muted">אין מספיק נתונים להצגת מגמה.</p>';
    return '<div class="smart-bars-v422">'+rows.map(k=>`<div class="smart-bar-row-v422"><div>${esc(k.slice(5)||k)}</div><div class="smart-bar-track-v422"><div class="smart-bar-fill-v422" style="width:${Math.max(4,Math.round((obj[k].total/max)*100))}%"></div></div><div>${money(obj[k].total||0)}</div></div>`).join('')+'</div>';
  }
  window.renderSmartDashboard=function(){
    const box=$('smartDashboard'); if(!box)return;
    const all=Array.isArray(monthEntries)?monthEntries:[];
    const done=done422(all), planned=planned422(all);
    const total=sum422(done), plannedTotal=sum422(planned), allPotential=total+plannedTotal;
    const services=done.filter(e=>e.workType==='service'), installs=done.filter(e=>e.workType==='install');
    const plannedServices=planned.filter(e=>e.workType==='service'), plannedInstalls=planned.filter(e=>e.workType==='install');
    const returnCalls=services.filter(e=>e.isReturnCall);
    const goal=getWorkerGoalForMonthV556(), left=Math.max(goal-total,0), progress=goal?Math.min(100,pct422(total,goal)):0;
    const workDays=[...new Set(done.map(e=>e.date).filter(Boolean))].length, avg=workDays?total/workDays:0;
    const byDate=group422(done,e=>e.date||'ללא תאריך');
    const byWeekday=group422(done,e=>weekdayName422(e.date)||'ללא יום');
    const byClient=group422(done,e=>e.customerNumber||'ללא מספר');
    const bestDay=bestKey422(byDate,'total'), bestWeekday=bestKey422(byWeekday,'total'), topClient=bestKey422(byClient,'count');
    const completion=allPotential?pct422(total,allPotential):0;
    const installAvg=installs.length?sum422(installs)/installs.length:0, serviceAvg=services.length?sum422(services)/services.length:0;
    const insights=[];
    insights.push(progress>=100?`<li class="good">🎯 היעד החודשי הושג. כרגע אתה על ${Math.round(progress)}%.</li>`:`<li class="warn">🎯 חסר ליעד ${money(left)}. ממוצע נוכחי ליום עבודה: ${money(avg)}.</li>`);
    if(planned.length) insights.push(`<li class="info">📋 יש ${planned.length} עבודות מתוזמנות בשווי ${money(plannedTotal)}. אם כולן יבוצעו, תגיע ל־${money(allPotential)}.</li>`);
    if(bestWeekday) insights.push(`<li class="info">🔥 היום החזק ביותר לפי הנתונים החודשיים: יום ${esc(bestWeekday)}.</li>`);
    if(topClient && byClient[topClient].count>1) insights.push(`<li class="warn">👤 לקוח חוזר בולט: ${esc(topClient)} עם ${byClient[topClient].count} עבודות החודש.</li>`);
    if(returnCalls.length) insights.push(`<li class="warn">🔁 יש ${returnCalls.length} קריאות חוזרות/ללא תשלום. שווה לבדוק אם יש דפוס שחוזר.</li>`);
    if(!insights.length) insights.push('<li class="info">אין עדיין מספיק נתונים לתובנות עמוקות. אחרי כמה ימי עבודה הדשבורד יתחיל להיות חכם יותר.</li>');
    box.innerHTML=`
      <div class="smart-grid-v422">
        <div class="smart-card-v422"><div class="smart-title">בוצע החודש</div><div class="smart-value">${money(total)}</div><div class="smart-note">רק עבודות שבוצעו</div></div>
        <div class="smart-card-v422"><div class="smart-title">מתוזמן החודש</div><div class="smart-value">${money(plannedTotal)}</div><div class="smart-note">לא נספר בהתחשבנות עד ביצוע</div></div>
        <div class="smart-card-v422"><div class="smart-title">עמידה ביעד</div><div class="smart-value">${Math.round(progress)}%</div><div class="smart-note">${goal?('יעד: '+money(goal)):'לא הוגדר יעד'}</div></div>
        <div class="smart-card-v422"><div class="smart-title">ממוצע ליום</div><div class="smart-value">${money(avg)}</div><div class="smart-note">${workDays} ימי עבודה פעילים</div></div>
      </div>
      <div class="smart-quick-v422">
        <div class="smart-mini-v422">התקנות שבוצעו<b>${installs.length}</b></div>
        <div class="smart-mini-v422">קריאות שבוצעו<b>${services.length}</b></div>
        <div class="smart-mini-v422">אחוז ביצוע מול מתוזמן<b>${completion}%</b></div>
      </div>
      <div class="smart-section-v422"><h3>📈 מגמת הכנסות לפי ימים</h3>${renderBars422(byDate,10)}</div>
      <div class="smart-section-v422"><h3>🧠 תובנות אוטומטיות</h3><ul class="smart-insights-v422">${insights.slice(0,6).join('')}</ul></div>
      <div class="smart-section-v422"><h3>⚖️ השוואת סוגי עבודה</h3>
        <div class="smart-quick-v422">
          <div class="smart-mini-v422">ממוצע התקנה<b>${money(installAvg)}</b></div>
          <div class="smart-mini-v422">ממוצע קריאה<b>${money(serviceAvg)}</b></div>
          <div class="smart-mini-v422">מתוכנן: התקנות / קריאות<b>${plannedInstalls.length} / ${plannedServices.length}</b></div>
        </div>
      </div>`;
  };

  function ensureA11y422(){
    if(document.getElementById('a11yFloatingV422'))return;
    const wrap=document.createElement('div'); wrap.id='a11yFloatingV422'; wrap.className='a11y-floating-v422';
    wrap.innerHTML=`<button type="button" class="a11y-main-btn-v422" onclick="toggleA11yPanelV422()" aria-label="פתיחת כלי נגישות">♿ נגישות</button><div id="a11yPanelV422" class="a11y-panel-v422 hidden" role="dialog" aria-label="כלי נגישות"><h3>כלי נגישות</h3><p class="muted">התאמות בסיסיות לנוחות שימוש. ההצהרה מצורפת כדי לתת מענה מסודר למשתמשים.</p><div class="actions"><button class="btn-light" type="button" onclick="toggleLargeTextV422()">הגדלת טקסט</button><button class="btn-light" type="button" onclick="toggleContrastV422()">ניגודיות גבוהה</button><button class="btn-light" type="button" onclick="toggleReadableFontV422()">פונט קריא</button><button class="btn-yellow" type="button" onclick="resetA11yV422()">איפוס</button><button class="btn-green" type="button" onclick="openAccessibilityStatementV422()">הצהרת נגישות</button><button class="btn-light" type="button" onclick="toggleA11yPanelV422()">סגור</button></div></div>`;
    document.body.appendChild(wrap);
  }
  window.toggleA11yPanelV422=function(){const p=document.getElementById('a11yPanelV422'); if(p)p.classList.toggle('hidden')};
  window.toggleLargeTextV422=function(){document.body.classList.toggle('a11y-large-text-v422')};
  window.toggleContrastV422=function(){document.body.classList.toggle('a11y-high-contrast-v422')};
  window.toggleReadableFontV422=function(){document.body.classList.toggle('a11y-readable-font-v422')};
  window.resetA11yV422=function(){document.body.classList.remove('a11y-large-text-v422','a11y-high-contrast-v422','a11y-readable-font-v422')};
  window.openAccessibilityStatementV422=function(){
    const old=document.getElementById('accessibilityModalV422'); if(old)old.remove();
    const m=document.createElement('div'); m.id='accessibilityModalV422'; m.className='accessibility-modal-v422';
    m.innerHTML=`<div class="accessibility-modal-card-v422" role="dialog" aria-modal="true" aria-label="הצהרת נגישות"><div class="cal-head"><h2>הצהרת נגישות</h2><button class="btn-light" type="button" onclick="document.getElementById('accessibilityModalV422').remove()">סגור</button></div><p>אנו רואים חשיבות רבה בהנגשת השירות לכלל המשתמשים, כולל אנשים עם מוגבלויות, ומשקיעים מאמץ כדי שהמערכת תהיה נוחה, ברורה ושמישה ככל האפשר.</p><h3>התאמות שבוצעו במערכת</h3><ul><li>כפתורים גדולים וברורים במובייל ובמחשב.</li><li>אפשרות להגדלת טקסט, ניגודיות גבוהה ופונט קריא דרך כפתור הנגישות.</li><li>מבנה כרטיסיות להפחתת גלילה ועומס חזותי.</li><li>שימוש בכותרות, טקסטים ברורים וצבעים בעלי ניגודיות טובה ככל האפשר.</li></ul><h3>דיווח על בעיית נגישות</h3><p>אם נתקלת בקושי להשתמש במערכת, אפשר לפנות אלינו ונעשה מאמץ לטפל בתקלה בהקדם.</p><p><b>איש קשר:</b> אלירן<br><b>טלפון:</b> 052-8899988<br><b>אימייל:</b> Eliranebl@gmail.com</p><p class="muted">עודכן לאחרונה: 04/05/2026 · גרסה ${APP_VERSION}</p><div class="actions"><button class="btn-green" type="button" onclick="document.getElementById('accessibilityModalV422').remove()">הבנתי</button></div></div>`;
    document.body.appendChild(m);
  };
  document.addEventListener('DOMContentLoaded',function(){ensureA11y422(); try{setAppVersionUI()}catch(e){}});
  window.addEventListener('load',function(){ensureA11y422(); try{setAppVersionUI()}catch(e){}; try{renderSmartDashboard()}catch(e){} });
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ document.title = "מעקב עבודה - גרסה " + APP_VERSION; }catch(e){}
  function s423(arr){return (arr||[]).reduce((x,e)=>x+Number(e.amount||0),0)}
  function isPlan423(e){try{return (typeof isPlannedV49==='function' && isPlannedV49(e)) || e.entryStatus==='planned'}catch(_e){return e.entryStatus==='planned'}}
  function done423(arr){return (arr||[]).filter(e=>!isPlan423(e))}
  function planned423(arr){return (arr||[]).filter(e=>isPlan423(e))}
  function group423(arr,keyFn){const o={};(arr||[]).forEach(e=>{const k=keyFn(e)||'לא ידוע'; if(!o[k])o[k]={count:0,total:0,items:[]}; o[k].count++; o[k].total+=Number(e.amount||0); o[k].items.push(e)});return o}
  function pct423(a,b){return b?Math.round((Number(a||0)/Number(b||0))*100):0}
  function best423(o,field){const ks=Object.keys(o||{});return ks.length?ks.sort((a,b)=>Number(o[b][field]||0)-Number(o[a][field]||0))[0]:''}
  function weekday423(dateStr){try{return ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][parseDate(dateStr).getDay()]||''}catch(e){return ''}}
  function monthDay423(dateStr){try{return heDate(dateStr).slice(0,5)}catch(e){return dateStr||''}}
  function renderBars423(obj,limit){
    const rows=Object.keys(obj||{}).sort().slice(-(limit||10));
    const max=Math.max(1,...rows.map(k=>Number(obj[k].total||0)));
    if(!rows.length)return '<p class="muted">אין מספיק נתונים להצגת מגמה.</p>';
    return '<div class="smart-bars-v423">'+rows.map(k=>`<div class="smart-bar-row-v423"><div>${esc(monthDay423(k))}</div><div class="smart-bar-track-v423"><div class="smart-bar-fill-v423" style="width:${Math.max(4,Math.round((obj[k].total/max)*100))}%"></div></div><div>${money(obj[k].total||0)}</div></div>`).join('')+'</div>';
  }
  function topItems423(entries){
    const o={};
    (entries||[]).forEach(e=>(e.items||[]).forEach(i=>{const k=i.name||'פריט'; if(!o[k])o[k]={qty:0,total:0}; o[k].qty+=Number(i.quantity||0); o[k].total+=Number(i.total||0)}));
    return Object.keys(o).sort((a,b)=>o[b].total-o[a].total).slice(0,5).map(k=>({name:k,...o[k]}));
  }
  window.renderSmartDashboard=function(){
    const box=$('smartDashboard'); if(!box)return;
    const all=Array.isArray(monthEntries)?monthEntries:[];
    const done=done423(all), planned=planned423(all);
    const total=s423(done), plannedTotal=s423(planned), potential=total+plannedTotal;
    const services=done.filter(e=>e.workType==='service'), installs=done.filter(e=>e.workType==='install');
    const plannedServices=planned.filter(e=>e.workType==='service'), plannedInstalls=planned.filter(e=>e.workType==='install');
    const returnCalls=services.filter(e=>e.isReturnCall);
    const paidServices=services.filter(e=>!e.isReturnCall);
    const goal=getWorkerGoalForMonthV556(), progress=goal?Math.min(100,pct423(total,goal)):0, left=Math.max(goal-total,0);
    const dates=[...new Set(done.map(e=>e.date).filter(Boolean))], workDays=dates.length, avg=workDays?total/workDays:0;
    const byDate=group423(done,e=>e.date||'ללא תאריך'), byWeekday=group423(done,e=>weekday423(e.date)||'ללא יום'), byClient=group423(done,e=>e.customerNumber||'ללא מספר');
    const bestDate=best423(byDate,'total'), bestWeekday=best423(byWeekday,'total'), topClient=best423(byClient,'count');
    const installAvg=installs.length?s423(installs)/installs.length:0, serviceAvg=paidServices.length?s423(paidServices)/paidServices.length:0;
    const closeRate=potential?pct423(total,potential):100;
    const topItems=topItems423(done);
    const today=formatDate(new Date());
    const todayDone=done.filter(e=>e.date===today), todayPlanned=planned.filter(e=>e.date===today);
    const insights=[];
    insights.push(progress>=100?`<li class="good">🎯 היעד הושג. אתה על ${Math.round(progress)}% — אפשר להגדיל יעד או לשמור קצב.</li>`:`<li class="warn">🎯 חסר ליעד ${money(left)}. בקצב הנוכחי כל יום עבודה שווה בערך ${money(avg)}.</li>`);
    if(todayPlanned.length) insights.push(`<li class="info">📌 להיום יש ${todayPlanned.length} עבודות מתוזמנות בשווי ${money(s423(todayPlanned))}.</li>`);
    if(planned.length) insights.push(`<li class="info">📋 צבר מתוזמן: ${planned.length} עבודות בשווי ${money(plannedTotal)}. פוטנציאל חודשי כולל: ${money(potential)}.</li>`);
    if(bestDate) insights.push(`<li class="good">🔥 היום החזק בחודש: ${heDate(bestDate)} עם ${money(byDate[bestDate].total)}.</li>`);
    if(bestWeekday) insights.push(`<li class="info">📈 יום ${esc(bestWeekday)} הוא היום החזק ביותר לפי דפוס החודש.</li>`);
    if(topClient && byClient[topClient].count>1) insights.push(`<li class="warn">👤 לקוח חוזר בולט: ${esc(topClient)} עם ${byClient[topClient].count} עבודות. כדאי לבדוק איכות/חזרתיות.</li>`);
    if(returnCalls.length) insights.push(`<li class="danger">🔁 ${returnCalls.length} קריאות חוזרות ללא תשלום. זה מדד שצריך לעקוב אחריו כי הוא אוכל זמן ולא מוסיף הכנסה.</li>`);
    if(installs.length && paidServices.length && installAvg>serviceAvg*1.6) insights.push(`<li class="good">🛠️ התקנה ממוצעת שווה הרבה יותר מקריאת שירות. שווה לתת עדיפות להתקנות כשאפשר.</li>`);
    if(!done.length) insights.push('<li class="info">עדיין אין עבודות שבוצעו בחודש הזה. הדשבורד יתמלא אחרי שמירת עבודות.</li>');
    const pills=[];
    if(bestWeekday)pills.push(`יום חזק: ${bestWeekday}`);
    if(topClient && byClient[topClient].count>1)pills.push(`לקוח חוזר: ${topClient}`);
    if(topItems[0])pills.push(`פריט מוביל: ${topItems[0].name}`);
    box.innerHTML=`
      <div class="smart-grid-v423">
        <div class="smart-card-v423"><div class="smart-title">בוצע החודש</div><div class="smart-value">${money(total)}</div><div class="smart-note">רק עבודות שבוצעו בפועל</div></div>
        <div class="smart-card-v423"><div class="smart-title">פוטנציאל כולל</div><div class="smart-value">${money(potential)}</div><div class="smart-note">בוצע + מתוזמן</div></div>
        <div class="smart-card-v423"><div class="smart-title">עמידה ביעד</div><div class="smart-value">${Math.round(progress)}%</div><div class="smart-note">${goal?'יעד: '+money(goal):'לא הוגדר יעד'}<div class="smart-progress-v423"><div style="width:${Math.max(0,Math.min(100,progress))}%"></div></div></div></div>
        <div class="smart-card-v423"><div class="smart-title">היום</div><div class="smart-value">${todayDone.length}/${todayDone.length+todayPlanned.length}</div><div class="smart-note">בוצע מתוך מתוכנן להיום</div></div>
      </div>
      <div class="smart-quick-v423">
        <div class="smart-mini-v423">התקנות שבוצעו<b>${installs.length}</b></div>
        <div class="smart-mini-v423">קריאות בתשלום<b>${paidServices.length}</b></div>
        <div class="smart-mini-v423">קריאות חוזרות<b>${returnCalls.length}</b></div>
      </div>
      <div class="smart-pill-row-v423">${pills.map(p=>`<span class="smart-pill-v423">${esc(p)}</span>`).join('')}</div>
      <div class="smart-two-v423">
        <div class="smart-section-v423"><h3>📈 מגמת הכנסות לפי ימים</h3>${renderBars423(byDate,12)}</div>
        <div class="smart-section-v423"><h3>🧠 תובנות אוטומטיות</h3><ul class="smart-insights-v423">${insights.slice(0,8).join('')}</ul></div>
      </div>
      <div class="smart-section-v423"><h3>⚖️ ניתוח מקצועי מהיר</h3>
        <div class="smart-quick-v423">
          <div class="smart-mini-v423">ממוצע התקנה<b>${money(installAvg)}</b></div>
          <div class="smart-mini-v423">ממוצע קריאה<b>${money(serviceAvg)}</b></div>
          <div class="smart-mini-v423">סגירה מול מתוזמן<b>${closeRate}%</b></div>
        </div>
      </div>
      <div class="smart-section-v423"><h3>🏆 פריטי התקנה מובילים</h3>${topItems.length?'<div class="smart-bars-v423">'+topItems.map(i=>`<div class="smart-bar-row-v423"><div>${esc(i.name)}</div><div class="smart-bar-track-v423"><div class="smart-bar-fill-v423" style="width:${Math.max(4,Math.min(100,pct423(i.total,topItems[0].total)))}%"></div></div><div>${money(i.total)}</div></div>`).join('')+'</div>':'<p class="muted">אין עדיין פריטי התקנה החודש.</p>'}</div>`;
  };
  function fixA11yButton423(){
    const btn=document.querySelector('.a11y-main-btn-v422');
    if(btn){btn.innerHTML='♿';btn.title='כלי נגישות';btn.setAttribute('aria-label','פתיחת כלי נגישות');}
    const modal=document.getElementById('accessibilityModalV422');
    if(modal) modal.innerHTML=modal.innerHTML.replace(/גרסה 4\.22/g,'גרסה ${APP_VERSION}');
  }
  const oldOpen=window.openAccessibilityStatementV422;
  if(typeof oldOpen==='function'){
    window.openAccessibilityStatementV422=function(){oldOpen();setTimeout(fixA11yButton423,20);const m=document.getElementById('accessibilityModalV422'); if(m)m.innerHTML=m.innerHTML.replace(/גרסה 4\.22/g,'גרסה ${APP_VERSION}');};
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){try{setAppVersionUI&&setAppVersionUI()}catch(e){} fixA11yButton423(); try{renderSmartDashboard()}catch(e){}},120)});
  window.addEventListener('load',function(){setTimeout(function(){try{setAppVersionUI&&setAppVersionUI()}catch(e){} fixA11yButton423(); try{renderSmartDashboard()}catch(e){}},180)});
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ document.title = "מעקב עבודה - גרסה " + APP_VERSION; }catch(e){}
  function fixVersion424(){
    try{ if(typeof setAppVersionUI === 'function') setAppVersionUI(); }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel').forEach(function(el){el.textContent = APP_VERSION;}); }catch(e){}
    try{ document.querySelectorAll('.app-version-mini span,.app-version-footer span').forEach(function(el){el.textContent = APP_VERSION;}); }catch(e){}
  }
  function fixCalendar424(){
    var cal=document.getElementById('calendar');
    if(!cal)return;
    cal.style.gridTemplateColumns='repeat(7,minmax(0,1fr))';
    cal.style.width='100%';
    cal.style.maxWidth='100%';
    cal.style.overflow='hidden';
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
  }
  function patchDashboardTopItemText424(){
    try{
      var old=window.renderSmartDashboard;
      if(typeof old !== 'function' || old.__v424Patched)return;
      window.renderSmartDashboard=function(){
        var res=old.apply(this,arguments);
        setTimeout(function(){
          document.querySelectorAll('.smart-section-v423 .smart-bar-row-v423').forEach(function(row){
            row.style.minWidth='0';
            var first=row.children && row.children[0];
            if(first){first.style.whiteSpace='normal';first.style.overflowWrap='anywhere';first.style.lineHeight='1.25';}
          });
        },0);
        return res;
      };
      window.renderSmartDashboard.__v424Patched=true;
    }catch(e){console.warn('v4.24 dashboard patch',e)}
  }
  var oldSelect=window.selectDay;
  if(typeof oldSelect === 'function'){
    window.selectDay=function(ds){
      var res=oldSelect.apply(this,arguments);
      setTimeout(fixCalendar424,0);
      return res;
    };
  }
  var oldRenderCal=window.renderCalendar;
  if(typeof oldRenderCal === 'function'){
    window.renderCalendar=function(){
      var res=oldRenderCal.apply(this,arguments);
      fixCalendar424();
      return res;
    };
  }
  document.addEventListener('DOMContentLoaded',function(){fixVersion424();fixCalendar424();patchDashboardTopItemText424();});
  window.addEventListener('load',function(){setTimeout(function(){fixVersion424();fixCalendar424();patchDashboardTopItemText424();try{ if(typeof renderSmartDashboard==='function')renderSmartDashboard(); }catch(e){}},220);});
  document.addEventListener('click',function(){setTimeout(fixCalendar424,60);});
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ document.title = "מעקב עבודה - גרסה " + APP_VERSION; }catch(e){}
  function setVersion425(){
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){el.textContent = APP_VERSION;}); }catch(e){}
  }
  function compactMoney425(text){
    var raw=String(text||'').replace(/[₪,\s]/g,'');
    var n=Number(raw);
    if(!isFinite(n)) return text;
    if(Math.abs(n)>=10000) return '₪'+Math.round(n/1000)+'K';
    if(Math.abs(n)>=1000){
      var v=(n/1000).toFixed(n%1000===0?0:1).replace('.0','');
      return '₪'+v+'K';
    }
    return '₪'+Math.round(n);
  }
  function fixCalendar425(){
    var cal=document.getElementById('calendar');
    if(!cal)return;
    var heads=cal.querySelectorAll('.weekday');
    heads.forEach(function(h){ if((h.textContent||'').trim()==='שבת') h.textContent='ש'; });
    cal.querySelectorAll('.day-total').forEach(function(el){
      if(!el.dataset.fullMoney425) el.dataset.fullMoney425=el.textContent||'';
      el.textContent=compactMoney425(el.dataset.fullMoney425);
      el.title=el.dataset.fullMoney425;
    });
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
  }
  function fixDaySections425(){
    try{
      document.querySelectorAll('#dayEntries,.day-sections-v419,.day-section-v419,.day-scroll-v419,#dayEntries .item').forEach(function(el){
        el.style.maxWidth='100%';
        el.style.minWidth='0';
        el.style.boxSizing='border-box';
        el.style.overflowX='hidden';
      });
    }catch(e){}
  }
  var oldRenderCalendar=window.renderCalendar;
  if(typeof oldRenderCalendar==='function' && !oldRenderCalendar.__v425){
    window.renderCalendar=function(){
      var res=oldRenderCalendar.apply(this,arguments);
      fixCalendar425();
      return res;
    };
    window.renderCalendar.__v425=true;
  }
  var oldRenderDay=window.renderDay;
  if(typeof oldRenderDay==='function' && !oldRenderDay.__v425){
    window.renderDay=function(){
      var res=oldRenderDay.apply(this,arguments);
      setTimeout(fixDaySections425,0);
      return res;
    };
    window.renderDay.__v425=true;
  }
  var oldSelectDay=window.selectDay;
  if(typeof oldSelectDay==='function' && !oldSelectDay.__v425){
    window.selectDay=function(ds){
      var res=oldSelectDay.apply(this,arguments);
      setTimeout(function(){fixCalendar425();fixDaySections425();},30);
      return res;
    };
    window.selectDay.__v425=true;
  }
  document.addEventListener('DOMContentLoaded',function(){setVersion425();setTimeout(function(){fixCalendar425();fixDaySections425();},160);});
  window.addEventListener('load',function(){setTimeout(function(){setVersion425();fixCalendar425();fixDaySections425();},260);});
  document.addEventListener('click',function(){setTimeout(function(){fixCalendar425();fixDaySections425();},80);});
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ document.title = "מעקב עבודה - גרסה " + APP_VERSION; }catch(e){}

  function setVersion428(){
    try{
      document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent = APP_VERSION; });
      document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent = "גרסה " + APP_VERSION; });
    }catch(e){}
  }

  function showMainStartup428(subText){
    try{
      document.body.classList.add('worker-main-loading-v428');
      if(typeof hideAll === 'function') hideAll();
      if(typeof show === 'function') show('startupView');
      if(typeof show === 'function') show('logoutBtn');
      if(typeof text === 'function') text('userLine','טוען נתונים');
      var sub=document.querySelector('#startupView .startup-sub');
      if(sub) sub.textContent=subText || 'מחשב סיכומים, עבודות ומתוזמנות...';
      var title=document.querySelector('#startupView .big-title');
      if(title) title.textContent='טוען נתונים';
    }catch(e){}
  }

  function revealWorkerAfterReady428(worker){
    try{
      document.body.classList.remove('worker-main-loading-v428');
      if(typeof hideAll === 'function') hideAll();
      if(typeof show === 'function') show('workerView');
      if(typeof show === 'function') show('logoutBtn');
      if(typeof text === 'function'){
        text('userLine', (worker && worker.name ? worker.name : 'עובד') + ' · ' + ((window.session && session.role === 'admin') ? 'צפייה כמנהל' : 'עובד'));
      }
      if(typeof setVersion428 === 'function') setVersion428();
      if(typeof cleanVisibleSlashN === 'function') cleanVisibleSlashN();
    }catch(e){ console.warn('revealWorkerAfterReady428 failed',e); }
  }

  var baseLoadMonth428 = window.loadMonth;
  var baseShowWorkerById428 = window.showWorkerById;

  window.showWorker = async function(worker, token){
    token = token || (typeof nextNavTokenV180 === 'function' ? nextNavTokenV180() : Date.now());
    window.__isLoggingOutV180 = false;
    if(!worker || !worker.id) return;

    showMainStartup428('מכין את סביבת העבודה שלך...');

    try{
      if(typeof assertWorkerCanViewV177 === 'function'){
        var gate = await assertWorkerCanViewV177(worker);
        if(typeof isStaleNavV180 === 'function' && isStaleNavV180(token)) return;
        if(!gate || !gate.ok) return;
        worker = gate.worker;
      }

      window.viewedWorker = worker;
      viewedWorker = worker;
      calendarDate = new Date();
      selectedDate = null;
      selectedType = null;
      monthEntries = [];

      if($('helloTitle')) text('helloTitle','שלום ' + (worker.name || ''));
      if($('selfMonthlyGoal')) $('selfMonthlyGoal').value = getWorkerGoalForMonthV556();
      if($('selfNewPassword')) $('selfNewPassword').value = '';

      try{ await loadSettings(); }catch(e){ console.warn('loadSettings v4.28 skipped',e); }
      if(typeof isStaleNavV180 === 'function' && isStaleNavV180(token)) return;

      showMainStartup428('טוען עבודות, סיכומים ודשבורד...');
      if(typeof baseLoadMonth428 === 'function'){
        await baseLoadMonth428.call(this, token);
      }else if(typeof loadMonth === 'function'){
        await loadMonth(token);
      }
      if(typeof isStaleNavV180 === 'function' && isStaleNavV180(token)) return;

      // רינדור אחרון אחרי שכל הנתונים כבר הגיעו — כדי שלא תהיה קפיצה מאפסים לנתונים.
      try{ renderCalendar(); }catch(e){}
      try{ renderDay(); }catch(e){}
      try{ renderStats(); }catch(e){}
      try{ if(typeof renderSmartDashboard === 'function') renderSmartDashboard(); }catch(e){}
      try{ if($('searchPanel') && !$('searchPanel').classList.contains('hidden') && typeof renderFullSummary === 'function') renderFullSummary(); }catch(e){}

      revealWorkerAfterReady428(worker);
    }catch(e){
      document.body.classList.remove('worker-main-loading-v428');
      try{ if(typeof hideWorkerLoading427 === 'function') hideWorkerLoading427(); }catch(_e){}
      console.error('showWorker v4.28 failed', e);
      alert('שגיאה בטעינת נתוני העובד: ' + (e.message || e));
      try{ showWorkerLogin(); }catch(_e){}
    }
  };

  window.showWorkerById = async function(id){
    var token = (typeof nextNavTokenV180 === 'function' ? nextNavTokenV180() : Date.now());
    window.__isLoggingOutV180 = false;
    showMainStartup428('פותח עובד וטוען נתונים...');
    try{
      if(!id) throw new Error('חסר מזהה עובד');
      var worker;
      if(typeof fetchFreshWorkerV177 === 'function') worker = await fetchFreshWorkerV177(id);
      else {
        var doc = await db.collection('workers').doc(id).get();
        worker = Object.assign({id:doc.id}, doc.data());
      }
      if(typeof isStaleNavV180 === 'function' && isStaleNavV180(token)) return;
      await window.showWorker(worker, token);
    }catch(e){
      document.body.classList.remove('worker-main-loading-v428');
      console.error('showWorkerById v4.28 failed',e);
      if(window.__isLoggingOutV180 || !window.session) return;
      alert('שגיאה בפתיחת עובד: ' + (e.message || String(e)));
      try{ showWorkerLogin(); }catch(_e){}
    }
  };

  document.addEventListener('DOMContentLoaded',function(){ setVersion428(); });
  window.addEventListener('load',function(){ setTimeout(setVersion428,250); setTimeout(setVersion428,900); setTimeout(setVersion428,1800); });
})();
;
/*
===============================================================================
CHANGELOG 4.30 - חזרה לאדמין מתוך מעקב עובד
-------------------------------------------------------------------------------
1. נוסף כפתור "חזרה לאדמין" רק כאשר מנהל פותח עובד דרך "פתח מעקב".
2. עובד רגיל שנכנס עם שם משתמש וסיסמה לא מקבל את הכפתור בכלל — לא מוסתר אחרי רגע, אלא לא נוצר.
3. התיקון הוא wrapper נקודתי סביב showWorkerById/showWorker/showAdmin/logout/showWorkerLogin, בלי לשכתב לוגיקה קיימת.
4. נשמר מקור גרסה יחיד APP_VERSION, והקובץ מוכן להעלאה כגרסה 4.30.
===============================================================================
*/
(function(){
  const PATCH_ID = "v4.30-admin-back-button";

  function isAdminSessionV430(){
    try{ return !!(window.session && session.role === "admin"); }catch(e){ return false; }
  }

  function removeAdminBackButtonV430(){
    try{
      const el = document.getElementById("adminBackToPanelV430");
      if(el) el.remove();
    }catch(e){}
  }

  function markAdminWorkerOpenV430(on){
    try{ window.__adminOpenedWorkerFromPanelV430 = !!on; }catch(e){}
  }

  function shouldShowAdminBackV430(){
    try{ return isAdminSessionV430() && window.__adminOpenedWorkerFromPanelV430 === true; }catch(e){ return false; }
  }

  function ensureAdminBackButtonV430(){
    try{
      const workerView = document.getElementById("workerView");
      if(!workerView) return;

      if(!shouldShowAdminBackV430()){
        removeAdminBackButtonV430();
        return;
      }

      let bar = document.getElementById("adminBackToPanelV430");
      if(!bar){
        bar = document.createElement("div");
        bar.id = "adminBackToPanelV430";
        bar.className = "admin-back-to-panel-v430";
        bar.innerHTML = `
          <div>
            <div class="admin-back-title-v430">מצב צפייה כמנהל</div>
            <div class="admin-back-sub-v430">פתחת מעקב של עובד מתוך האדמין</div>
          </div>
          <button type="button" class="btn-light" onclick="returnToAdminPanelV430(event)">↩ חזרה לאדמין</button>
        `;
        workerView.insertBefore(bar, workerView.firstChild);
      }
    }catch(e){
      console.warn(PATCH_ID + " ensure failed", e);
    }
  }

  window.returnToAdminPanelV430 = async function(ev){
    try{ if(ev && ev.preventDefault) ev.preventDefault(); }catch(e){}
    markAdminWorkerOpenV430(false);
    removeAdminBackButtonV430();
    try{
      if(typeof showAdmin === "function") await showAdmin();
    }catch(e){
      alert("שגיאה בחזרה לאדמין: " + (e.message || String(e)));
    }
    return false;
  };

  const oldShowWorkerByIdV430 = window.showWorkerById;
  if(typeof oldShowWorkerByIdV430 === "function"){
    window.showWorkerById = async function(id){
      // אם הקריאה בוצעה בזמן שיש session של מנהל — זה אומר שהמנהל לחץ "פתח מעקב".
      // אם זו כניסת עובד/שחזור workerSession — הדגל כבוי, ולכן הכפתור לא ייווצר.
      markAdminWorkerOpenV430(isAdminSessionV430());
      const result = await oldShowWorkerByIdV430.apply(this, arguments);
      setTimeout(ensureAdminBackButtonV430, 0);
      return result;
    };
  }

  const oldShowWorkerV430 = window.showWorker;
  if(typeof oldShowWorkerV430 === "function"){
    window.showWorker = async function(worker){
      const result = await oldShowWorkerV430.apply(this, arguments);
      ensureAdminBackButtonV430();
      return result;
    };
  }

  const oldShowAdminV430 = window.showAdmin;
  if(typeof oldShowAdminV430 === "function"){
    window.showAdmin = async function(){
      markAdminWorkerOpenV430(false);
      removeAdminBackButtonV430();
      return oldShowAdminV430.apply(this, arguments);
    };
  }

  const oldShowWorkerLoginV430 = window.showWorkerLogin;
  if(typeof oldShowWorkerLoginV430 === "function"){
    window.showWorkerLogin = function(){
      markAdminWorkerOpenV430(false);
      removeAdminBackButtonV430();
      return oldShowWorkerLoginV430.apply(this, arguments);
    };
  }

  const oldLogoutV430 = window.logout;
  if(typeof oldLogoutV430 === "function"){
    window.logout = async function(){
      markAdminWorkerOpenV430(false);
      removeAdminBackButtonV430();
      return oldLogoutV430.apply(this, arguments);
    };
  }

  document.addEventListener("DOMContentLoaded", function(){
    removeAdminBackButtonV430();
    try{ if(typeof enforceAppVersionUI === "function") enforceAppVersionUI(); }catch(e){}
  });
})();
;
/*
===============================================================================
CHANGELOG 4.32 - תיקון עריכת התקנה: עדכון טקסט פריטים אחרי שינוי כמות/מחיר
-------------------------------------------------------------------------------
1. תיקון נקודתי בלבד לפונקציית saveEntryEdit האחרונה.
2. בבדיקת העבודה המקורית משתמשים ישירות ב-monthEntries הקיים בקובץ, ולא ב-window.monthEntries.
   הסיבה: monthEntries מוגדר כ-let ולכן אינו נגיש דרך window; בגלל זה נשמר רק הסכום ולא items.
3. בשמירת עריכת התקנה נשמרים מחדש items, amount, installKind/priceType ו-description.
4. לאחר השמירה מתבצע loadMonth(), ולכן הטקסט בכרטיס העבודה נבנה מחדש מה-items המעודכנים.
5. לא בוצע שינוי בלוגיקת כניסה, אדמין, עובד, מנויים, גיבוי, מחירון או כפתור חזרה לאדמין.
===============================================================================
*/
(function(){
  function byIdV432(id){ return document.getElementById(id); }
  function escV432(s){
    try{ return esc(s); }catch(e){
      return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});
    }
  }
  function kindLabelV432(kind){
    try{ if(typeof kindLabelV415 === 'function') return kindLabelV415(kind); }catch(e){}
    kind=String(kind||'fiber').toLowerCase();
    return kind==='rf' ? 'RF' : 'סיב';
  }
  function getCurrentEntriesV432(){
    try{ if(Array.isArray(monthEntries)) return monthEntries; }catch(e){}
    try{ if(Array.isArray(window.monthEntries)) return window.monthEntries; }catch(e){}
    return [];
  }
  function getEditedDataV432(){
    if(typeof window.getEditedInstallItems === 'function') return window.getEditedInstallItems();
    if(typeof window.getEditedInstallItemsV415 === 'function') return window.getEditedInstallItemsV415();
    if(typeof getEditedInstallItems === 'function') return getEditedInstallItems();
    return null;
  }
  function descriptionForEditedInstallV432(edited){
    if(edited && edited.kind){
      return edited.kind === 'rf' ? 'התקנת RF' : 'התקנת סיב';
    }
    return 'התקנה';
  }
  function showSavedNoticeV432(){
    try{
      var box=byIdV432('entryMsg');
      if(box) box.innerHTML='<div class="notice">העריכה נשמרה ✅ הכמויות, המחירים והפירוט עודכנו.</div>';
    }catch(e){}
    try{ if(typeof showSavedNoticeAfterEditV417 === 'function') showSavedNoticeAfterEditV417(); }catch(e){}
  }

  window.saveEntryEdit = async function(){
    const id = val('editEntryId');
    const customerNumber = val('editEntryCustomer');
    const address = val('editEntryAddress');
    const notes = val('editEntryNotes');
    let amount = Number(val('editEntryAmount') || 0);
    const editMsg = byIdV432('editEntryMsg');

    if(!customerNumber || !/^\d+$/.test(customerNumber)){
      if(editMsg) editMsg.innerHTML='<p class="danger">מספר לקוח חייב להיות ספרות בלבד.</p>';
      return;
    }
    if(!address){
      if(editMsg) editMsg.innerHTML='<p class="danger">חובה למלא כתובת.</p>';
      return;
    }

    const original = getCurrentEntriesV432().find(function(x){ return x && x.id === id; });
    const update = {
      customerNumber: customerNumber,
      address: address,
      notes: notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if(original && original.workType === 'install'){
      const edited = getEditedDataV432();
      if(!edited || !Array.isArray(edited.items) || !edited.items.length){
        if(editMsg) editMsg.innerHTML='<p class="danger">חובה לבחור לפחות פריט התקנה אחד.</p>';
        return;
      }
      update.items = edited.items.map(function(i){
        var q = Number(i.quantity || 0);
        var price = Number(i.price || 0);
        return {
          id: i.id || '',
          name: i.name || '',
          price: price,
          quantity: q,
          inputMode: i.inputMode || 'qty',
          installKind: i.installKind || edited.kind || original.installKind || original.priceType || '',
          priceType: i.priceType || edited.kind || original.priceType || original.installKind || '',
          total: Number(i.total !== undefined ? i.total : (q * price))
        };
      });
      update.amount = Number(edited.total || update.items.reduce(function(sum,i){ return sum + Number(i.total || 0); },0));
      if(edited.kind){
        update.installKind = edited.kind;
        update.priceType = edited.kind;
      }
      update.description = descriptionForEditedInstallV432(edited);
    }else{
      if(Number.isNaN(amount) || amount < 0){
        if(editMsg) editMsg.innerHTML='<p class="danger">סכום לא תקין.</p>';
        return;
      }
      update.amount = amount;
    }

    try{
      if(editMsg) editMsg.innerHTML='<div class="notice">שומר...</div>';
      await db.collection('workEntries').doc(id).update(update);
      try{ hide('editEntryPanel'); }catch(e){ var p=byIdV432('editEntryPanel'); if(p)p.classList.add('hidden'); }
      await loadMonth();
      showSavedNoticeV432();
      try{ if(typeof cleanVisibleSlashN === 'function') cleanVisibleSlashN(); }catch(e){}
    }catch(e){
      if(editMsg) editMsg.innerHTML='<p class="danger">שגיאה בשמירה: '+escV432(e.message || e)+'</p>';
    }
  };

  try{ if(typeof setAppVersionUI === 'function') setAppVersionUI(); }catch(e){}
})();
;
/* ===== v4.33: Boot guard - בלי הבהוב מסך כניסה כשיש התחברות שמורה ===== */
(function(){
  function releaseBootGuardV433(){
    try{ document.body.classList.remove("app-booting-v433"); }catch(e){}
  }
  window.releaseBootGuardV433 = releaseBootGuardV433;

  function wrapBootReleaseV433(fnName){
    try{
      var original = window[fnName];
      if(typeof original !== "function" || original.__bootReleaseWrappedV433) return;
      var wrapped = function(){
        var result;
        try{ result = original.apply(this, arguments); }
        catch(err){ releaseBootGuardV433(); throw err; }

        if(result && typeof result.then === "function"){
          return result.finally(function(){ releaseBootGuardV433(); });
        }
        releaseBootGuardV433();
        return result;
      };
      wrapped.__bootReleaseWrappedV433 = true;
      window[fnName] = wrapped;
    }catch(e){}
  }

  function installBootGuardWrappersV433(){
    [
      "showWorkerLogin",
      "showWorker",
      "showWorkerById",
      "showAdmin",
      "showExpiredView",
      "showRegister"
    ].forEach(wrapBootReleaseV433);
  }

  installBootGuardWrappersV433();
  document.addEventListener("DOMContentLoaded", installBootGuardWrappersV433);
  window.addEventListener("load", function(){
    installBootGuardWrappersV433();
    setTimeout(function(){
      // רשת איטית / שגיאה לא צפויה: לא משאירים את המשתמש תקוע על טוען נתונים לנצח.
      releaseBootGuardV433();
    }, 60000);
  });
})();
;
/*
===============================================================================
CHANGELOG 4.36 - דשבורד חכם + מניעת ספירה כפולה של סידור מתוזמן שבוצע
-------------------------------------------------------------------------------
1. דשבורד חכם קיבל כרטיס מרכזי: כמה כסף צריך לעשות בכל יום עבודה שנשאר כדי להגיע ליעד.
2. נוספו נתונים מקצועיים: כמה ימים נשארו בחודש, יעד יומי לפי כל הימים שנותרו, יעד יומי לפי ימי עבודה בלבד,
   פער מול הקצב הנוכחי, תחזית סוף חודש, וכמה עבודות ממוצעות צריך לפי ממוצע העבודה הנוכחי.
3. סימון עבודה מתוזמנת כבוצעה מסמן אותה כ-convertedFromPlanned, כדי שהדשבורד יבין שזה לא ביקור חוזר חדש.
4. תובנת "לקוח חוזר" בדשבורד מתעלמת מאותו לקוח באותו יום/כתובת/סוג עבודה כאשר מדובר בהמרה ממתוזמן לבוצע.
5. תיקון תוספתי בלבד: לא נמחקו פונקציות קיימות, לא שונה לוגין, לא שונה אדמין, לא שונה שמירה/גיבוי/ייצוא.
===============================================================================
*/
(function(){
  try{ window.APP_VERSION = APP_VERSION; if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}

  function money436(n){try{return money(n)}catch(e){return '₪'+Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0})}}
  function esc436(s){try{return esc(s)}catch(e){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}}
  function date436(s){try{return heDate(s)}catch(e){return s||''}}
  function sum436(arr){return (arr||[]).reduce(function(a,e){return a+Number(e&&e.amount||0)},0)}
  function isPlanned436(e){try{return (typeof isPlannedV49==='function' && isPlannedV49(e)) || e.entryStatus==='planned'}catch(_e){return e&&e.entryStatus==='planned'}}
  function done436(arr){return (arr||[]).filter(function(e){return !isPlanned436(e)})}
  function planned436(arr){return (arr||[]).filter(isPlanned436)}
  function pct436(a,b){return b?Math.round((Number(a||0)/Number(b||0))*100):0}
  function today436(){try{return formatDate(new Date())}catch(e){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}}
  function parse436(s){try{return parseDate(s)}catch(e){var p=String(s||'').split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}}
  function remainingDays436(onlyWorkDays){
    try{
      var base=calendarDate instanceof Date ? calendarDate : new Date();
      var now=new Date();
      var y=base.getFullYear(), m=base.getMonth();
      var start=(now.getFullYear()===y && now.getMonth()===m)?now.getDate():1;
      var last=new Date(y,m+1,0).getDate();
      var count=0;
      for(var d=start; d<=last; d++){
        var dt=new Date(y,m,d);
        if(onlyWorkDays && dt.getDay()===6) continue;
        count++;
      }
      return Math.max(count,0);
    }catch(e){return 0}
  }
  function group436(arr,keyFn){
    var o={};
    (arr||[]).forEach(function(e){
      var k=keyFn(e)||'לא ידוע';
      if(!o[k])o[k]={count:0,total:0,items:[]};
      o[k].count++; o[k].total+=Number(e.amount||0); o[k].items.push(e);
    });
    return o;
  }
  function best436(o,field){var ks=Object.keys(o||{});return ks.length?ks.sort(function(a,b){return Number(o[b][field]||0)-Number(o[a][field]||0)})[0]:''}
  function weekday436(dateStr){try{return ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][parse436(dateStr).getDay()]||''}catch(e){return ''}}
  function monthDay436(dateStr){try{return date436(dateStr).slice(0,5)}catch(e){return dateStr||''}}
  function trendMode436(){
    // v5.11: מקור אמת קטן לבחירת טווח מגמת ההכנסות. נשמר מקומית בלבד ולא משפיע על נתוני החודש/סיכומים.
    try{ return localStorage.getItem('dashboardTrendRangeV511') || 'month'; }catch(e){ return 'month'; }
  }
  function trendLabel436(mode){
    if(mode==='7') return '7 ימים אחרונים';
    if(mode==='14') return '14 ימים אחרונים';
    if(mode==='30') return '30 ימים אחרונים';
    return 'מתחילת החודש';
  }
  function dateKey436(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function trendEntries436(monthDone){
    // v5.11: מתחילת החודש נשאר בדיוק כמו v5.10. רק מצבי 7/14/30 משתמשים בכל עבודות העובד שנטענו.
    var mode=trendMode436();
    if(mode==='month') return monthDone || [];
    var days=Number(mode||0);
    if(!days) return monthDone || [];
    var all=Array.isArray(window.workerAllEntriesV511) ? window.workerAllEntriesV511 : (monthDone || []);
    var base=calendarDate instanceof Date ? calendarDate : new Date();
    var now=new Date();
    var end;
    if(now.getFullYear()===base.getFullYear() && now.getMonth()===base.getMonth()){
      end=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    }else{
      end=new Date(base.getFullYear(),base.getMonth()+1,0);
    }
    var start=new Date(end.getFullYear(),end.getMonth(),end.getDate()-(days-1));
    var startKey=dateKey436(start), endKey=dateKey436(end);
    return done436(all).filter(function(e){return e && e.date && e.date>=startKey && e.date<=endKey;});
  }
  window.selectDashboardTrendRangeV511=function(value){
    // v5.11: שינוי בחירת התצוגה בלבד; לא משנה monthEntries, לא משנה חיפוש, ולא משנה חישובי יעד.
    try{ localStorage.setItem('dashboardTrendRangeV511', value || 'month'); }catch(e){}
    try{ renderSmartDashboard(); }catch(e){ console.warn('trend range refresh failed', e); }
  };
  function renderTrendControls436(){
    var mode=trendMode436();
    return '<div class="smart-trend-head-v511"><h3>📈 מגמת הכנסות לפי ימים</h3><label class="smart-trend-filter-v511">טווח מגמה <select onchange="selectDashboardTrendRangeV511(this.value)">'+
      '<option value="month" '+(mode==='month'?'selected':'')+'>מתחילת החודש</option>'+
      '<option value="7" '+(mode==='7'?'selected':'')+'>7 ימים אחרונים</option>'+
      '<option value="14" '+(mode==='14'?'selected':'')+'>14 ימים אחרונים</option>'+
      '<option value="30" '+(mode==='30'?'selected':'')+'>30 ימים אחרונים</option>'+
      '</select></label></div><div class="smart-trend-note-v511">מצב 30 ימים אחרונים יכול לכלול גם נתונים מהחודש הקודם. הסיכומים החודשיים לא משתנים.</div>';
  }
  function renderBars436(obj,limit){
    // v5.11: הפונקציה עדיין מקבלת אובייקט מקובץ הדשבורד הקיים, אבל התוכן כבר מגיע לפי הטוגל שנבחר.
    // הפרמטר limit נשאר בחתימה כדי לא לשבור קריאות ישנות, ואינו משמש לחיתוך נתונים.
    var rows=Object.keys(obj||{}).sort();
    var max=Math.max(1,...rows.map(function(k){return Number(obj[k].total||0)}));
    if(!rows.length)return '<p class="muted">אין מספיק נתונים להצגת מגמה עבור '+esc436(trendLabel436(trendMode436()))+'.</p>';
    return '<div class="smart-bars-v423">'+rows.map(function(k){return '<div class="smart-bar-row-v423"><div>'+esc436(monthDay436(k))+'</div><div class="smart-bar-track-v423"><div class="smart-bar-fill-v423" style="width:'+Math.max(4,Math.round((obj[k].total/max)*100))+'%"></div></div><div>'+money436(obj[k].total||0)+'</div></div>'}).join('')+'</div>';
  }
  function topItems436(entries){
    var o={};
    (entries||[]).forEach(function(e){(e.items||[]).forEach(function(i){var k=i.name||'פריט'; if(!o[k])o[k]={qty:0,total:0}; o[k].qty+=Number(i.quantity||0); o[k].total+=Number(i.total||0)})});
    return Object.keys(o).sort(function(a,b){return o[b].total-o[a].total}).slice(0,5).map(function(k){return {name:k,qty:o[k].qty,total:o[k].total}});
  }
  function visitKey436(e){
    // מפתח ביקור לצורך דשבורד בלבד. מונע מצב שבו סידור מתוזמן שהומר לבוצע נראה כמו ביקור חוזר.
    return [e.customerNumber||'', e.date||'', String(e.address||'').trim().toLowerCase(), e.workType||'', e.convertedFromPlanned?'converted':'normal'].join('|');
  }
  function uniqueVisits436(entries){
    var seen={}, out=[];
    (entries||[]).forEach(function(e){
      var k=visitKey436(e);
      if(seen[k]) return;
      seen[k]=1; out.push(e);
    });
    return out;
  }
  function repeatedClients436(entries){
    var visits=uniqueVisits436(entries).filter(function(e){return e && e.customerNumber});
    var by={};
    visits.forEach(function(e){
      var k=e.customerNumber;
      if(!by[k]) by[k]={count:0,total:0,items:[]};
      by[k].count++; by[k].total+=Number(e.amount||0); by[k].items.push(e);
    });
    return by;
  }

  // תיקון נקודתי: כשמסמנים סידור מתוזמן כבוצע, מסמנים שזה הגיע ממתוזמן ולא ביקור חוזר חדש.
  var previousMarkDone436 = window.markEntryDoneV49;
  window.markEntryDoneV49 = async function(id){
    if(!id) return;
    var e=(Array.isArray(monthEntries)?monthEntries:[]).find(function(x){return x.id===id});
    var wasPlanned=isPlanned436(e);
    if(!wasPlanned && typeof previousMarkDone436==='function') return previousMarkDone436(id);
    var label=e ? ((e.workType==='install'?'ההתקנה':'קריאת השירות')+(e.customerNumber?' ללקוח '+e.customerNumber:'')) : 'העבודה';
    if(!confirm('לסמן את '+label+' כבוצע ולהכניס להתחשבנות?')) return;
    try{
      await db.collection('workEntries').doc(id).set({
        entryStatus:'done',
        convertedFromPlanned:true,
        plannedConvertedAt:new Date().toISOString(),
        doneAt:new Date().toISOString(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      if($('entryMsg')) $('entryMsg').innerHTML='<div class="notice">העבודה סומנה כבוצעה ונכנסה להתחשבנות ✅<br>הדשבורד לא יספור אותה כביקור חוזר נוסף.</div>';
      await loadMonth();
    }catch(err){ alert('שגיאה בסימון בוצע: '+(err.code||err.message||err)); }
  };

  function normInstallName500(s){
    return String(s||'')
      .replace(/[‎‏]/g,'')
      .replace(/[-–—]/g,'-')
      .replace(/\s+/g,' ')
      .trim();
  }
  function isNewFiberModemInstall500(e){
    var target='התקנת שקע סיב חדש - כולל מודם';
    var targetNorm=normInstallName500(target);
    return !!(e && (e.items||[]).some(function(i){
      return Number(i.quantity||0)>0 && normInstallName500(i.name)===targetNorm;
    }));
  }
  function isRfInstall500(e){
    if(!e || e.workType!=='install') return false;
    function isRfValue(v){ return String(v||'').toLowerCase()==='rf' || String(v||'').toUpperCase()==='RF'; }
    if(isRfValue(e.installKind) || isRfValue(e.priceType) || isRfValue(e.category)) return true;
    if(String(e.description||'').toLowerCase().indexOf('rf')!==-1) return true;
    var items=e.items||[];
    if(items.length && items.some(function(i){ return isRfValue(i.installKind) || isRfValue(i.priceType) || isRfValue(i.category); })) return true;
    return false;
  }

  window.renderSmartDashboard=function(){
    var box=$('smartDashboard'); if(!box)return;
    var all=Array.isArray(monthEntries)?monthEntries:[];
    var done=done436(all), planned=planned436(all);
    var total=sum436(done), plannedTotal=sum436(planned), potential=total+plannedTotal;
    var services=done.filter(function(e){return e.workType==='service'}), installs=done.filter(function(e){return e.workType==='install'});
    var plannedServices=planned.filter(function(e){return e.workType==='service'}), plannedInstalls=planned.filter(function(e){return e.workType==='install'});
    var returnCalls=services.filter(function(e){return e.isReturnCall});
    var paidServices=services.filter(function(e){return !e.isReturnCall});
    var goal=getWorkerGoalForMonthV556(), left=Math.max(goal-total,0), progress=goal?Math.min(100,pct436(total,goal)):0;
    var dates=[...new Set(done.map(function(e){return e.date}).filter(Boolean))], workDays=dates.length, avg=workDays?total/workDays:0;
    // v4.98 CORE UPDATE:
    // מקור אמת יחיד לחישובי יעד: ימי עבודה שנשארו אחרי שבתות וימי חופש עתידיים, עם חישוב "נשאר לך לעבוד" ללא היום וללא חופש עתידי.
    // אם פונקציות ימי החופש עדיין לא נטענו, נשאר fallback לחישוב הישן כדי לא לשבור טעינה.
    var remainingWork=(typeof window.remainingWorkDaysWithVacationsV437==='function') ? window.remainingWorkDaysWithVacationsV437() : remainingDays436(true);
    var workDaysInMonth=(typeof window.regularWorkDaysInMonthV496==='function') ? window.regularWorkDaysInMonthV496() : (workDays + remainingWork);
    var vacationCount=Array.isArray(window.vacationDaysV437) ? window.vacationDaysV437.length : 0;
    function isVacationDashboardV498(dateStr){
      try{
        if(typeof window.isVacationDayV437==='function') return !!window.isVacationDayV437(dateStr);
        if(typeof window.isVacationDayV489==='function') return !!window.isVacationDayV489(dateStr);
        return Array.isArray(window.vacationDaysV437) && window.vacationDaysV437.indexOf(dateStr)>=0;
      }catch(e){
        return Array.isArray(window.vacationDaysV437) && window.vacationDaysV437.indexOf(dateStr)>=0;
      }
    }
    function workdayCountInRangeV498(fromDay,toDay){
      try{
        var base=calendarDate instanceof Date ? calendarDate : new Date();
        var y=base.getFullYear(), m=base.getMonth(), last=new Date(y,m+1,0).getDate();
        var a=Math.max(1,Number(fromDay||1)), b=Math.min(last,Number(toDay||last)), c=0;
        for(var d=a; d<=b; d++){
          var ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
          var dt=new Date(y,m,d);
          if(dt.getDay()!==6 && !isVacationDashboardV498(ds)) c++;
        }
        return Math.max(c,0);
      }catch(e){return 0;}
    }
    var now497=new Date();
    var shownYear497=(calendarDate instanceof Date ? calendarDate : now497).getFullYear();
    var shownMonth497=(calendarDate instanceof Date ? calendarDate : now497).getMonth();
    var lastDay497=new Date(shownYear497,shownMonth497+1,0).getDate();
    var isCurrentMonth497=(now497.getFullYear()===shownYear497 && now497.getMonth()===shownMonth497);
    var elapsedWorkDays497=isCurrentMonth497 ? workdayCountInRangeV498(1,now497.getDate()) : (new Date(shownYear497,shownMonth497,lastDay497)<new Date(now497.getFullYear(),now497.getMonth(),1) ? workdayCountInRangeV498(1,lastDay497) : 0);
    var remainingWorkNoToday497=isCurrentMonth497 ? workdayCountInRangeV498(now497.getDate()+1,lastDay497) : (new Date(shownYear497,shownMonth497,1)>new Date(now497.getFullYear(),now497.getMonth(),now497.getDate()) ? workdayCountInRangeV498(1,lastDay497) : 0);
    var needPerWorkDay=left>0 && remainingWork ? left/remainingWork : 0;
    var monthProjection=done.length ? total + (avg * remainingWork) : 0;
    var forecastFormulaText=done.length ? ('בוצע בפועל '+money436(total)+' + ממוצע ליום עבודה '+money436(avg)+' × '+remainingWork+' ימי עבודה שנשארו') : 'אין עדיין עבודות שבוצעו בפועל לחישוב תחזית';
    var projectedGap=goal ? monthProjection-goal : 0;
    var avgJob=done.length ? total/done.length : 0;
    var jobsNeeded=left>0 && avgJob ? Math.ceil(left/avgJob) : 0;
    var byDate=group436(done,function(e){return e.date||'ללא תאריך'});
    // v5.11: מגמת ההכנסות יכולה לעבוד על טווח שונה מהחודש, אך כל שאר הסיכומים נשארים לפי החודש הנבחר.
    var trendDone=trendEntries436(done);
    var trendByDate=group436(trendDone,function(e){return e.date||'ללא תאריך'});
    var byWeekday=group436(done,function(e){return weekday436(e.date)||'ללא יום'});
    var byClient=repeatedClients436(done);
    var bestDate=best436(byDate,'total'), bestWeekday=best436(byWeekday,'total'), topClient=best436(byClient,'count');
    var installAvg=installs.length?sum436(installs)/installs.length:0, serviceAvg=paidServices.length?sum436(paidServices)/paidServices.length:0;
    var closeRate=potential?pct436(total,potential):100;
    var topItems=topItems436(done);
    var today=today436();
    var todayDone=done.filter(function(e){return e.date===today}), todayPlanned=planned.filter(function(e){return e.date===today});
    var convertedCount=done.filter(function(e){return e.convertedFromPlanned===true}).length;

    // v5.00 Dashboard classification:
    // התקנת סיב נספרת רק אם נבחר הפריט המדויק "התקנת שקע סיב חדש - כולל מודם".
    // RF נספר לפי סוג התקנה/מחירון RF. כל התקנת סיב אחרת נספרת כפקודת Change.
    var rfInstalls500=installs.filter(isRfInstall500);
    var fiberInstalls500=installs.filter(function(e){ return !isRfInstall500(e) && isNewFiberModemInstall500(e); });
    // v5.67: פירוט CN/CH נספר רק מתוך התקנות סיב שמכילות את הפריט המחייב "התקנת שקע סיב חדש - כולל מודם".
    // כך פק״עות CN/CH מסוג Change או פריטים אחרים לא מנפחות את מדד התקנות הסיב.
    var fiberCnInstalls567=fiberInstalls500.filter(function(e){ return String(e.pekaType||'').trim().toUpperCase()==='CN'; });
    var fiberChInstalls567=fiberInstalls500.filter(function(e){ return String(e.pekaType||'').trim().toUpperCase()==='CH'; });
    var changeOrders500=installs.filter(function(e){ return !isRfInstall500(e) && !isNewFiberModemInstall500(e); });

    var insights=[];
    if(goal){
      insights.push(progress>=100?'<li class="good">🎯 היעד הושג. אתה על '+Math.round(progress)+'% — עכשיו אפשר להגדיל יעד או לשמור קצב.</li>':'<li class="warn">🎯 חסר ליעד '+money436(left)+'. צריך עוד '+money436(needPerWorkDay)+' לכל יום עבודה כדי להגיע ליעד — זה אותו חישוב שמופיע בכרטיס העליון.</li>');
      insights.push(projectedGap>=0?'<li class="good">📈 לפי הקצב הנוכחי, תחזית סוף חודש: '+money436(monthProjection)+' — מעל היעד בכ־'+money436(projectedGap)+'.</li>':'<li class="warn">📉 לפי הקצב הנוכחי, תחזית סוף חודש: '+money436(monthProjection)+' — חסר כ־'+money436(Math.abs(projectedGap))+'.</li>');
      insights.push('<li class="info">🗓️ עד היום נספרו '+elapsedWorkDays497+' ימי עבודה בחודש ללא שבתות וללא ימי חופש. ממחר נשארו '+remainingWorkNoToday497+' ימי עבודה — לא כולל היום.</li>');
      if(jobsNeeded) insights.push('<li class="info">🧮 לפי ממוצע עבודה נוכחי, צריך עוד בערך '+jobsNeeded+' עבודות ממוצעות כדי לסגור את היעד.</li>');
    }else{
      insights.push('<li class="info">🎯 לא הוגדר יעד חודשי. ברגע שתגדיר יעד, אחשב כמה צריך לעשות כל יום.</li>');
    }
    if(convertedCount) insights.push('<li class="good">✅ '+convertedCount+' עבודות הומרו ממתוזמן לבוצע. הן נספרות כביצוע רגיל, לא כביקור חוזר נוסף.</li>');
    if(todayPlanned.length) insights.push('<li class="info">📌 להיום יש '+todayPlanned.length+' עבודות מתוזמנות בשווי '+money436(sum436(todayPlanned))+'.</li>');
    if(planned.length) insights.push('<li class="info">📋 צבר מתוזמן: '+planned.length+' עבודות בשווי '+money436(plannedTotal)+'. פוטנציאל חודשי כולל: '+money436(potential)+'.</li>');
    if(bestDate) insights.push('<li class="good">🔥 היום החזק בחודש: '+date436(bestDate)+' עם '+money436(byDate[bestDate].total)+'.</li>');
    if(bestWeekday) insights.push('<li class="info">📈 יום '+esc436(bestWeekday)+' הוא היום החזק ביותר לפי דפוס החודש.</li>');
    if(topClient && byClient[topClient].count>1) insights.push('<li class="warn">👤 לקוח חוזר אמיתי: '+esc436(topClient)+' עם '+byClient[topClient].count+' ביקורים שונים החודש. המרות ממתוזמן לבוצע לא נספרות כאן כפעמיים.</li>');
    if(returnCalls.length) insights.push('<li class="danger">🔁 '+returnCalls.length+' קריאות חוזרות ללא תשלום. זה מדד שצריך לעקוב אחריו כי הוא אוכל זמן ולא מוסיף הכנסה.</li>');
    if(installs.length) insights.push('<li class="info">🧾 פירוט התקנות: '+fiberInstalls500.length+' התקנות סיב (CN '+fiberCnInstalls567.length+' / CH '+fiberChInstalls567.length+'), '+rfInstalls500.length+' התקנות RF, '+changeOrders500.length+' פקודות Change.</li>');
    if(installs.length && paidServices.length && installAvg>serviceAvg*1.6) insights.push('<li class="good">🛠️ התקנה ממוצעת שווה הרבה יותר מקריאת שירות. שווה לתת עדיפות להתקנות כשאפשר.</li>');
    if(!done.length) insights.push('<li class="info">עדיין אין עבודות שבוצעו בחודש הזה. הדשבורד יתמלא אחרי שמירת עבודות.</li>');

    var pills=[];
    if(bestWeekday)pills.push('יום חזק: '+bestWeekday);
    if(topClient && byClient[topClient].count>1)pills.push('לקוח חוזר: '+topClient);
    if(topItems[0])pills.push('פריט מוביל: '+topItems[0].name);

    box.innerHTML=`
      <div class="smart-grid-v423">
        <div class="smart-card-v423"><div class="smart-title">בוצע החודש</div><div class="smart-value">${money436(total)}</div><div class="smart-note">רק עבודות שבוצעו בפועל</div></div>
        <div class="smart-card-v423 smart-goal-focus-v436"><div class="smart-title">צריך לכל יום עבודה</div><div class="smart-value">${goal?money436(needPerWorkDay):'—'}</div><div class="smart-note">כדי להגיע ליעד החודשי</div></div>
        <div class="smart-card-v423"><div class="smart-title">עמידה ביעד</div><div class="smart-value">${Math.round(progress)}%</div><div class="smart-note">${goal?'יעד: '+money436(goal):'לא הוגדר יעד'}<div class="smart-progress-v423"><div style="width:${Math.max(0,Math.min(100,progress))}%"></div></div></div></div>
        <div class="smart-card-v423"><div class="smart-title">פוטנציאל כולל</div><div class="smart-value">${money436(potential)}</div><div class="smart-note">בוצע + מתוזמן</div></div>
      </div>
      <div class="smart-subgrid-v436">
        <div class="smart-tip-v436 ${left<=0&&goal?'smart-success-v436':''}">חסר ליעד<b>${goal?money436(left):'—'}</b><div class="smart-small-note-v436">יעד חודשי פחות ביצוע בפועל</div></div>
        <div class="smart-tip-v436 ${projectedGap<0&&goal?'smart-warning-v436':'smart-success-v436'}">תחזית סוף חודש<b>${done.length?money436(monthProjection):'—'}</b><div class="smart-small-note-v436">${forecastFormulaText}</div></div>
        <div class="smart-tip-v436">ממוצע ליום עבודה<b>${done.length?money436(avg):'—'}</b><div class="smart-small-note-v436">לפי ${workDays} ימים שבהם נשמר ביצוע</div></div>
      </div>
      <div class="smart-quick-v423">
        <div class="smart-mini-v423">התקנות שבוצעו<b>${installs.length}</b></div>
        <div class="smart-mini-v423">קריאות בתשלום<b>${paidServices.length}</b></div>
        <div class="smart-mini-v423">קריאות חוזרות<b>${returnCalls.length}</b></div>
      </div>
      <div class="smart-quick-v423">
        <div class="smart-mini-v423">התקנות סיב<b>${fiberInstalls500.length}</b><span class="smart-small-note-v436">רק עם התקנת שקע סיב חדש כולל מודם<br>מתוכן CN: ${fiberCnInstalls567.length} · CH: ${fiberChInstalls567.length}</span></div>
        <div class="smart-mini-v423">התקנות RF<b>${rfInstalls500.length}</b><span class="smart-small-note-v436">לפי מחירון / סוג RF</span></div>
        <div class="smart-mini-v423">פקודות Change<b>${changeOrders500.length}</b><span class="smart-small-note-v436">סיב ללא פריט התקנת מודם</span></div>
      </div>
      <div class="smart-quick-v423">
        <div class="smart-mini-v423">עבודות ממוצעות ליעד<b>${jobsNeeded||0}</b><span class="smart-small-note-v436">לפי ממוצע ${money436(avgJob)}</span></div>
        <div class="smart-mini-v423">היום<b>${todayDone.length}/${todayDone.length+todayPlanned.length}</b><span class="smart-small-note-v436">בוצע מתוך מתוכנן</span></div>
        <div class="smart-mini-v423">סגירה מול מתוזמן<b>${closeRate}%</b></div>
      </div>
      <div class="smart-pill-row-v423">${pills.map(function(p){return '<span class="smart-pill-v423">'+esc436(p)+'</span>'}).join('')}</div>
      <div class="smart-two-v423">
        <div class="smart-section-v423">${renderTrendControls436()}${renderBars436(trendByDate)}</div>
        <div class="smart-section-v423"><h3>🧠 תובנות אוטומטיות</h3><ul class="smart-insights-v423">${insights.slice(0,9).join('')}</ul></div>
      </div>
      <div class="smart-section-v423"><h3>⚖️ ניתוח מקצועי מהיר</h3>
        <div class="smart-quick-v423">
          <div class="smart-mini-v423">ממוצע התקנה<b>${money436(installAvg)}</b></div>
          <div class="smart-mini-v423">ממוצע קריאה<b>${money436(serviceAvg)}</b></div>
          <div class="smart-mini-v423">מתוזמן: התקנות / קריאות<b>${plannedInstalls.length} / ${plannedServices.length}</b></div>
        </div>
      </div>
      <div class="smart-section-v423"><h3>🏆 פריטי התקנה מובילים</h3>${topItems.length?'<div class="smart-bars-v423">'+topItems.map(function(i){return '<div class="smart-bar-row-v423"><div>'+esc436(i.name)+'</div><div class="smart-bar-track-v423"><div class="smart-bar-fill-v423" style="width:'+Math.max(4,Math.min(100,pct436(i.total,topItems[0].total)))+'%"></div></div><div>'+money436(i.total)+'</div></div>'}).join('')+'</div>':'<p class="muted">אין עדיין פריטי התקנה החודש.</p>'}</div>`;
    // v4.96: אזור ימי עבודה/חופש מוזן מאותו חישוב של הכרטיסים והתובנות.
    try{
      if(typeof window.renderVacationGoalStripV496==='function'){
        window.renderVacationGoalStripV496(box,{regular:workDaysInMonth,vacCount:vacationCount,rem:remainingWork,remNoToday:remainingWorkNoToday497,elapsedWork:elapsedWorkDays497,need:needPerWorkDay,left:left,forecast:monthProjection,total:total,avg:avg,goal:goal,doneCount:done.length});
      }
    }catch(e){}
  };

  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){try{setAppVersionUI&&setAppVersionUI()}catch(e){} try{renderSmartDashboard()}catch(e){}},220)});
  window.addEventListener('load',function(){setTimeout(function(){try{setAppVersionUI&&setAppVersionUI()}catch(e){} try{renderSmartDashboard()}catch(e){}},260)});
})();
;
/*
===============================================================================
CHANGELOG 4.38 - דשבורד חכם: צבעים עדינים, הסרת יום רגיל, הוצאות 6%
-------------------------------------------------------------------------------
1. הוסר כרטיס "צריך לכל יום רגיל" מהדשבורד כי הוא מבלבל ולא משמש לניהול יעד אמיתי.
2. נוספו צבעי רקע עדינים לכרטיסיות קיימות בלבד, בלי לשנות מבנה נתונים או לוגיקה קיימת.
3. נוספו שני כרטיסים חדשים לפי עבודות שבוצעו בפועל בלבד:
   - הוצאות 6% = בוצע בפועל * 0.06
   - נשאר אחרי הוצאות = בוצע בפועל * 0.94
4. החישוב לא כולל עבודות מתוזמנות ולא פוגע בחישובי פוטנציאל/יעד/ימי חופש קיימים.
===============================================================================
*/
(function(){
  if(window.__dashboardV438Applied) return;
  window.__dashboardV438Applied=true;

  function money438(n){
    try{ return typeof money==='function' ? money(n) : '₪'+Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0}); }
    catch(e){ return '₪'+Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0}); }
  }
  function safeArr438(a){ return Array.isArray(a)?a:[]; }
  function isPlanned438(e){
    if(!e) return false;
    try{ if(typeof window.isPlannedV49==='function') return !!window.isPlannedV49(e); }catch(_e){}
    return e.entryStatus==='planned' || e.planned===true || e.isPlanned===true || e.status==='planned';
  }
  function doneEntries438(){
    return safeArr438(window.monthEntries || monthEntries).filter(function(e){ return !isPlanned438(e); });
  }
  function sum438(list){ return safeArr438(list).reduce(function(s,e){ return s + Number((e&&e.amount)||0); },0); }
  function addClassByTitle438(box, text, cls){
    try{
      Array.from(box.querySelectorAll('.smart-card-v423,.smart-tip-v436,.smart-mini-v423')).forEach(function(card){
        var title=card.querySelector('.smart-title') || card.firstChild;
        var t=(title&&title.textContent?title.textContent:card.textContent)||'';
        if(t.indexOf(text)!==-1) card.classList.add(cls);
      });
    }catch(e){}
  }
  function removeRegularDayTip438(box){
    try{
      Array.from(box.querySelectorAll('.smart-tip-v436')).forEach(function(tip){
        if((tip.textContent||'').indexOf('צריך לכל יום רגיל')!==-1) tip.remove();
      });
    }catch(e){}
  }
  function applySoftColors438(box){
    addClassByTitle438(box,'בוצע החודש','smart-soft-green-v438');
    addClassByTitle438(box,'צריך לכל יום עבודה','smart-soft-green-v438');
    addClassByTitle438(box,'עמידה ביעד','smart-soft-blue-v438');
    addClassByTitle438(box,'פוטנציאל כולל','smart-soft-purple-v438');
    addClassByTitle438(box,'חסר ליעד','smart-soft-red-v438');
    addClassByTitle438(box,'ימים עבודה שנשארו','smart-soft-slate-v438');
    addClassByTitle438(box,'ימי עבודה שנשארו','smart-soft-slate-v438');
    addClassByTitle438(box,'תחזית סוף חודש','smart-soft-green-v438');
    addClassByTitle438(box,'ימי חופש שסומנו','smart-soft-orange-v438');
    addClassByTitle438(box,'ימי עבודה רגילים בחודש','smart-soft-blue-v438');
    addClassByTitle438(box,'התקנות שבוצעו','smart-soft-blue-v438');
    addClassByTitle438(box,'התקנות סיב','smart-soft-blue-v438');
    addClassByTitle438(box,'התקנות RF','smart-soft-purple-v438');
    addClassByTitle438(box,'פקודות Change','smart-soft-orange-v438');
    addClassByTitle438(box,'קריאות בתשלום','smart-soft-green-v438');
    addClassByTitle438(box,'קריאות חוזרות','smart-soft-red-v438');
  }
  function injectExpenses438(box){
    var done=doneEntries438();
    var total=sum438(done); // חשוב: עבודות שבוצעו בפועל בלבד, בלי מתוזמנות.
    var expenses=total*0.06;
    var after=total-expenses;
    var old=document.getElementById('expensesStripV438');
    if(old) old.remove();
    var wrap=document.createElement('div');
    wrap.id='expensesStripV438';
    wrap.className='expenses-strip-v438';
    wrap.innerHTML='<div class="expenses-title-v438">💰 חישוב אחרי הוצאות קבועות</div>'+
      '<div class="smart-subgrid-v436">'+
        '<div class="smart-tip-v436 smart-soft-red-v438">הוצאות 6%<b>'+money438(expenses)+'</b><div class="expenses-note-v438">מחושב רק מעבודות שבוצעו בפועל, בלי מתוזמנות</div></div>'+
        '<div class="smart-tip-v436 smart-soft-green-v438">נשאר אחרי הוצאות<b>'+money438(after)+'</b><div class="expenses-note-v438">סכום ביצוע בפועל פחות 6% הוצאות</div></div>'+
      '</div>';
    var grid=box.querySelector('.smart-grid-v423');
    if(grid && grid.parentNode) grid.parentNode.insertBefore(wrap, grid.nextSibling);
    else box.insertBefore(wrap, box.firstChild);
  }
  function polishDashboard438(){
    var box=document.getElementById('smartDashboard');
    if(!box) return;
    removeRegularDayTip438(box);
    injectExpenses438(box);
    applySoftColors438(box);
  }

  var previousRender438=window.renderSmartDashboard;
  window.renderSmartDashboard=function(){
    if(typeof previousRender438==='function') previousRender438.apply(this,arguments);
    polishDashboard438();
  };
  window.polishDashboardV438=polishDashboard438;

  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){try{polishDashboard438()}catch(e){}},300)});
  window.addEventListener('load',function(){setTimeout(function(){try{polishDashboard438()}catch(e){}},700)});
  try{ if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}
})();
;
/*
===============================================================================
CHANGELOG 2.20 - דיווח על בעיה / צור קשר לעובד
-------------------------------------------------------------------------------
1. נוספה לעובד פעולה קטנה בתחתית המסך: "דיווח על בעיה / צור קשר".
2. פתיחת טופס דיווח עם תיאור חופשי מפורט ושדה טלפון ליצירת קשר.
3. הדיווח נשמר ב-appLogs עם action=workerBugReport כדי לא לשנות Security Rules קיימים.
4. נוסף פאנל באדמין להצגת דיווחי עובדים, כולל שם עובד, שם משתמש, טלפון, זמן ותוכן הדיווח.
5. התיקון הוא תוספתי בלבד ולא משנה לוגיקת הרשמה, מנוי, תשלום, לוח שנה, דשבורד או שמירת עבודות.
===============================================================================
*/
(function(){
  const BUG_ACTION_V220 = "workerBugReport";

  function ensureBugReportStylesV220(){
    if(document.getElementById("bugReportStylesV220")) return;
    const style=document.createElement("style");
    style.id="bugReportStylesV220";
    style.textContent=`
      .bug-contact-link-v220{
        display:block;
        width:max-content;
        max-width:100%;
        margin:18px auto 4px;
        color:#64748b;
        font-size:12px;
        font-weight:900;
        text-decoration:none;
        cursor:pointer;
        opacity:.82;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(248,250,252,.72);
        border:1px solid rgba(226,232,240,.9);
      }
      .bug-contact-link-v220:hover{opacity:1;color:#1d4ed8;background:#eff6ff}
      .bug-report-panel-v220{
        margin:10px auto 0;
        max-width:720px;
        background:rgba(255,255,255,.94);
        border:1px solid #dbeafe;
        border-radius:22px;
        padding:14px;
        box-shadow:0 10px 24px rgba(15,23,42,.08);
      }
      .bug-report-panel-v220 textarea{min-height:130px}
      .bug-report-admin-card-v220{
        border:1px solid #e2e8f0;
        border-radius:18px;
        padding:13px;
        margin:8px 0;
        background:#fff;
        box-shadow:0 8px 16px rgba(15,23,42,.055);
      }
      .bug-report-meta-v220{color:#64748b;font-size:13px;line-height:1.55;font-weight:800}
      .bug-report-text-v220{white-space:pre-wrap;line-height:1.6;margin-top:8px;color:#0f172a;font-weight:700}
      @media(max-width:800px){.bug-contact-link-v220{font-size:11.5px;margin-top:14px}.bug-report-panel-v220{padding:12px;border-radius:20px}}
    `;
    document.head.appendChild(style);
  }

  function safeEscV220(value){
    if(typeof esc === "function") return esc(value);
    return String(value||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function setBugReportMsgV220(html){
    const el=document.getElementById("bugReportMsgV220");
    if(el) el.innerHTML=html;
  }

  function ensureWorkerBugReportUIV220(){
    ensureBugReportStylesV220();
    const workerView=document.getElementById("workerView");
    if(!workerView || document.getElementById("bugContactLinkV220")) return;

    const link=document.createElement("a");
    link.id="bugContactLinkV220";
    link.className="bug-contact-link-v220";
    link.href="javascript:void(0)";
    link.textContent="דיווח על בעיה / צור קשר";
    link.onclick=function(){ toggleBugReportPanelV220(); };

    const panel=document.createElement("div");
    panel.id="bugReportPanelV220";
    panel.className="bug-report-panel-v220 hidden";
    panel.innerHTML=`
      <h3>דיווח על בעיה / צור קשר</h3>
      <p class="muted">כתוב כאן בפירוט מלא מה הבעיה, באיזה מסך זה קרה, מה לחצת, ומה ציפית שיקרה.</p>
      <textarea id="bugReportTextV220" placeholder="דווח במפורט מה הבעיה, לפרטי פרטים..."></textarea>
      <input id="bugReportPhoneV220" inputmode="tel" placeholder="טלפון ליצירת קשר - לא חובה">
      <div class="actions">
        <button class="btn-green" type="button" onclick="submitWorkerBugReportV220()">שלח דיווח</button>
        <button class="btn-light" type="button" onclick="toggleBugReportPanelV220(false)">סגור</button>
      </div>
      <div id="bugReportMsgV220"></div>
    `;

    workerView.appendChild(link);
    workerView.appendChild(panel);
  }

  window.toggleBugReportPanelV220=function(force){
    ensureWorkerBugReportUIV220();
    const panel=document.getElementById("bugReportPanelV220");
    if(!panel) return;
    const shouldShow = typeof force === "boolean" ? force : panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !shouldShow);
    if(shouldShow){
      setBugReportMsgV220("");
      const phone=document.getElementById("bugReportPhoneV220");
      if(phone && !phone.value && window.expiredWorker && window.expiredWorker.contactPhone){
        phone.value=window.expiredWorker.contactPhone;
      }
      setTimeout(()=>{ const t=document.getElementById("bugReportTextV220"); if(t) t.focus(); },80);
      try{ panel.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
    }
  };

  window.submitWorkerBugReportV220=async function(){
    const txtEl=document.getElementById("bugReportTextV220");
    const phoneEl=document.getElementById("bugReportPhoneV220");
    const textValue=(txtEl&&txtEl.value?txtEl.value.trim():"");
    const phoneValue=(phoneEl&&phoneEl.value?phoneEl.value.trim():"");

    if(!textValue || textValue.length < 8){
      setBugReportMsgV220("<p class='danger'>חובה לפרט את הבעיה בכמה מילים לפחות.</p>");
      return;
    }

    const worker=window.viewedWorker || viewedWorker || {};
    const payload={
      action:BUG_ACTION_V220,
      pageVersion:(window.APP_VERSION||APP_VERSION||""),
      bugReport:true,
      status:"open",
      workerId:worker.id||"",
      workerName:worker.name||"",
      workerUsername:worker.username||"",
      contactPhone:phoneValue,
      reportText:textValue,
      currentScreen:"workerView",
      currentTab:(document.querySelector(".worker-tab-btn-v420.active")||{}).textContent||"",
      clientTime:new Date().toISOString(),
      userAgent:navigator.userAgent||"",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
      setBugReportMsgV220("<div class='notice'>שולח דיווח...</div>");
      await db.collection("appLogs").add(payload);
      if(txtEl) txtEl.value="";
      setBugReportMsgV220("<div class='notice'>הדיווח נשלח בהצלחה ✅</div>");
      setTimeout(()=>toggleBugReportPanelV220(false),900);
    }catch(e){
      setBugReportMsgV220("<p class='danger'>שגיאה בשליחת הדיווח: "+safeEscV220(e.message||e)+"</p>");
    }
  };

  function ensureAdminBugReportsPanelV220(){
    ensureBugReportStylesV220();
    const admin=document.getElementById("adminView");
    if(!admin || document.getElementById("bugReportsAdminPanelV220")) return;

    const card=document.createElement("div");
    card.id="bugReportsAdminPanelV220";
    card.className="card";
    card.innerHTML=`
      <div class="cal-head">
        <h2>🐞 דיווחי בעיות / יצירת קשר</h2>
        <button class="btn-light" type="button" onclick="loadBugReportsAdminV220()">רענן דיווחים</button>
      </div>
      <p>כאן יופיעו דיווחים שהעובדים שלחו מתוך המסך שלהם, כולל טלפון ליצירת קשר אם מילאו.</p>
      <div id="bugReportsAdminListV220"><p class="muted">אין נתונים עדיין.</p></div>
    `;

    const payments=document.getElementById("paymentRequestsAdmin");
    const paymentCard=payments ? payments.closest(".card") : null;
    if(paymentCard && paymentCard.parentNode){
      paymentCard.parentNode.insertBefore(card, paymentCard.nextSibling);
    }else{
      admin.appendChild(card);
    }
  }

  function formatBugDateV220(row){
    try{
      if(row.clientTime) return new Date(row.clientTime).toLocaleString("he-IL");
      if(row.createdAt && typeof row.createdAt.toDate === "function") return row.createdAt.toDate().toLocaleString("he-IL");
    }catch(e){}
    return "";
  }

  window.loadBugReportsAdminV220=async function(){
    ensureAdminBugReportsPanelV220();
    const box=document.getElementById("bugReportsAdminListV220");
    if(!box) return;
    box.innerHTML="<p>טוען דיווחים...</p>";
    try{
      const snap=await db.collection("appLogs").where("action","==",BUG_ACTION_V220).get();
      const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.clientTime||"").localeCompare(String(a.clientTime||"")));
      if(!rows.length){
        box.innerHTML="<p class='muted'>אין דיווחי בעיות עדיין.</p>";
        return;
      }
      box.innerHTML=`<div class="kpi-strip"><div class="kpi">סה״כ דיווחים<b>${rows.length}</b></div><div class="kpi">פתוחים<b>${rows.filter(r=>(r.status||"open")==="open").length}</b></div><div class="kpi">עם טלפון<b>${rows.filter(r=>r.contactPhone).length}</b></div><div class="kpi">גרסה<b>${safeEscV220(window.APP_VERSION||APP_VERSION||"")}</b></div></div>`;
      rows.forEach(r=>{
        const div=document.createElement("div");
        div.className="bug-report-admin-card-v220";
        div.innerHTML=`
          <div class="client-head">
            <div>
              <div class="item-title">${safeEscV220(r.workerName||"עובד לא מזוהה")} · ${safeEscV220(r.workerUsername||"")}</div>
              <div class="bug-report-meta-v220">
                זמן: ${safeEscV220(formatBugDateV220(r))}<br>
                טלפון: ${safeEscV220(r.contactPhone||"לא צוין")}<br>
                עובד ID: ${safeEscV220(r.workerId||"")} · גרסה: ${safeEscV220(r.pageVersion||"")}<br>
                מסך/טאב: ${safeEscV220(r.currentTab||"")}
              </div>
            </div>
            <div class="payment-status-pending">${safeEscV220(r.status||"open")}</div>
          </div>
          <div class="bug-report-text-v220">${safeEscV220(r.reportText||"")}</div>
        `;
        box.appendChild(div);
      });
    }catch(e){
      box.innerHTML="<p class='danger'>שגיאה בטעינת דיווחים: "+safeEscV220(e.message||e)+"</p>";
    }
  };

  // Wrappers additive only: keep existing behavior and inject/report refresh after normal screens render.
  const oldShowWorkerV220=window.showWorker;
  if(typeof oldShowWorkerV220 === "function"){
    window.showWorker=async function(worker){
      const res=await oldShowWorkerV220.apply(this,arguments);
      setTimeout(ensureWorkerBugReportUIV220,80);
      return res;
    };
  }

  const oldShowAdminV220=window.showAdmin;
  if(typeof oldShowAdminV220 === "function"){
    window.showAdmin=async function(){
      const res=await oldShowAdminV220.apply(this,arguments);
      setTimeout(function(){ ensureAdminBugReportsPanelV220(); loadBugReportsAdminV220(); },120);
      return res;
    };
  }

  window.addEventListener("load",function(){
    setTimeout(function(){
      ensureWorkerBugReportUIV220();
      ensureAdminBugReportsPanelV220();
    },300);
  });
})();
;
/*
===============================================================================
CHANGELOG 4.5 - מחיקת דיווחי בעיות מאדמין
-------------------------------------------------------------------------------
1. APP_VERSION עודכן ל-"4.5" לפי בקשת המנהל.
2. נוסף כפתור "מחק דיווח" בכל דיווח בעיה בפאנל אדמין.
3. המחיקה מתבצעת ישירות מ-appLogs לפי מזהה הדיווח, עם confirm לפני מחיקה.
4. לאחר המחיקה רשימת הדיווחים נטענת מחדש.
5. תיקון תוספתי בלבד: אין שינוי בהרשמה, מנויים, תשלומים, לוח שנה, דשבורד, עובדים או שמירת עבודות.
===============================================================================
*/
(function(){
  const BUG_ACTION_V45 = "workerBugReport";

  function escV45(value){
    if(typeof esc === "function") return esc(value);
    return String(value||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function moneyV45(n){
    try{ return typeof money === "function" ? money(n) : "₪" + Number(n||0).toLocaleString("he-IL",{maximumFractionDigits:0}); }
    catch(e){ return "₪0"; }
  }

  function formatBugDateV45(row){
    try{
      if(row.clientTime) return new Date(row.clientTime).toLocaleString("he-IL");
      if(row.createdAt && typeof row.createdAt.toDate === "function") return row.createdAt.toDate().toLocaleString("he-IL");
    }catch(e){}
    return "";
  }

  window.deleteBugReportAdminV45 = async function(reportId){
    if(!reportId) return;
    if(!confirm("למחוק את דיווח הבעיה הזה מהפאנל?\n\nהמחיקה תמחק את הדיווח מ-appLogs ולא ניתן לשחזר אותו דרך המסך.")) return;
    try{
      await db.collection("appLogs").doc(reportId).delete();
      if(typeof loadBugReportsAdminV220 === "function") await loadBugReportsAdminV220();
      alert("הדיווח נמחק ✅");
    }catch(e){
      alert("שגיאה במחיקת הדיווח: " + (e.message || e));
    }
  };

  window.loadBugReportsAdminV220 = async function(){
    const admin=document.getElementById("adminView");
    if(admin && !document.getElementById("bugReportsAdminPanelV220")){
      const card=document.createElement("div");
      card.id="bugReportsAdminPanelV220";
      card.className="card";
      card.innerHTML=`
        <div class="cal-head">
          <h2>🐞 דיווחי בעיות / יצירת קשר</h2>
          <button class="btn-light" type="button" onclick="loadBugReportsAdminV220()">רענן דיווחים</button>
        </div>
        <p>כאן יופיעו דיווחים שהעובדים שלחו מתוך המסך שלהם, כולל טלפון ליצירת קשר אם מילאו.</p>
        <div id="bugReportsAdminListV220"><p class="muted">אין נתונים עדיין.</p></div>`;
      const payments=document.getElementById("paymentRequestsAdmin");
      const paymentCard=payments ? payments.closest(".card") : null;
      if(paymentCard && paymentCard.parentNode) paymentCard.parentNode.insertBefore(card, paymentCard.nextSibling);
      else admin.appendChild(card);
    }

    const box=document.getElementById("bugReportsAdminListV220");
    if(!box) return;
    box.innerHTML="<p>טוען דיווחים...</p>";
    try{
      const snap=await db.collection("appLogs").where("action","==",BUG_ACTION_V45).get();
      const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.clientTime||"").localeCompare(String(a.clientTime||"")));
      if(!rows.length){
        box.innerHTML="<p class='muted'>אין דיווחי בעיות עדיין.</p>";
        return;
      }
      box.innerHTML=`<div class="kpi-strip"><div class="kpi">סה״כ דיווחים<b>${rows.length}</b></div><div class="kpi">פתוחים<b>${rows.filter(r=>(r.status||"open")==="open").length}</b></div><div class="kpi">עם טלפון<b>${rows.filter(r=>r.contactPhone).length}</b></div><div class="kpi">גרסה<b>${escV45(window.APP_VERSION||APP_VERSION||"")}</b></div></div>`;
      rows.forEach(r=>{
        const div=document.createElement("div");
        div.className="bug-report-admin-card-v220";
        div.innerHTML=`
          <div class="client-head">
            <div>
              <div class="item-title">${escV45(r.workerName||"עובד לא מזוהה")} · ${escV45(r.workerUsername||"")}</div>
              <div class="bug-report-meta-v220">
                זמן: ${escV45(formatBugDateV45(r))}<br>
                טלפון: ${escV45(r.contactPhone||"לא צוין")}<br>
                עובד ID: ${escV45(r.workerId||"")} · גרסה: ${escV45(r.pageVersion||"")}<br>
                מסך/טאב: ${escV45(r.currentTab||"")}
              </div>
            </div>
            <div>
              <div class="payment-status-pending" style="margin-bottom:8px">${escV45(r.status||"open")}</div>
              <button class="btn-red" type="button" onclick="deleteBugReportAdminV45('${escV45(r.id)}')">מחק דיווח</button>
            </div>
          </div>
          <div class="bug-report-text-v220">${escV45(r.reportText||"")}</div>`;
        box.appendChild(div);
      });
    }catch(e){
      box.innerHTML="<p class='danger'>שגיאה בטעינת דיווחים: "+escV45(e.message||e)+"</p>";
    }
  };

  try{
    window.APP_VERSION = APP_VERSION;
    if(typeof setAppVersionUI === "function") setAppVersionUI();
    if(typeof enforceAppVersionUI === "function") enforceAppVersionUI();
  }catch(e){}
})();
;
try{
  window.APP_VERSION = APP_VERSION;
  if(typeof setAppVersionUI === 'function') setAppVersionUI();
  if(typeof enforceAppVersionUI === 'function') enforceAppVersionUI();
}catch(e){}
;
/*
===============================================================================
CHANGELOG 4.89 - ביטול יום חופש אמיתי מול Firestore
-------------------------------------------------------------------------------
1. APP_VERSION עודכן ל-"4.89" ונשאר מקור הגרסה המרכזי לתצוגה, לוגים ושמות קבצים.
2. פונקציית cancelVacationDay שונתה בליבה: היא מאתרת את כל מסמכי יום החופש של העובד לאותו תאריך לפי workerId בלבד, ומבטלת את כולם ב-batch.
3. התיקון פותר מצב שבו יום חופש נטען ממסמך ישן/אקראי אבל כפתור הביטול עדכן רק docId חדש ודטרמיניסטי.
4. אין שימוש ב-localStorage לימי חופש ואין fallback מקומי.
5. הקריאה עדיין לא דורשת אינדקס מורכב: query לפי workerId בלבד וסינון תאריך בצד הלקוח.
6. אחרי ביטול יום חופש המערך המקומי, לוח השנה, סטטיסטיקות ודשבורד מתרעננים מ-Firestore בלבד.
===============================================================================
*/
(function(){
  var PATCH='v4.89-firestore-vacation-cancel-core';
  var CURRENT_VERSION=APP_VERSION;
  var ALERT_ONCE_KEY='__vacationAuthAlertV487';

  try{ window.APP_VERSION=CURRENT_VERSION; if(typeof setAppVersionUI==='function')setAppVersionUI(); if(typeof enforceAppVersionUI==='function')enforceAppVersionUI(); }catch(e){}

  window.vacationDaysV437=[];
  window.vacationDaysLoadedForV437='';

  function q(id){return document.getElementById(id);}
  function safeArr(v){return Array.isArray(v)?v:[];}
  function pad2(n){return String(n).padStart(2,'0');}
  function fmt(d){try{return typeof formatDate==='function'?formatDate(d):(d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()));}catch(e){return '';}}
  function moneySafe(n){try{return typeof money==='function'?money(n):('₪'+Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0}));}catch(e){return '₪'+(n||0);}}
  function heDateSafe(s){try{return typeof heDate==='function'?heDate(s):s;}catch(e){return s;}}
  function escSafe(s){try{return typeof esc==='function'?esc(s):String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}catch(e){return String(s||'');}}
  function selectedWorkerId(){
    try{ if(typeof viewedWorker!=='undefined' && viewedWorker && viewedWorker.id) return viewedWorker.id; }catch(e){}
    try{ if(typeof session!=='undefined' && session && session.workerId) return session.workerId; }catch(e){}
    return '';
  }
  function selectedWorkerName(){
    try{ if(typeof viewedWorker!=='undefined' && viewedWorker && viewedWorker.name) return viewedWorker.name; }catch(e){}
    try{ if(typeof session!=='undefined' && session && session.name) return session.name; }catch(e){}
    return '';
  }
  function docIdDayOff(workerId,date){return String(workerId||'worker').replace(/[^a-zA-Z0-9_\-א-ת]/g,'_')+'_'+String(date||'date').replace(/[^0-9]/g,'_');}
  function monthKey(){try{return calendarDate.getFullYear()+'-'+pad2(calendarDate.getMonth()+1);}catch(e){return '';}}
  function currentMonthRange(){
    var d=(typeof calendarDate!=='undefined' && calendarDate) ? calendarDate : new Date();
    var y=d.getFullYear(), m=d.getMonth(), last=new Date(y,m+1,0).getDate();
    return {start:y+'-'+pad2(m+1)+'-01',end:y+'-'+pad2(m+1)+'-'+pad2(last),year:y,month:m,last:last};
  }
  function authCurrentUser(){try{return (typeof auth!=='undefined' && auth && auth.currentUser) ? auth.currentUser : null;}catch(e){return null;}}
  function authReadyPossible(){try{return !!(typeof firebase!=='undefined' && firebase.auth && typeof auth!=='undefined' && auth);}catch(e){return false;}}
  function waitForAuthReadyV487(timeoutMs){
    timeoutMs=Number(timeoutMs||3500);
    return new Promise(function(resolve){
      if(!authReadyPossible()) return resolve(null);
      var u=authCurrentUser();
      if(u) return resolve(u);
      var done=false,unsub=null;
      var timer=setTimeout(function(){ if(done)return; done=true; try{if(unsub)unsub();}catch(e){} resolve(authCurrentUser()); },timeoutMs);
      try{
        unsub=auth.onAuthStateChanged(function(user){
          if(done)return;
          if(user){done=true;clearTimeout(timer);try{if(unsub)unsub();}catch(e){}resolve(user);}
        });
      }catch(e){clearTimeout(timer);resolve(authCurrentUser());}
    });
  }
  async function ensureAuthBeforeFirestoreV487(){
    try{ if(authReadyPossible() && firebase.auth.Auth && firebase.auth.Auth.Persistence){ await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){}); } }catch(e){}
    return await waitForAuthReadyV487(4200);
  }
  function isPlannedEntry(e){
    e=e||{};
    try{ if(typeof window.isPlannedV49==='function') return !!window.isPlannedV49(e); }catch(_e){}
    return e.entryStatus==='planned'||e.status==='planned'||e.isPlanned===true||e.planned===true||e.workStatus==='planned';
  }
  function isVacation(date){return safeArr(window.vacationDaysV437).indexOf(date)>=0;}
  window.isVacationDayV437=isVacation;
  window.isVacationDayV439=isVacation;
  window.isVacationDayV487=isVacation;
  window.isVacationDayV489=isVacation;

  async function fetchVacationDaysFirestore(workerId,start,end){
    /*
      v4.88: אין יותר query עם workerId + date range.
      ב-Firestore שילוב כזה דורש composite index, וכשאין אינדקס מתקבלת שגיאת failed-precondition.
      לכן טוענים את ימי החופש של העובד בלבד לפי workerId, ואת סינון החודש עושים כאן בצד הלקוח.
      זה שינוי ישיר של פונקציית הליבה, לא patch חיצוני.
    */
    var snap=await db.collection('workerDaysOff')
      .where('workerId','==',workerId)
      .get();
    var days=[];
    snap.docs.forEach(function(doc){
      var d=doc.data()||{};
      var date=String(d.date||'');
      if((d.type==='vacation' || !d.type) && d.active!==false && date && date>=start && date<=end) days.push(date);
    });
    return Array.from(new Set(days.filter(Boolean))).sort();
  }

  async function loadVacationDaysV487(){
    var workerId=selectedWorkerId();
    if(!workerId){window.vacationDaysV437=[];return [];}
    var range=currentMonthRange();
    try{
      await ensureAuthBeforeFirestoreV487();
      window.vacationDaysV437=await fetchVacationDaysFirestore(workerId,range.start,range.end);
      window.vacationDaysLoadedForV437=workerId+'_'+monthKey();
      return window.vacationDaysV437;
    }catch(e){
      window.vacationDaysV437=[];
      console.error(PATCH+' workerDaysOff load failed', e && (e.code||e.message) ? (e.code||e.message) : e);
      if(!window[ALERT_ONCE_KEY]){
        window[ALERT_ONCE_KEY]=true;
        try{ alert('לא הצלחתי לטעון ימי חופש מ-Firestore.\nבגרסה 4.88 הקריאה כבר לא דורשת אינדקס מורכב. אם זה חוזר — בדוק שה-Rules פורסמו ושהעובד מחובר Auth.\nשגיאה: '+((e&&e.code)||e.message||e)); }catch(_e){}
      }
      return [];
    }
  }
  window.loadVacationDaysV437=loadVacationDaysV487;
  window.loadVacationDaysV439=loadVacationDaysV487;
  window.loadVacationDaysV482=loadVacationDaysV487;
  window.loadVacationDaysV486=loadVacationDaysV487;
  window.loadVacationDaysV487=loadVacationDaysV487;
  window.loadVacationDaysV489=loadVacationDaysV487;

  async function fetchDayEntries(workerId,date){
    var out=[];
    try{
      var snap=await db.collection('workEntries').where('workerId','==',workerId).where('date','==',date).get();
      snap.docs.forEach(function(d){out.push({id:d.id,ref:d.ref,data:d.data()});});
    }catch(e){
      out=safeArr(typeof monthEntries!=='undefined'?monthEntries:[])
        .filter(function(x){return x&&x.workerId===workerId&&x.date===date;})
        .map(function(x){return {id:x.id,ref:x.id?db.collection('workEntries').doc(x.id):null,data:x};});
    }
    return out;
  }
  function showVacationDeleteWarning(date,entries){
    return new Promise(function(resolve){
      var planned=entries.filter(function(x){return isPlannedEntry(x.data||x);});
      var done=entries.filter(function(x){return !isPlannedEntry(x.data||x);});
      var total=entries.reduce(function(s,x){return s+Number((x.data||x).amount||0);},0);
      var rows=entries.slice(0,14).map(function(x){var e=x.data||x;return '<div>'+(isPlannedEntry(e)?'📋 מתוזמנת / עתידית':'✅ בוצעה בפועל')+' · '+escSafe(e.description||e.workType||'עבודה')+' · לקוח: '+escSafe(e.customerNumber||'')+' · '+escSafe(e.address||'')+' · '+moneySafe(e.amount||0)+'</div>';}).join('');
      if(entries.length>14) rows+='<div>ועוד '+(entries.length-14)+' רשומות נוספות...</div>';
      var overlay=document.createElement('div');
      overlay.className='vacation-delete-modal-v473';
      overlay.innerHTML='\
        <div class="vacation-delete-card-v473" role="dialog" aria-modal="true">\
          <div class="vacation-delete-head-v473"><div class="vacation-delete-title-v473">⚠️ סימון יום חופש ימחק נתונים</div></div>\
          <div class="vacation-delete-body-v473">\
            <div class="vacation-delete-text-v473">בתאריך <b>'+heDateSafe(date)+'</b> קיימים נתונים. אם תאשר — כל הרשומות של היום הזה יימחקו לצמיתות, והיום יישמר כיום חופש ב-Firestore בלבד.</div>\
            <div class="vacation-delete-grid-v473">\
              <div class="vacation-delete-stat-v473">בוצעו בפועל<b>'+done.length+'</b></div>\
              <div class="vacation-delete-stat-v473">מתוזמנות / עתידיות<b>'+planned.length+'</b></div>\
              <div class="vacation-delete-stat-v473">סה״כ רשומות<b>'+entries.length+'</b></div>\
              <div class="vacation-delete-stat-v473">כסף שיימחק<b>'+moneySafe(total)+'</b></div>\
            </div>\
            <div class="vacation-delete-alert-v473">אישור הפעולה ימחק את כל הנתונים של היום הזה. אי אפשר לשחזר בלי גיבוי.</div>\
            <div class="vacation-delete-list-v473">'+(rows||'<div>אין פירוט רשומות</div>')+'</div>\
          </div>\
          <div class="vacation-delete-actions-v473">\
            <button type="button" class="btn-light" id="vacCancelV487">ביטול</button>\
            <button type="button" class="btn-red" id="vacConfirmV487">כן, למחוק ולסמן חופש</button>\
          </div>\
        </div>';
      document.body.appendChild(overlay);
      function finish(v){try{overlay.remove();}catch(e){} resolve(v);}
      overlay.querySelector('#vacCancelV487').onclick=function(){finish(false);};
      overlay.querySelector('#vacConfirmV487').onclick=function(){finish(true);};
      overlay.addEventListener('click',function(ev){if(ev.target===overlay)finish(false);});
    });
  }
  async function deleteEntries(entries){
    if(!entries.length)return 0;
    var deleted=0,batch=db.batch();
    entries.forEach(function(x){var ref=x.ref||(x.id?db.collection('workEntries').doc(x.id):null); if(ref){batch.delete(ref); deleted++;}});
    if(deleted) await batch.commit();
    return deleted;
  }
  async function saveDayOffFirestore(workerId,date,deletedCount,deletedAmount){
    await ensureAuthBeforeFirestoreV487();
    await db.collection('workerDaysOff').doc(docIdDayOff(workerId,date)).set({
      workerId:workerId,
      workerName:selectedWorkerName(),
      authUid:(authCurrentUser()&&authCurrentUser().uid)||'',
      date:date,
      type:'vacation',
      active:true,
      deletedEntriesCount:deletedCount||0,
      deletedEntriesAmount:deletedAmount||0,
      source:'firestore-only-clean-v4-89',
      appVersion:CURRENT_VERSION,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  }
  async function setVacationDay(date){
    var workerId=selectedWorkerId();
    if(!workerId||!date){alert('לא זוהה עובד פעיל לשמירת יום חופש. צא והיכנס מחדש.');return;}
    if(new Date(date+'T00:00:00').getDay()===6){alert('שבת כבר חסומה אוטומטית ואין צורך לסמן אותה כיום חופש.');return;}
    var entries=await fetchDayEntries(workerId,date);
    var total=entries.reduce(function(s,x){return s+Number((x.data||x).amount||0);},0);
    if(entries.length){
      var ok=await showVacationDeleteWarning(date,entries);
      if(!ok)return;
      try{
        var deleted=await deleteEntries(entries);
        if(deleted!==entries.length){alert('נמחקו רק '+deleted+' מתוך '+entries.length+' רשומות. יום החופש לא יסומן כדי לא ליצור מצב לא תקין.');return;}
        try{ if(Array.isArray(monthEntries)) monthEntries=monthEntries.filter(function(e){return e.date!==date;}); }catch(e){}
      }catch(e){alert('לא הצלחתי למחוק את נתוני היום ולכן לא סימנתי יום חופש. שגיאה: '+(e.message||e));return;}
    }
    try{
      await saveDayOffFirestore(workerId,date,entries.length,total);
    }catch(e){
      alert('יום החופש לא נשמר ב-Firestore. לא נשמר שום fallback מקומי.\nבדוק Rules ל-workerDaysOff ושהעובד מחובר Firebase Auth.\nשגיאה: '+((e&&e.code)||e.message||e));
      return;
    }
    window.vacationDaysV437=Array.from(new Set(safeArr(window.vacationDaysV437).concat([date]))).sort();
    await loadVacationDaysV487().catch(function(){});
    await refreshAfterVacation();
    if(entries.length)alert('יום החופש סומן ✅\nנמחקו '+entries.length+' רשומות מהיום הזה.');
  }
  window.setVacationDayV437=setVacationDay;
  window.setVacationDayV439=setVacationDay;
  window.setVacationDayV46=setVacationDay;
  window.setVacationDayV47=setVacationDay;
  window.setVacationDayV473=setVacationDay;
  window.setVacationDayV486=setVacationDay;
  window.setVacationDayV487=setVacationDay;
  window.setVacationDayV489=setVacationDay;

  async function cancelVacationDay(date){
    var workerId=selectedWorkerId();
    if(!workerId||!date){alert('לא זוהה עובד או תאריך לביטול יום חופש. צא והיכנס מחדש.');return;}
    if(!confirm('לבטל את יום החופש בתאריך '+heDateSafe(date)+'?'))return;
    try{
      await ensureAuthBeforeFirestoreV487();

      /*
        v4.89: ביטול יום חופש אמיתי.
        בעבר הביטול עדכן רק מסמך בשם דטרמיניסטי workerId_date.
        אם היום נטען ממסמך ישן/אקראי שנוצר בגרסה קודמת, המסמך הישן נשאר active:true ולכן אחרי רענון היום עדיין הופיע כחופש.
        לכן כאן טוענים את כל ימי החופש של העובד לפי workerId בלבד, מסננים את התאריך בצד הלקוח,
        ומבטלים את כל המסמכים המתאימים ב-batch. אין localStorage ואין query שדורש אינדקס מורכב.
      */
      var snap=await db.collection('workerDaysOff')
        .where('workerId','==',workerId)
        .get();
      var batch=db.batch();
      var matched=0;
      snap.docs.forEach(function(doc){
        var d=doc.data()||{};
        if(String(d.date||'')===String(date) && d.active!==false){
          matched++;
          batch.set(doc.ref,{
            active:false,
            cancelledAt:new Date().toISOString(),
            cancelledByWorkerId:workerId,
            appVersion:CURRENT_VERSION,
            updatedAt:firebase.firestore.FieldValue.serverTimestamp()
          },{merge:true});
        }
      });

      // גם אם לא נמצא מסמך ישן, מבטלים את המסמך הדטרמיניסטי כדי לנקות מצב עתידי/חלקי.
      var deterministicRef=db.collection('workerDaysOff').doc(docIdDayOff(workerId,date));
      batch.set(deterministicRef,{
        workerId:workerId,
        workerName:selectedWorkerName(),
        authUid:(authCurrentUser()&&authCurrentUser().uid)||'',
        date:date,
        type:'vacation',
        active:false,
        cancelledAt:new Date().toISOString(),
        cancelledByWorkerId:workerId,
        appVersion:CURRENT_VERSION,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      await batch.commit();
    }catch(e){alert('לא הצלחתי לבטל את יום החופש ב-Firestore. לא בוצע שינוי מקומי. שגיאה: '+((e&&e.code)||e.message||e));return;}

    window.vacationDaysV437=safeArr(window.vacationDaysV437).filter(function(d){return d!==date;});
    window.vacationDaysLoadedForV437='';
    await loadVacationDaysV487().catch(function(){});
    await refreshAfterVacation();
  }
  window.cancelVacationDayV437=cancelVacationDay;
  window.cancelVacationDayV439=cancelVacationDay;
  window.cancelVacationDayV486=cancelVacationDay;
  window.cancelVacationDayV487=cancelVacationDay;
  window.cancelVacationDayV489=cancelVacationDay;

  function doneEntries(arr){return safeArr(arr).filter(function(e){var st=String((e && (e.entryStatus || e.status)) || 'done');return !isPlannedEntry(e) && st!=='not_done';});}
  function plannedEntries(arr){return safeArr(arr).filter(isPlannedEntry);}
  function sumAmount(arr){return safeArr(arr).reduce(function(s,e){return s+Number(e.amount||0);},0);}
  function todayStrSafe(){try{return formatDate(new Date());}catch(e){return fmt(new Date());}}
  function remainingWorkDaysWithVacations(){
    /*
      v5.21 CORE FIX:
      זו הפונקציה האמיתית שמזינה את הדשבורד החכם.
      "ימי עבודה שנשארו לחישוב יעד" חייבים להתחיל ממחר, לא מהיום.
      היום כבר משפיע על הסכום שבוצע בפועל, ולכן לא מחלקים את החסר ליעד גם על היום.
      החישוב: ממחר עד סוף החודש, ללא שבתות וללא ימי חופש עתידיים.
    */
    try{
      var now=new Date(), todayOnly=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      var range=currentMonthRange(), y=range.year, m=range.month, last=range.last;
      var monthStart=new Date(y,m,1), monthEnd=new Date(y,m,last);

      // חודש שעבר: אין ימי עבודה עתידיים.
      if(monthEnd<todayOnly) return 0;

      var isCurrentMonth=(now.getFullYear()===y && now.getMonth()===m);

      // חודש נוכחי: מתחילים ממחר. חודש עתידי: מתחילים מהיום הראשון בחודש.
      var start=isCurrentMonth ? now.getDate()+1 : 1;
      if(monthStart>todayOnly) start=1;

      var c=0;
      for(var d=start;d<=last;d++){
        var ds=y+'-'+pad2(m+1)+'-'+pad2(d), dt=new Date(y,m,d);
        if(dt.getDay()!==6 && !isVacation(ds)) c++;
      }
      return Math.max(c,0);
    }catch(e){return 0;}
  }
  function regularWorkDaysInMonth(){
    /*
      v4.95 CORE FIX:
      "ימי עבודה בחודש" הוא מספר ימי החודש פחות שבתות בלבד.
      לא מורידים כאן ימי חופש, כי ימי החופש מוצגים ברובריקה נפרדת.
    */
    try{
      var range=currentMonthRange(), c=0;
      for(var d=1;d<=range.last;d++){
        var dt=new Date(range.year,range.month,d);
        if(dt.getDay()!==6) c++;
      }
      return c;
    }catch(e){return 0;}
  }
  window.remainingWorkDaysWithVacationsV437=remainingWorkDaysWithVacations;
  window.remainingWorkDaysWithVacationsV487=remainingWorkDaysWithVacations;
  window.remainingWorkDaysWithVacationsV489=remainingWorkDaysWithVacations;
  window.regularWorkDaysInMonthV496=regularWorkDaysInMonth;

  var baseLoadMonth=window.loadMonth;
  if(typeof baseLoadMonth==='function' && !baseLoadMonth.__vacationCleanV487){
    window.loadMonth=async function(){
      var res=await baseLoadMonth.apply(this,arguments);
      await loadVacationDaysV487().catch(function(e){console.warn(PATCH+' loadMonth vacation load',e&&e.message?e.message:e);});
      try{ renderCalendar(); renderDay(); renderStats(); renderSmartDashboard(); }catch(e){}
      return res;
    };
    window.loadMonth.__vacationCleanV487=true;
  }

  var baseShowWorker=window.showWorker;
  if(typeof baseShowWorker==='function' && !baseShowWorker.__vacationCleanV487){
    window.showWorker=async function(){
      var res=await baseShowWorker.apply(this,arguments);
      await loadVacationDaysV487().catch(function(){});
      try{ renderCalendar(); renderDay(); renderStats(); renderSmartDashboard(); }catch(e){}
      return res;
    };
    window.showWorker.__vacationCleanV487=true;
  }

  var baseRenderCalendar=window.renderCalendar;
  window.renderCalendar=function(){
    var cal=q('calendar');
    if(!cal){ if(typeof baseRenderCalendar==='function')return baseRenderCalendar.apply(this,arguments); return; }
    cal.innerHTML='';
    try{weekdays.forEach(function(w){var wd=document.createElement('div');wd.className='weekday';wd.textContent=w;cal.appendChild(wd);});}catch(e){}
    var range=currentMonthRange(), today=todayStrSafe();
    var first=new Date(range.year,range.month,1);
    for(var i=0;i<first.getDay();i++){var empty=document.createElement('div');empty.className='day empty';cal.appendChild(empty);}
    for(var d=1;d<=range.last;d++){
      var ds=range.year+'-'+pad2(range.month+1)+'-'+pad2(d), dt=new Date(range.year,range.month,d), sh=dt.getDay()===6, vac=isVacation(ds);
      var all=safeArr(typeof monthEntries!=='undefined'?monthEntries:[]).filter(function(e){return e.date===ds;});
      var done=doneEntries(all), planned=plannedEntries(all), notDone=safeArr(all).filter(function(e){var st=String((e && (e.entryStatus || e.status)) || 'done');return st==='not_done';}), total=sumAmount(done), plannedTotal=sumAmount(planned);
      var div=document.createElement('div'); div.className='day';
      if(sh) div.classList.add('shabbat');
      if(vac) div.classList.add('vacation-v437');
      if(ds===today) div.classList.add('today');
      try{ if(ds===selectedDate) div.classList.add('selected'); }catch(e){}
      div.innerHTML='<div class="day-num">'+d+'</div>'+
        (vac?'<div class="day-vacation-label-v437">יום חופש</div>':'')+
        (total&&!vac?'<div class="day-total">'+moneySafe(total)+'</div>':'')+
        (done.length&&!vac?'<div class="day-count">'+done.length+' בוצע</div>':'')+
        (notDone.length&&!vac?'<div class="day-not-done-v539">🚫 '+notDone.length+' לא בוצע</div>':'')+
        (planned.length&&!vac?'<div class="day-planned-v49">📋 '+planned.length+' מתוכנן<br>'+moneySafe(plannedTotal)+'</div>':'')+
        (vac&&(done.length||planned.length||notDone.length)?'<div class="day-count">יש נתונים קיימים</div>':'');
      if(!sh || vac) div.onclick=(function(date){return function(){selectDay(date);};})(ds);
      cal.appendChild(div);
    }
  };

  var baseRenderDay=window.renderDay;
  window.renderDay=function(){
    try{ if(!selectedDate){hide('dayPanel');show('selectDayHint');return;} }catch(e){}
    if(isVacation(selectedDate)){
      show('dayPanel'); hide('selectDayHint');
      text('dateTitle','יום '+heDateSafe(selectedDate)+' — יום חופש');
      var form=q('entryForm'); if(form) form.classList.add('hidden');
      var edit=q('editEntryPanel'); if(edit) edit.classList.add('hidden');
      var holder=q('dayOffToolsV437'); if(holder) holder.remove();
      var box=q('dayEntries');
      if(box) box.innerHTML='<div class="day-off-panel-v437">🏖️ היום הזה מסומן כיום חופש ולכן הוא לא נספר כיום עבודה בדשבורד החכם.<br>אין אפשרות להוסיף עבודה ביום הזה עד שמבטלים את יום החופש.</div><div class="actions"><button class="btn-yellow" type="button" onclick="cancelVacationDayV437(\''+selectedDate+'\')">בטל יום חופש</button></div>';
      return;
    }
    if(typeof baseRenderDay==='function') baseRenderDay.apply(this,arguments);
    var form2=q('entryForm'); if(form2) form2.classList.remove('hidden');
    var holder2=q('dayOffToolsV437');
    if(!holder2){holder2=document.createElement('div');holder2.id='dayOffToolsV437';holder2.className='day-off-tools-v437';var title=q('dateTitle'); if(title&&title.parentNode) title.parentNode.insertBefore(holder2,title.nextSibling);}
    if(holder2) holder2.innerHTML='<button class="btn-light" type="button" onclick="setVacationDayV437(\''+selectedDate+'\')">🏖️ סמן כיום חופש</button>';
  };

  // v4.96: במקום לעטוף את renderSmartDashboard כפאץ׳, הפונקציה הראשית קוראת ישירות לעוזר הזה.
  // כך אזור ימי העבודה/חופש מוצג מאותו מקור חישוב של הכרטיסים והתובנות.
  window.renderVacationGoalStripV496=function(box, stats){
    box=box||q('smartDashboard'); if(!box)return;
    stats=stats||{};
    var all=safeArr(typeof monthEntries!=='undefined'?monthEntries:[]), dn=doneEntries(all), total=Number(stats.total!==undefined?stats.total:sumAmount(dn));
    var goal=Number(stats.goal!==undefined?stats.goal:(getWorkerGoalForMonthV556()));
    var left=Number(stats.left!==undefined?stats.left:Math.max(goal-total,0));
    var regular=Number(stats.regular!==undefined?stats.regular:regularWorkDaysInMonth());
    var vacCount=Number(stats.vacCount!==undefined?stats.vacCount:safeArr(window.vacationDaysV437).length);
    var rem=Number(stats.rem!==undefined?stats.rem:remainingWorkDaysWithVacations());
    var need=Number(stats.need!==undefined?stats.need:(goal&&rem?left/rem:0));
    var uniqueDays=new Set(dn.map(function(e){return e.date;}).filter(Boolean));
    var avg=Number(stats.avg!==undefined?stats.avg:(uniqueDays.size?total/uniqueDays.size:0));
    var forecast=Number(stats.forecast!==undefined?stats.forecast:(dn.length?total+avg*rem:0));
    var doneCount=Number(stats.doneCount!==undefined?stats.doneCount:dn.length);
    var old=q('vacationGoalStripV437'); if(old) old.remove();
    var wrap=document.createElement('div'); wrap.id='vacationGoalStripV437';
    var elapsed=Number(stats.elapsedWork!==undefined?stats.elapsedWork:0);
    var remNoToday=Number(stats.remNoToday!==undefined?stats.remNoToday:rem);
    wrap.innerHTML='<div class="vacation-goal-strip-v437"><h3>🏖️ ימי עבודה, חופש והשפעה על היעד</h3><div class="smart-subgrid-v436">'+
      '<div class="smart-tip-v436">ימי עבודה בחודש<b>'+regular+'</b><div class="vacation-note-v437">כל ימי החודש פחות שבתות בלבד</div></div>'+
      '<div class="smart-tip-v436">ימי חופש שסומנו<b>'+vacCount+'</b><div class="vacation-note-v437">כל ימי החופש שסומנו בחודש</div></div>'+
      '<div class="smart-tip-v436">עבדת עד היום<b>'+elapsed+'</b><div class="vacation-note-v437">ימי עבודה שעברו בחודש, ללא שבתות וללא ימי חופש</div></div>'+
      '<div class="smart-tip-v436">נשאר לך לעבוד<b>'+remNoToday+'</b><div class="vacation-note-v437">ממחר עד סוף החודש, ללא שבתות וללא ימי חופש עתידיים · לא כולל היום</div></div>'+
      '<div class="smart-tip-v436">ימי עבודה שנשארו לחישוב יעד<b>'+rem+'</b><div class="vacation-note-v437">ממחר עד סוף החודש, פחות שבתות וחופש עתידי</div></div>'+ 
      '<div class="smart-tip-v436 smart-goal-focus-v436">צריך לכל יום עבודה<b>'+(goal?moneySafe(need):'—')+'</b><div class="vacation-note-v437">חסר ליעד חלקי ימי עבודה שנשארו</div></div>'+
      '</div>'+(goal?'<p class="muted">תחזית סוף חודש: '+(doneCount?moneySafe(forecast):'—')+' · נוסחה: בוצע בפועל '+moneySafe(total)+' + ממוצע ליום עבודה '+moneySafe(avg)+' × '+rem+' ימי עבודה שנשארו לחישוב יעד.</p>':'<p class="muted">לא הוגדר יעד חודשי, לכן אין חישוב יומי.</p>')+'</div>';
    box.insertBefore(wrap,box.firstChild);
  };

  async function refreshAfterVacation(){
    try{ if(typeof loadMonth==='function') await loadMonth(); else {renderCalendar();renderDay();renderStats();renderSmartDashboard();} }catch(e){try{renderCalendar();renderDay();renderStats();renderSmartDashboard();}catch(_e){}}
  }

  // לא מריצים טעינת ימי חופש לפני שיש עובד פעיל. זה היה מקור ההרשאות ברענון.
  document.addEventListener('DOMContentLoaded',function(){try{setTimeout(function(){if(typeof viewedWorker!=='undefined'&&viewedWorker&&viewedWorker.id){loadVacationDaysV487().then(function(){try{renderCalendar();renderDay();renderSmartDashboard();}catch(e){}});}},900);}catch(e){}});
})();
;
/*
===============================================================================
CHANGE 5.13 - OFFLINE SYNC SAFE LAYER
-------------------------------------------------------------------------------
שכבה בטוחה בלבד: לא מחליפה פונקציות שמירה, לא משנה collections ולא נוגעת ב-UI
הקיים. היא מאזינה למצב הרשת ול-metadata של Firestore כדי להציג כמה עבודות
נשמרו מקומית ועדיין ממתינות לסנכרון.
===============================================================================
*/
(function(){
  var state = {
    online: (typeof navigator === 'undefined') ? true : navigator.onLine !== false,
    pendingWorkEntries: 0,
    unsubscribe: null,
    lastScopeKey: '',
    lastSnapshotFromCache: false
  };

  function q(id){ return document.getElementById(id); }

  function ensureBadge(){
    var badge=q('offlineSyncBadgeV513');
    if(!badge){
      badge=document.createElement('div');
      badge.id='offlineSyncBadgeV513';
      badge.className='offline-sync-badge-v513 cache-v513';
      badge.innerHTML='<span class="dot-v513"></span><span id="offlineSyncTextV513">בודק חיבור...</span>';
    }
    /* v5.14: ממקמים את אינדיקטור החיבור בתוך פאנל הסטטוס העליון,
       מתחת/ליד הטקסט "מחובר/עובד/מנהל", במקום fixed בתחתית המסך. */
    try{
      var userLine=q('userLine');
      var topTarget=userLine && userLine.parentElement ? userLine.parentElement : null;
      if(topTarget && badge.parentElement !== topTarget){
        var versionMini = topTarget.querySelector ? topTarget.querySelector('.app-version-mini') : null;
        if(versionMini) topTarget.insertBefore(badge, versionMini);
        else topTarget.appendChild(badge);
      }else if(!badge.parentElement){
        document.body.appendChild(badge);
      }
    }catch(e){ try{ if(!badge.parentElement) document.body.appendChild(badge); }catch(_e){} }
    return badge;
  }

  function statusText(){
    var persistence = window.WM_OFFLINE_PERSISTENCE_STATUS || 'starting';
    var pending = Number(state.pendingWorkEntries || 0);
    if(!state.online){
      return pending > 0 ? '🔴 אופליין • ' + pending + ' עבודות ממתינות' : '🔴 אופליין';
    }
    if(pending > 0){
      return '🟡 מסנכרן • ' + pending + ' עבודות ממתינות';
    }
    if(persistence === 'enabled') return '🟢 אונליין • מסונכרן';
    if(persistence === 'starting') return '🔵 אונליין • מכין Offline';
    if(persistence === 'failed-precondition') return '🟢 אונליין • Offline פעיל בטאב אחר';
    return '🟢 אונליין';
  }

  window.updateOfflineSyncIndicatorV513 = function(){
    var badge=ensureBadge();
    if(!badge) return;
    var pending = Number(state.pendingWorkEntries || 0);
    var cls = !state.online ? 'offline-v513' : (pending > 0 ? 'syncing-v513' : ((window.WM_OFFLINE_PERSISTENCE_STATUS||'') === 'starting' ? 'cache-v513' : 'online-v513'));
    badge.className='offline-sync-badge-v513 ' + cls;
    var txt=q('offlineSyncTextV513');
    if(txt) txt.textContent=statusText();
  };

  function currentScopeKey(){
    try{
      if(window.session && window.session.role === 'admin') return 'admin:all';
      if(window.viewedWorker && window.viewedWorker.id) return 'worker:' + window.viewedWorker.id;
      if(typeof viewedWorker !== 'undefined' && viewedWorker && viewedWorker.id) return 'worker:' + viewedWorker.id;
      if(typeof session !== 'undefined' && session && session.role === 'admin') return 'admin:all';
    }catch(e){}
    return 'none';
  }

  function buildWorkEntriesQuery(scopeKey){
    try{
      if(!window.db && typeof db === 'undefined') return null;
      var database = window.db || db;
      if(scopeKey === 'admin:all') return database.collection('workEntries');
      if(scopeKey.indexOf('worker:') === 0){
        var workerId = scopeKey.slice('worker:'.length);
        if(workerId){
          // v6.04 BETA: pending-write listener watches only the same 730-day working window,
          // preventing an additional full-history snapshot on every login.
          var cutoff=new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate()-730);
          var cutoffStr=cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
          return database.collection('workEntries').where('workerId','==',workerId).where('date','>=',cutoffStr);
        }
      }
    }catch(e){ console.warn('v5.13 offline query build failed', e && e.message ? e.message : e); }
    return null;
  }

  function startPendingMonitorV513(){
    var scopeKey=currentScopeKey();
    if(scopeKey === state.lastScopeKey && state.unsubscribe) return;
    state.lastScopeKey=scopeKey;
    if(state.unsubscribe){ try{ state.unsubscribe(); }catch(e){} state.unsubscribe=null; }
    state.pendingWorkEntries=0;
    window.updateOfflineSyncIndicatorV513();
    var query=buildWorkEntriesQuery(scopeKey);
    if(!query) return;
    try{
      state.unsubscribe = query.onSnapshot({includeMetadataChanges:true}, function(snap){
        var count=0;
        try{
          state.lastSnapshotFromCache = !!(snap && snap.metadata && snap.metadata.fromCache);
          snap.forEach(function(doc){ if(doc && doc.metadata && doc.metadata.hasPendingWrites) count++; });
        }catch(e){}
        state.pendingWorkEntries=count;
        window.updateOfflineSyncIndicatorV513();
      }, function(err){
        console.warn('v5.13 pending sync monitor failed:', err && err.message ? err.message : err);
        state.pendingWorkEntries=0;
        window.updateOfflineSyncIndicatorV513();
      });
    }catch(e){ console.warn('v5.13 pending sync listener failed:', e && e.message ? e.message : e); }
  }
  window.startPendingWorkEntriesMonitorV513=startPendingMonitorV513;

  function refreshNetworkState(){
    state.online = (typeof navigator === 'undefined') ? true : navigator.onLine !== false;
    window.updateOfflineSyncIndicatorV513();
    setTimeout(startPendingMonitorV513,80);
  }

  window.addEventListener('online', refreshNetworkState);
  window.addEventListener('offline', refreshNetworkState);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) refreshNetworkState(); });

  // עטיפות בטוחות: אחרי טעינת עובד/אדמין/חודש מפעילים מחדש את המאזין לפי ההרשאה הנוכחית.
  ['showWorker','showAdmin','loadMonth','loadWorkers'].forEach(function(fnName){
    try{
      var original=window[fnName];
      if(typeof original === 'function' && !original.__offlineWrappedV513){
        var wrapped=function(){
          var result=original.apply(this,arguments);
          Promise.resolve(result).finally(function(){ setTimeout(startPendingMonitorV513,120); });
          return result;
        };
        wrapped.__offlineWrappedV513=true;
        window[fnName]=wrapped;
      }
    }catch(e){}
  });

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(refreshNetworkState,250); setTimeout(startPendingMonitorV513,900); });
  window.addEventListener('load', function(){ setTimeout(refreshNetworkState,250); setTimeout(startPendingMonitorV513,1100); });
})();
;
(function(){
  var finished=false;

  function el(){
    return document.getElementById("lastLoginLineV518");
  }

  function hideLine(){
    var node=el();
    if(!node) return;
    node.textContent="";
    node.classList.add("hidden");
    node.style.setProperty("display","none","important");
  }

  function showLine(text){
    var node=el();
    if(!node) return;
    node.classList.remove("hidden");
    node.style.setProperty("display","block","important");
    node.style.setProperty("visibility","visible","important");
    node.style.setProperty("opacity","1","important");
    node.textContent=String(text || "");
  }

  function dateLabel(value){
    try{
      if(!value) return "";
      var d=value;
      if(value && typeof value.toDate==="function") d=value.toDate();
      else if(value && typeof value.seconds==="number") d=new Date(value.seconds*1000);
      else if(typeof value==="string") d=new Date(value);
      else if(value instanceof Date) d=value;
      if(!d || isNaN(d.getTime())) return "";
      return d.toLocaleString("he-IL",{
        timeZone:"Asia/Jerusalem",
        day:"2-digit",
        month:"2-digit",
        year:"2-digit",
        hour:"2-digit",
        minute:"2-digit"
      });
    }catch(e){return "";}
  }

  function getFirebaseAuth(){
    try{
      if(window.firebase && firebase.auth) return firebase.auth();
    }catch(e){}
    return null;
  }

  function getFirestore(){
    try{
      if(window.firebase && firebase.firestore) return firebase.firestore();
    }catch(e){}
    return null;
  }

  async function runAfterAuth(user){
    if(finished || !user || !user.uid) return;
    finished=true;

    var fs=getFirestore();
    if(!fs){
      showLine("שגיאת התחברות אחרונה");
      return;
    }

    var ref=fs.collection("users").doc(user.uid);
    var previous=null;

    try{
      var snap=await ref.get();
    window.dayLockDebugV590&&window.dayLockDebugV590('PERSIST_EXISTING_DOC',snap.exists?{id:snap.id,data:snap.data()}: {exists:false});
      if(snap.exists){
        var data=snap.data() || {};
        previous=data.lastLoginAt || data.lastLoginClientAt || null;
      }
    }catch(readErr){
      showLine("שגיאת קריאת התחברות");
      return;
    }

    var label=dateLabel(previous);
    if(label){
      showLine("חובר לאחרונה: " + label);
    }else{
      showLine("מחובר עכשיו");
    }

    try{
      await ref.set({
        lastLoginAt:firebase.firestore.FieldValue.serverTimestamp(),
        lastLoginClientAt:new Date().toISOString(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
    }catch(writeErr){
      // לא מסתירים את התצוגה אם הקריאה הצליחה אבל הכתיבה נכשלה.
      console.warn("last login write failed", writeErr);
    }
  }

  function boot(){
    hideLine(); // במסך login לא מוצג כלום

    var a=getFirebaseAuth();
    if(!a){
      setTimeout(boot,500);
      return;
    }

    try{
      a.onAuthStateChanged(function(user){
        if(user && user.uid){
          runAfterAuth(user);
        }else{
          finished=false;
          hideLine();
        }
      });
    }catch(e){
      hideLine();
    }
  }

  setTimeout(boot,800);
})();
;
/*
===============================================================================
CHANGE 5.30 - GLOBAL PEKA COMPATIBILITY FIX
-------------------------------------------------------------------------------
תיקון נקודתי לשגיאת טעינה:
selectedSearchPekaV528 is not defined
בגרסה 5.28 חלק מפונקציות הפק״ע הוגדרו בתוך scope פנימי, אבל wrapper מאוחר יותר קרא להן
כפונקציות גלובליות. כאן אנחנו חושפים גרסאות בטוחות ל-window בלי לשנות את לוגיקת השמירה.
===============================================================================
*/
(function(){
  function normalizePekaTypeV528Safe(value){
    var v=String(value||'').trim().toUpperCase();
    return (v==='CN'||v==='CH') ? v : '';
  }
  function selectedSearchPekaV528Safe(){
    try{
      var el=document.getElementById('searchPekaTypeV528');
      return normalizePekaTypeV528Safe(el ? el.value : '');
    }catch(e){ return ''; }
  }
  function isPlannedEntryV530(e){
    try{
      return !!(e && (e.entryStatus==='planned' || e.status==='planned' || e.planned===true || e.isPlanned===true));
    }catch(err){ return false; }
  }
  function isDoneEntryForPekaStatsV528Safe(e){
    try{
      if(!e) return false;
      if(isPlannedEntryV530(e)) return false;
      var st=String(e.entryStatus||e.status||'done').toLowerCase();
      return st!=='planned' && st!=='not_done' && st!=='cancelled' && st!=='deleted';
    }catch(err){ return true; }
  }
  function getPekaStatsV528Safe(entries){
    var stats={CN:0,CH:0};
    try{
      (entries||[]).forEach(function(e){
        if(!e || e.workType!=='install' || !isDoneEntryForPekaStatsV528Safe(e)) return;
        var v=normalizePekaTypeV528Safe(e.pekaType);
        if(v==='CN') stats.CN++;
        if(v==='CH') stats.CH++;
      });
    }catch(err){}
    return stats;
  }
  function filterEntriesByPekaSearchV528Safe(entries){
    try{
      var p=selectedSearchPekaV528Safe();
      if(!p) return entries;
      return (entries||[]).filter(function(e){ return normalizePekaTypeV528Safe(e && e.pekaType)===p; });
    }catch(e){ return entries; }
  }
  function renderPekaSmartDashboardV528Safe(){
    try{
      var host=document.getElementById('smartDashboard') || document.getElementById('smartDash') || document.querySelector('.smart-dashboard-v436') || document.querySelector('.smart-box-v436') || document.getElementById('statsBox');
      if(!host) return;
      var entries=(typeof monthEntries!=='undefined' && Array.isArray(monthEntries)) ? monthEntries : [];
      var stats=getPekaStatsV528Safe(entries);
      var box=document.getElementById('pekaSmartStatsV528');
      if(!box){
        box=document.createElement('div');
        box.id='pekaSmartStatsV528';
        box.className='peka-smart-grid-v528';
        host.appendChild(box);
      }
      box.innerHTML =
        '<div class="peka-smart-card-v528"><div class="peka-smart-title-v528">פק״עות CN</div><div class="peka-smart-value-v528">'+stats.CN+'</div></div>'+ 
        '<div class="peka-smart-card-v528"><div class="peka-smart-title-v528">פק״עות CH</div><div class="peka-smart-value-v528">'+stats.CH+'</div></div>';
    }catch(e){ console.warn('renderPekaSmartDashboardV528Safe failed', e); }
  }
  function ensurePekaSearchFilterV528Safe(){
    try{
      if(document.getElementById('searchPekaTypeV528')) return;
      var searchPanel=document.getElementById('searchPanel');
      if(!searchPanel) return;
      var wrap=document.createElement('div');
      wrap.className='peka-search-row-v528';
      wrap.innerHTML =
        '<label style="font-weight:900;color:#64748b;font-size:13px">סינון לפי פק״ע</label>'+ 
        '<select id="searchPekaTypeV528" onchange="try{renderFullSummary()}catch(e){}">'+
          '<option value="">הכל</option>'+ 
          '<option value="CN">CN</option>'+ 
          '<option value="CH">CH</option>'+ 
        '</select>';
      var target=searchPanel.querySelector('.grid2,.grid3,.grid4,.search-grid,.filters-grid');
      if(target && target.parentNode) target.parentNode.insertBefore(wrap,target.nextSibling);
      else searchPanel.insertBefore(wrap, searchPanel.firstChild);
    }catch(e){ console.warn('ensurePekaSearchFilterV528Safe failed', e); }
  }

  window.normalizePekaTypeV528=window.normalizePekaTypeV528 || normalizePekaTypeV528Safe;
  window.selectedSearchPekaV528=window.selectedSearchPekaV528 || selectedSearchPekaV528Safe;
  window.isDoneEntryForPekaStatsV528=window.isDoneEntryForPekaStatsV528 || isDoneEntryForPekaStatsV528Safe;
  window.getPekaStatsV528=window.getPekaStatsV528 || getPekaStatsV528Safe;
  window.filterEntriesByPekaSearchV528=window.filterEntriesByPekaSearchV528 || filterEntriesByPekaSearchV528Safe;
  window.renderPekaSmartDashboardV528=window.renderPekaSmartDashboardV528 || renderPekaSmartDashboardV528Safe;
  window.ensurePekaSearchFilterV528=window.ensurePekaSearchFilterV528 || ensurePekaSearchFilterV528Safe;
})();
;
(function(){
  function bootPekaV528(){
    try{ ensurePekaSearchFilterV528(); }catch(e){}
    try{ renderPekaSmartDashboardV528(); }catch(e){}
    try{
      if(!window.__pekaSmartWrappedV528 && typeof window.renderSmartDashboard==='function'){
        var oldSmart=window.renderSmartDashboard;
        window.renderSmartDashboard=function(){
          var r=oldSmart.apply(this,arguments);
          try{ renderPekaSmartDashboardV528(); }catch(e){}
          return r;
        };
        window.__pekaSmartWrappedV528=true;
      }
    }catch(e){}
    try{
      if(!window.__pekaFullSummaryWrappedV528 && typeof window.renderFullSummary==='function'){
        var oldFull=window.renderFullSummary;
        window.renderFullSummary=function(){
          var selected=selectedSearchPekaV528();
          if(!selected) return oldFull.apply(this,arguments);
          var oldMonth=window.monthEntries;
          try{
            if(typeof monthEntries!=='undefined' && Array.isArray(monthEntries)){
              var original=monthEntries;
              monthEntries=filterEntriesByPekaSearchV528(monthEntries);
              var r=oldFull.apply(this,arguments);
              monthEntries=original;
              return r;
            }
          }catch(e){}
          return oldFull.apply(this,arguments);
        };
        window.__pekaFullSummaryWrappedV528=true;
      }
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(bootPekaV528,900);});
  window.addEventListener('load',function(){setTimeout(bootPekaV528,1300);});
  setInterval(function(){try{bootPekaV528();}catch(e){}},2000);
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ document.title = "מעקב עבודה - גרסה " + APP_VERSION; }catch(e){}

  var NOT_DONE_REASONS_V529 = [
    'לקוח לא בבית',
    'לקוח לא עונה',
    'לקוח ביטל',
    'ביקש מועד אחר',
    'אין תשתית',
    'השחלה תקועה',
    'אין גישה',
    'אחר'
  ];
  window.NOT_DONE_REASONS_V529 = NOT_DONE_REASONS_V529;

  function byId(id){ return document.getElementById(id); }
  function safeEsc(v){ try{return esc(v)}catch(e){return String(v||'')} }
  function safeMoney(v){ try{return money(v)}catch(e){return '₪'+Number(v||0)} }
  function safeHeDate(v){ try{return heDate(v)}catch(e){return String(v||'')} }
  function statusOfV529(e){ return e && e.entryStatus ? String(e.entryStatus) : 'done'; }
  function isPlannedV529(e){ return statusOfV529(e)==='planned'; }
  function isNotDoneV529(e){ return statusOfV529(e)==='not_done'; }
  function isDoneV529(e){ return !isPlannedV529(e) && !isNotDoneV529(e); }
  function pekaLineV529(e){
    var v=String((e&&e.pekaType)||'').trim().toUpperCase();
    return (v==='CN'||v==='CH') ? '<br><span class="peka-badge-v527">פק״ע: '+safeEsc(v)+'</span>' : '';
  }
  function entryTypeLabelV529(e){ return e && e.workType==='install' ? 'התקנה' : 'קריאת שירות'; }
  function detailsHtmlV529(e){
    if(!e) return '';
    var details='מספר לקוח: '+(e.customerNumber||'')+'\nכתובת: '+(e.address||'')+'\n';
    if(e.workType==='install'){
      details += (e.items||[]).map(function(i){return (i.name||'')+' × '+(i.quantity||0)+' = '+safeMoney(i.total||0)}).join('<br>');
      details += pekaLineV529(e)+'\n';
    }else{
      details += (e.isReturnCall?'קריאה חוזרת ללא תשלום':'קריאת שירות')+'\n';
    }
    if(isNotDoneV529(e)){
      details += 'לא בוצע — סיבה: '+(e.notDoneReason||'')+'\n';
      if(e.notDoneNote) details += 'פירוט: '+e.notDoneNote+'\n';
    }
    details += (e.notes||'');
    try{return nl2br(details)}catch(err){return String(details).replace(/\n/g,'<br>')}
  }

  function movePekaUnderTemplatesV529(){
    try{
      var wrap=byId('pekaTypeWrapV527');
      var sel=byId('installTemplateSelect');
      if(!wrap || !sel) return;
      var templateRow=sel.closest ? sel.closest('.grid2') : null;
      if(templateRow && templateRow.parentNode && templateRow.nextSibling!==wrap){
        templateRow.parentNode.insertBefore(wrap, templateRow.nextSibling);
        wrap.classList.add('peka-under-template-v529');
      }
    }catch(e){ console.warn('movePekaUnderTemplatesV529 failed',e); }
  }
  window.movePekaUnderTemplatesV529 = movePekaUnderTemplatesV529;

  function openNotDoneModalV529(entryId){
    try{ var old=byId('notDoneOverlayV529'); if(old) old.remove(); }catch(e){}
    var overlay=document.createElement('div');
    overlay.id='notDoneOverlayV529';
    overlay.className='not-done-overlay-v529';
    overlay.innerHTML='<div class="not-done-modal-v529" role="dialog" aria-modal="true">'+
      '<h3>סימון עבודה כלא בוצעה</h3>'+
      '<p class="muted">בחר סיבה. העבודה לא תימחק, היא תצא מהמתוזמנות ותישמר בדוחות.</p>'+
      '<select id="notDoneReasonSelectV529">'+NOT_DONE_REASONS_V529.map(function(r){return '<option value="'+safeEsc(r)+'">'+safeEsc(r)+'</option>';}).join('')+'</select>'+
      '<textarea id="notDoneNoteV529" class="not-done-other-v529 hidden" placeholder="כתוב סיבה חופשית"></textarea>'+
      '<div class="actions" style="margin-top:12px"><button class="btn-red" type="button" id="confirmNotDoneV529">שמור כלא בוצע</button><button class="btn-light" type="button" id="cancelNotDoneV529">ביטול</button></div>'+
      '<div id="notDoneMsgV529"></div>'+
      '</div>';
    document.body.appendChild(overlay);
    var select=byId('notDoneReasonSelectV529');
    var note=byId('notDoneNoteV529');
    function refreshOther(){ if(note) note.classList.toggle('hidden', !(select && select.value==='אחר')); }
    if(select) select.onchange=refreshOther;
    refreshOther();
    byId('cancelNotDoneV529').onclick=function(){ overlay.remove(); };
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) overlay.remove(); });
    byId('confirmNotDoneV529').onclick=function(){ saveNotDoneV529(entryId); };
  }
  window.openNotDoneModalV529=openNotDoneModalV529;

  async function saveNotDoneV529(entryId){
    var reason=(byId('notDoneReasonSelectV529')||{}).value||'';
    var note=(byId('notDoneNoteV529')||{}).value||'';
    var msg=byId('notDoneMsgV529');
    if(!reason){ if(msg) msg.innerHTML='<p class="danger">חובה לבחור סיבה.</p>'; return; }
    if(reason==='אחר' && !String(note).trim()){ if(msg) msg.innerHTML='<p class="danger">בחרת אחר — חובה לרשום סיבה.</p>'; return; }
    try{
      var entry=(Array.isArray(monthEntries)?monthEntries:[]).find(function(x){return x.id===entryId;}) || {};
      await db.collection('workEntries').doc(entryId).set({
        entryStatus:'not_done',
        notDoneReason:reason,
        notDoneNote:String(note||'').trim(),
        notDoneAt:firebase.firestore.FieldValue.serverTimestamp(),
        notDoneByWorkerId:(viewedWorker&&viewedWorker.id)||'',
        notDoneByName:(viewedWorker&&viewedWorker.name)||(session&&session.name)||'',
        originalEntryStatus:entry.entryStatus||'planned',
        originalAmount:Number(entry.originalAmount||entry.amount||0),
        amount:0,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      var overlay=byId('notDoneOverlayV529'); if(overlay) overlay.remove();
      if(byId('entryMsg')) byId('entryMsg').innerHTML='<div class="notice">העבודה סומנה כלא בוצעה ונשמרה בדוחות ✅</div>';
      if(typeof loadMonth==='function') await loadMonth();
    }catch(e){
      if(msg) msg.innerHTML='<p class="danger">שגיאה בשמירה: '+safeEsc(e.message||e)+'</p>';
    }
  }
  window.saveNotDoneV529=saveNotDoneV529;

  async function restorePlannedV529(entryId){
    if(!confirm('להחזיר את העבודה לסטטוס מתוזמן?')) return;
    try{
      var entry=(Array.isArray(monthEntries)?monthEntries:[]).find(function(x){return x.id===entryId;}) || {};
      var restoredAmount=Number(entry.originalAmount||0);
      if(!restoredAmount && Array.isArray(entry.items)) restoredAmount=entry.items.reduce(function(s,i){return s+Number(i.total||0)},0);
      if(!restoredAmount && entry.workType==='service' && !entry.isReturnCall) restoredAmount=Number(typeof SERVICE_PRICE!=='undefined'?SERVICE_PRICE:0);
      await db.collection('workEntries').doc(entryId).set({
        entryStatus:'planned',
        amount:restoredAmount,
        restoredToPlannedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      if(typeof loadMonth==='function') await loadMonth();
    }catch(e){ alert('שגיאה בהחזרה למתוזמן: '+(e.message||e)); }
  }
  window.restorePlannedV529=restorePlannedV529;

  function renderDayV529(){
    if(!selectedDate){ hide('dayPanel'); show('selectDayHint'); return; }
    show('dayPanel'); hide('selectDayHint');
    text('dateTitle','יום '+safeHeDate(selectedDate));
    try{ renderInstallItems(); }catch(e){}
    try{ setType(selectedType,false); }catch(e){}
    try{ updateServicePriceLabels(); }catch(e){}
    try{ movePekaUnderTemplatesV529(); }catch(e){}
    var entries=(Array.isArray(monthEntries)?monthEntries:[]).filter(function(e){return e.date===selectedDate;}).sort(function(a,b){return ((b.createdAt&&b.createdAt.seconds)||0)-((a.createdAt&&a.createdAt.seconds)||0)});
    var box=byId('dayEntries'); if(!box) return;
    box.innerHTML=entries.length?'':'<p class="muted">אין עבודות ביום הזה עדיין.</p>';
    entries.forEach(function(e){
      var planned=isPlannedV529(e), notDone=isNotDoneV529(e);
      var row=document.createElement('div');
      row.className='item'+(planned?' planned-card-v49':'')+(notDone?' not-done-card-v529':'');
      var iconClass=e.workType==='install'?'install':(e.isReturnCall?'return':'service');
      var icon=notDone?'🚫':(planned?'📋':(e.workType==='install'?'🛠️':(e.isReturnCall?'🔁':'☎️')));
      var badge=notDone?'<span class="not-done-badge-v529">לא בוצע</span>':(planned?'<span class="planned-badge-v49">מתוכנן</span>':'<span class="done-badge-v49">בוצע</span>');
      var actions='';
      if(planned){ actions+='<button class="btn-green" onclick="markEntryDoneV49(\''+e.id+'\')">בוצע</button><button class="btn-red" onclick="openNotDoneModalV529(\''+e.id+'\')">לא בוצע</button>'; }
      if(notDone){ actions+='<button class="btn-yellow" onclick="restorePlannedV529(\''+e.id+'\')">החזר למתוזמן</button>'; }
      actions+='<button class="btn-yellow" onclick="openEntryEdit(\''+e.id+'\')">ערוך</button>';
      if(!planned && !notDone && e.workType==='install') actions+='<button class="btn-light" onclick="saveEntryAsTemplate(\''+e.id+'\')">שמור כתבנית</button>';
      actions+='<button class="btn-red" onclick="deleteEntry(\''+e.id+'\')">מחק</button>';
      row.innerHTML='<div class="work-row-main"><div class="work-icon '+iconClass+'">'+icon+'</div><div><div class="item-title">'+safeEsc(e.description||entryTypeLabelV529(e))+' '+badge+'</div><div class="item-sub">'+detailsHtmlV529(e)+'</div></div></div><div><div class="money '+(planned?'planned-money-v49 ':'')+(notDone?'not-done-money-v529':'')+'">'+(notDone?'₪0':safeMoney(e.amount||0))+'</div><div class="actions" style="margin-top:8px">'+actions+'</div></div>';
      box.appendChild(row);
    });
    try{ if(typeof cleanVisibleSlashN==='function') cleanVisibleSlashN(); }catch(e){}
  }
  window.renderDay=renderDayV529;

  function appendNotDoneSmartDashboardV529(){
    try{
      var host=byId('smartDashboard'); if(!host) return;
      var old=byId('notDoneSmartPanelV529'); if(old) old.remove();
      var entries=(Array.isArray(monthEntries)?monthEntries:[]).filter(isNotDoneV529);
      var byReason={};
      entries.forEach(function(e){ var r=e.notDoneReason||'ללא סיבה'; byReason[r]=(byReason[r]||0)+1; });
      var panel=document.createElement('div');
      panel.id='notDoneSmartPanelV529';
      panel.className='not-done-panel-v529';
      var reasonHtml=Object.keys(byReason).length ? Object.keys(byReason).sort(function(a,b){return byReason[b]-byReason[a]}).map(function(r){return '<div class="not-done-reason-card-v529">'+safeEsc(r)+'<b>'+byReason[r]+'</b></div>';}).join('') : '<p class="muted">אין עבודות שלא בוצעו החודש.</p>';
      var listHtml=entries.length ? entries.slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));}).slice(0,12).map(function(e){
        // v5.84: כל כרטיס בדשבורד לחיץ ומנווט לפי ה-ID והתאריך הקיימים של הרשומה.
        var entryId=String(e.id||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        var entryDate=String(e.date||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return '<div class="item not-done-card-v529 smart-entry-link-v584" role="button" tabindex="0" onclick="openSmartEntryV584(\''+entryId+'\',\''+entryDate+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openSmartEntryV584(\''+entryId+'\',\''+entryDate+'\')}"><div><div class="item-title">'+safeHeDate(e.date)+' · '+safeEsc(entryTypeLabelV529(e))+' · '+safeEsc(e.customerNumber||'')+'</div><div class="item-sub">כתובת: '+safeEsc(e.address||'')+'<br>סיבה: '+safeEsc(e.notDoneReason||'')+(e.notDoneNote?'<br>פירוט: '+safeEsc(e.notDoneNote):'')+'</div></div><div class="not-done-badge-v529">לא בוצע</div></div>';
      }).join('') : '';
      panel.innerHTML='<h3>🚫 מתוזמנות שלא בוצעו</h3><p class="muted">סה״כ לא בוצעו החודש: <b>'+entries.length+'</b>. עבודות אלו לא נספרות כהכנסה ולא נשארות במתוזמנות.</p><div class="not-done-reason-grid-v529">'+reasonHtml+'</div>'+(listHtml?'<h3 style="margin-top:12px">פירוט אחרון</h3><div class="not-done-list-v529">'+listHtml+'</div>':'');
      host.appendChild(panel);
    }catch(e){ console.warn('appendNotDoneSmartDashboardV529 failed',e); }
  }
  window.appendNotDoneSmartDashboardV529=appendNotDoneSmartDashboardV529;

  function bootV529(){
    try{ movePekaUnderTemplatesV529(); }catch(e){}
    try{
      if(!window.__smartNotDoneWrappedV529 && typeof window.renderSmartDashboard==='function'){
        var oldSmart=window.renderSmartDashboard;
        window.renderSmartDashboard=function(){
          var r=oldSmart.apply(this,arguments);
          try{ appendNotDoneSmartDashboardV529(); }catch(e){}
          return r;
        };
        window.__smartNotDoneWrappedV529=true;
      }
    }catch(e){}
    try{ appendNotDoneSmartDashboardV529(); }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(bootV529,1100);});
  window.addEventListener('load',function(){setTimeout(bootV529,1500);});
  setInterval(function(){try{movePekaUnderTemplatesV529();}catch(e){}},1500);
})();
;
/*
===============================================================================
CHANGE 5.35 - איפוס שדות חדשים אחרי שמירה / מתוזמן / ניקוי
-------------------------------------------------------------------------------
תיקון נקודתי בלבד:
- סוג פק״ע CN/CH מתאפס אחרי שמירת התקנה רגילה או מתוזמנת ואחרי ניקוי בחירה.
- קריאת שירות חוזרת מתאפסת אחרי שמירת קריאת שירות רגילה או מתוזמנת.
- אין שינוי בלוגיקת שמירה, יום חופש, תבניות, דשבורד, אופליין, גיבוי או לוגין.
===============================================================================
*/
(function(){
  'use strict';
  var APP_VERSION_V535 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));

  function q(id){ return document.getElementById(id); }

  function updateVersionUiV535(){
    try{ window.APP_VERSION=APP_VERSION_V535; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V535; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V535; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V535; }); }catch(e){}
  }

  function resetPekaTypeV535(){
    try{
      var peka=q('pekaTypeV527');
      if(peka) peka.value='';
    }catch(e){}
  }

  function resetReturnCallV535(){
    try{
      var cb=q('sReturnCall');
      if(cb) cb.checked=false;
      if(typeof updateServicePreview==='function') updateServicePreview();
    }catch(e){}
  }

  function resetNewEntryFieldsV535(){
    resetPekaTypeV535();
    resetReturnCallV535();
    try{ if(typeof updateInstallPreview==='function') updateInstallPreview(); }catch(e){}
  }

  // חושפים פונקציה גלובלית בשם שהקוד הישן כבר מנסה לקרוא לו.
  window.resetPekaTypeV527=resetPekaTypeV535;
  window.resetNewEntryFieldsV535=resetNewEntryFieldsV535;

  // כפתור "נקה בחירה" של ההתקנה: מאפס גם את סוג הפק״ע.
  var oldClearInstallSelection=window.clearInstallSelection;
  window.clearInstallSelection=function(){
    var result;
    try{ if(typeof oldClearInstallSelection==='function') result=oldClearInstallSelection.apply(this,arguments); }catch(e){ console.warn('clearInstallSelection base failed in v5.35',e); }
    resetPekaTypeV535();
    try{ if(typeof updateInstallPreview==='function') updateInstallPreview(); }catch(e){}
    return result;
  };

  // resetEntryFormsAfterSaveV42 קיים בחלק מהשמירות הישנות; מוסיפים לו את השדות החדשים בלי לשכתב אותו.
  if(typeof window.resetEntryFormsAfterSaveV42==='function'){
    var oldResetEntryFormsAfterSaveV42=window.resetEntryFormsAfterSaveV42;
    window.resetEntryFormsAfterSaveV42=function(){
      var result=oldResetEntryFormsAfterSaveV42.apply(this,arguments);
      resetNewEntryFieldsV535();
      return result;
    };
  }

  // wmAfterLocalEntrySaveV516 היא שכבת השמירה הפעילה באופליין/אונליין ומתוזמנים.
  if(typeof window.wmAfterLocalEntrySaveV516==='function'){
    var oldAfterLocalSaveV516=window.wmAfterLocalEntrySaveV516;
    window.wmAfterLocalEntrySaveV516=function(){
      var result=oldAfterLocalSaveV516.apply(this,arguments);
      resetNewEntryFieldsV535();
      setTimeout(resetNewEntryFieldsV535,60);
      return result;
    };
  }

  // שכבת ביטחון: אחרי שמירה מוצלחת שמופיעה כהודעה, נוודא שהשדות החדשים לא נשארים מסומנים.
  ['addService','addInstall','addServicePlannedV49','addInstallPlannedV49'].forEach(function(fnName){
    try{
      var oldFn=window[fnName];
      if(typeof oldFn!=='function' || oldFn.__v535Wrapped) return;
      var wrapped=function(){
        var result=oldFn.apply(this,arguments);
        try{
          if(result && typeof result.then==='function'){
            result.then(function(){ setTimeout(resetNewEntryFieldsV535,80); }).catch(function(){});
          }else{
            setTimeout(function(){
              var msg=q('entryMsg');
              var html=msg ? String(msg.innerHTML||'') : '';
              if(html.indexOf('נשמר')>=0 || html.indexOf('נקלט')>=0 || html.indexOf('סידור')>=0) resetNewEntryFieldsV535();
            },120);
          }
        }catch(e){}
        return result;
      };
      wrapped.__v535Wrapped=true;
      window[fnName]=wrapped;
    }catch(e){}
  });

  function bootV535(){
    updateVersionUiV535();
    try{ resetNewEntryFieldsV535(); }catch(e){}
  }

  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV535,350); setTimeout(updateVersionUiV535,1500); });
  window.addEventListener('load',function(){ setTimeout(bootV535,450); setTimeout(updateVersionUiV535,1800); });
  setInterval(function(){ try{ updateVersionUiV535(); }catch(e){} },2500);
})();
;
/*
===============================================================================
CHANGE 5.36 - חזרה למסך בחירת סוג עבודה אחרי שמירה
-------------------------------------------------------------------------------
תיקון UX נקודתי בלבד:
- אחרי שמירת קריאת שירות / התקנה / מתוזמן / שמירה אופליין, היום נשאר נבחר.
- הטופס חוזר למצב כמו אחרי לחיצה חדשה על היום: רק כפתורי קריאת שירות, התקנה ויום חופש.
- אין שינוי בלוגיקת השמירה, בתבניות, ביום חופש, בדשבורד, בגיבוי או בלוגין.
===============================================================================
*/
(function(){
  'use strict';
  var APP_VERSION_V536 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));

  function q(id){ return document.getElementById(id); }

  function updateVersionUiV536(){
    try{ window.APP_VERSION=APP_VERSION_V536; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V536; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V536; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V536; }); }catch(e){}
  }

  function resetNewFieldsV536(){
    try{ if(typeof window.resetNewEntryFieldsV535==='function') window.resetNewEntryFieldsV535(); }catch(e){}
    try{ if(typeof window.resetPekaTypeV527==='function') window.resetPekaTypeV527(); }catch(e){}
    try{
      var cb=q('sReturnCall');
      if(cb) cb.checked=false;
      if(typeof window.updateServicePreview==='function') window.updateServicePreview();
    }catch(e){}
    try{
      var peka=q('pekaTypeV527');
      if(peka) peka.value='';
    }catch(e){}
  }

  function returnToDayChoiceV536(keepMessage){
    try{ resetNewFieldsV536(); }catch(e){}
    try{ if(typeof selectedType!=='undefined') selectedType=null; }catch(e){}
    try{
      if(typeof window.setType==='function'){
        window.setType(null,false);
      }else{
        var service=q('serviceForm'), install=q('installForm'), serviceBtn=q('serviceBtn'), installBtn=q('installBtn');
        if(service) service.classList.add('hidden');
        if(install) install.classList.add('hidden');
        if(serviceBtn) serviceBtn.classList.remove('active');
        if(installBtn) installBtn.classList.remove('active');
      }
    }catch(e){}
    try{
      if(!keepMessage){
        var msg=q('entryMsg');
        if(msg) msg.innerHTML='';
      }
    }catch(e){}
    try{
      if(typeof window.renderDay==='function') window.renderDay();
    }catch(e){
      try{ if(typeof window.renderCalendar==='function') window.renderCalendar(); }catch(err){}
    }
    try{ if(typeof window.renderCalendar==='function') window.renderCalendar(); }catch(e){}
    try{ if(typeof window.cleanVisibleSlashN==='function') window.cleanVisibleSlashN(); }catch(e){}
  }
  window.returnToDayChoiceV536=returnToDayChoiceV536;

  function scheduleReturnV536(){
    // רץ בכמה פעימות כדי לנצח טעינות חודש / renderDay מאוחרות שמגיעות אחרי השמירה.
    setTimeout(function(){ returnToDayChoiceV536(false); },80);
    setTimeout(function(){ returnToDayChoiceV536(false); },350);
    setTimeout(function(){ returnToDayChoiceV536(false); },900);
  }

  // שכבת השמירה המרכזית באופליין/אונליין ומתוזמנים.
  if(typeof window.wmAfterLocalEntrySaveV516==='function' && !window.wmAfterLocalEntrySaveV516.__v536Wrapped){
    var oldAfterLocalSaveV536=window.wmAfterLocalEntrySaveV516;
    var wrappedAfterLocalV536=function(){
      var result=oldAfterLocalSaveV536.apply(this,arguments);
      scheduleReturnV536();
      return result;
    };
    wrappedAfterLocalV536.__v536Wrapped=true;
    window.wmAfterLocalEntrySaveV516=wrappedAfterLocalV536;
  }

  // שכבת ביטחון על פונקציות השמירה הישירות.
  ['addService','addInstall','addServicePlannedV49','addInstallPlannedV49','addServiceWithStatusV49','addInstallWithStatusV49','addInstallWithStatusV411'].forEach(function(fnName){
    try{
      var oldFn=window[fnName];
      if(typeof oldFn!=='function' || oldFn.__v536Wrapped) return;
      var wrapped=function(){
        var result=oldFn.apply(this,arguments);
        try{
          if(result && typeof result.then==='function'){
            result.then(function(){ scheduleReturnV536(); }).catch(function(){});
          }else{
            scheduleReturnV536();
          }
        }catch(e){}
        return result;
      };
      wrapped.__v536Wrapped=true;
      window[fnName]=wrapped;
    }catch(e){}
  });

  function bootV536(){
    updateVersionUiV536();
    // לא מאפסים טופס בזמן טעינה רגילה; רק מעדכנים גרסה.
  }

  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV536,350); setTimeout(updateVersionUiV536,1500); });
  window.addEventListener('load',function(){ setTimeout(bootV536,450); setTimeout(updateVersionUiV536,1800); });
  setInterval(function(){ try{ updateVersionUiV536(); }catch(e){} },2500);
})();
;
(function(){
  'use strict';
  var APP_VERSION_V537 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));

  function q(id){ return document.getElementById(id); }
  function safeEsc(v){ try{ if(typeof esc==='function') return esc(v); }catch(e){} return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function safeHeDate(v){ try{ if(typeof heDate==='function') return heDate(v); }catch(e){} return String(v||''); }
  function jsArg(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
  function todayIso(){ try{ if(typeof todayStr==='function') return todayStr(); }catch(e){} var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function parseIsoDate(v){ var parts=String(v||'').split('-').map(Number); if(parts.length!==3||!parts[0]||!parts[1]||!parts[2]) return null; return new Date(parts[0],parts[1]-1,parts[2]); }
  function findEntry(id){ try{ return (Array.isArray(monthEntries)?monthEntries:[]).find(function(e){return e && String(e.id)===String(id);}); }catch(e){ return null; } }
  function updateVersionUiV537(){
    try{ window.APP_VERSION=APP_VERSION_V537; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V537; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V537; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V537; }); }catch(e){}
  }

  function ensureInstallScrollNoteV537(){
    var box=q('installItems');
    if(!box || box.dataset.v537ScrollReady==='1') return;
    box.dataset.v537ScrollReady='1';
    var note=document.createElement('div');
    note.className='install-scroll-note-v537';
    note.textContent='רשימת פריטי המחירון נגללת כאן בלבד';
    if(box.parentNode) box.parentNode.insertBefore(note, box);
  }
  var oldRenderInstallItems=window.renderInstallItems;
  if(typeof oldRenderInstallItems==='function' && !oldRenderInstallItems.__v537Wrapped){
    window.renderInstallItems=function(){
      var res=oldRenderInstallItems.apply(this,arguments);
      try{ ensureInstallScrollNoteV537(); }catch(e){}
      return res;
    };
    window.renderInstallItems.__v537Wrapped=true;
  }

  function extractEntryIdFromActions(actions){
    if(!actions) return '';
    var html=actions.innerHTML||'';
    var patterns=[
      /openEntryEdit\('([^']+)'\)/,
      /markEntryDoneV49\('([^']+)'\)/,
      /openNotDoneModalV529\('([^']+)'\)/,
      /restorePlannedV529\('([^']+)'\)/,
      /deleteEntry\('([^']+)'\)/,
      /saveEntryAsTemplate\('([^']+)'\)/
    ];
    for(var i=0;i<patterns.length;i++){ var m=html.match(patterns[i]); if(m && m[1]) return m[1]; }
    return '';
  }

  function addChangeDateButtonsV537(){
    try{
      var root=q('dayEntries'); if(!root) return;
      root.querySelectorAll('.actions').forEach(function(actions){
        if(actions.querySelector('.change-date-btn-v537')) return;
        var id=extractEntryIdFromActions(actions);
        if(!id) return;
        var btn=document.createElement('button');
        btn.type='button';
        btn.className='change-date-btn-v537';
        btn.textContent='📅 שינוי תאריך';
        btn.setAttribute('onclick',"changeEntryDateV537('"+jsArg(id)+"')");
        var deleteBtn=Array.from(actions.querySelectorAll('button')).find(function(b){ return /מחק/.test(b.textContent||''); });
        if(deleteBtn) actions.insertBefore(btn, deleteBtn);
        else actions.appendChild(btn);
      });
    }catch(e){ console.warn('v5.37 add date buttons failed',e); }
  }

  var oldRenderDayV537=window.renderDay;
  if(typeof oldRenderDayV537==='function' && !oldRenderDayV537.__v537Wrapped){
    window.renderDay=function(){
      var res=oldRenderDayV537.apply(this,arguments);
      try{ addChangeDateButtonsV537(); }catch(e){}
      try{ ensureInstallScrollNoteV537(); }catch(e){}
      return res;
    };
    window.renderDay.__v537Wrapped=true;
  }

  function closeChangeDateModalV537(){
    var old=q('changeDateModalV537');
    if(old) old.remove();
    try{ document.documentElement.style.overflow=''; document.body.style.overflow=''; }catch(e){}
  }
  window.closeChangeDateModalV537=closeChangeDateModalV537;

  window.changeEntryDateV537=function(id){
    var entry=findEntry(id) || {id:id,date:(typeof selectedDate!=='undefined'?selectedDate:todayIso())};
    var oldDate=entry.date || (typeof selectedDate!=='undefined'?selectedDate:todayIso());
    var old=q('changeDateModalV537'); if(old) old.remove();
    var overlay=document.createElement('div');
    overlay.id='changeDateModalV537';
    overlay.className='change-date-modal-v537';
    overlay.innerHTML='<div class="change-date-card-v537" role="dialog" aria-modal="true">'
      +'<h3>📅 שינוי תאריך</h3>'
      +'<p class="muted">הרשומה תעבור לתאריך החדש בלי מחיקה ובלי שכפול.</p>'
      +'<label style="font-weight:900;color:#64748b;font-size:13px">תאריך נוכחי</label>'
      +'<input type="text" value="'+safeEsc(safeHeDate(oldDate))+'" disabled>'
      +'<label style="font-weight:900;color:#64748b;font-size:13px">תאריך חדש</label>'
      +'<input id="changeDateInputV537" type="date" value="'+safeEsc(oldDate)+'">'
      +'<div id="changeDateMsgV537"></div>'
      +'<div class="change-date-actions-v537"><button class="btn-green" type="button" onclick="confirmChangeEntryDateV537(\''+jsArg(id)+'\')">שמור תאריך</button><button class="btn-light" type="button" onclick="closeChangeDateModalV537()">ביטול</button></div>'
      +'</div>';
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) closeChangeDateModalV537(); });
    document.body.appendChild(overlay);
    try{ document.documentElement.style.overflow='hidden'; document.body.style.overflow='hidden'; }catch(e){}
    setTimeout(function(){ var input=q('changeDateInputV537'); if(input) input.focus(); },80);
  };

  window.confirmChangeEntryDateV537=async function(id){
    var input=q('changeDateInputV537'), msg=q('changeDateMsgV537');
    var newDate=input ? input.value : '';
    if(!newDate || !parseIsoDate(newDate)){ if(msg) msg.innerHTML='<p class="danger">צריך לבחור תאריך תקין.</p>'; return; }
    var entry=findEntry(id);
    var oldDate=entry && entry.date ? entry.date : (typeof selectedDate!=='undefined'?selectedDate:'');
    if(newDate===oldDate){ if(msg) msg.innerHTML='<div class="notice">זה כבר התאריך הנוכחי.</div>'; return; }
    try{
      if(msg) msg.innerHTML='<div class="notice">מעדכן תאריך...</div>';
      await db.collection('workEntries').doc(id).set({
        date:newDate,
        dateChangedFrom:oldDate||'',
        dateChangedTo:newDate,
        dateChangedAt:new Date().toISOString(),
        dateChangedBy:(viewedWorker&&viewedWorker.name)||((session&&session.name)||''),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      closeChangeDateModalV537();
      var d=parseIsoDate(newDate);
      if(d){ try{ calendarDate=new Date(d.getFullYear(),d.getMonth(),1); }catch(e){} }
      try{ selectedDate=newDate; selectedType=null; }catch(e){}
      if(typeof loadMonth==='function') await loadMonth();
      try{ if(typeof renderCalendar==='function') renderCalendar(); }catch(e){}
      try{ if(typeof renderDay==='function') renderDay(); }catch(e){}
      try{ if(typeof renderStats==='function') renderStats(); }catch(e){}
      try{ if(typeof renderSmartDashboard==='function') renderSmartDashboard(); }catch(e){}
    }catch(err){
      if(msg) msg.innerHTML='<p class="danger">שגיאה בשינוי תאריך: '+safeEsc(err && (err.message||err.code) ? (err.message||err.code) : err)+'</p>';
    }
  };

  // v5.37: inject row into the existing Firestore changelog seed source without editing older logic.
  try{
    var oldRequired=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRequired==='function' && !oldRequired.__v537Wrapped){
      var wrapped=function(){
        var rows=[]; try{ rows=oldRequired.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.37'; });
        if(!exists){
          rows.unshift({version:'5.37',title:'גלילה למחירון התקנה + שינוי תאריך עבודה',createdAt:'2026-06-01',items:[
            'אזור פריטי המחירון בטופס התקנה קיבל גלילה פנימית כדי שהמסך לא יתארך יותר מדי.',
            'נוסף כפתור שינוי תאריך לכל עבודה שבוצעה, מתוזמנת או לא בוצעה.',
            'שינוי התאריך מעדכן את אותה רשומה קיימת ב-Firestore בלי מחיקה, בלי שכפול ובלי איבוד נתונים.',
            'לא שונו שמירת עבודות, יום חופש, תבניות, לא בוצע, אופליין, גיבוי, אקסל או לוגין.'
          ]});
        }
        return rows;
      };
      wrapped.__v537Wrapped=true;
      window.requiredChangelogRows=wrapped;
      try{ requiredChangelogRows=wrapped; }catch(e){}
    }
  }catch(e){}

  function bootV537(){
    updateVersionUiV537();
    ensureInstallScrollNoteV537();
    addChangeDateButtonsV537();
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV537,250); setTimeout(bootV537,1300); setTimeout(bootV537,2600); });
  window.addEventListener('load',function(){ setTimeout(bootV537,250); setTimeout(bootV537,1400); setTimeout(bootV537,2800); });
  setInterval(function(){ try{ updateVersionUiV537(); addChangeDateButtonsV537(); }catch(e){} },2200);
})();
;
(function(){
  'use strict';
  var APP_VERSION_V538 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));
  function q(id){return document.getElementById(id);}
  function safeEsc(v){try{if(typeof esc==='function')return esc(v);}catch(e){}return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function safeHeDate(v){try{if(typeof heDate==='function')return heDate(v);}catch(e){}return String(v||'');}
  function parseIsoDateV538(v){var p=String(v||'').split('-').map(Number);if(p.length!==3||!p[0]||!p[1]||!p[2])return null;return new Date(p[0],p[1]-1,p[2]);}
  function findEntryV538(id){try{return (Array.isArray(monthEntries)?monthEntries:[]).find(function(e){return e&&String(e.id)===String(id);});}catch(e){return null;}}
  function selectedWorkerIdV538(){try{if(typeof viewedWorker!=='undefined'&&viewedWorker&&viewedWorker.id)return viewedWorker.id;}catch(e){}try{if(typeof session!=='undefined'&&session&&session.workerId)return session.workerId;}catch(e){}return '';}
  function selectedWorkerNameV538(){try{if(typeof viewedWorker!=='undefined'&&viewedWorker&&viewedWorker.name)return viewedWorker.name;}catch(e){}try{if(typeof session!=='undefined'&&session&&session.name)return session.name;}catch(e){}return '';}
  function updateVersionUiV538(){
    try{window.APP_VERSION=APP_VERSION_V538;}catch(e){}
    try{document.title='מעקב עבודה - גרסה '+APP_VERSION_V538;}catch(e){}
    try{document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){el.textContent=APP_VERSION_V538;});}catch(e){}
    try{document.querySelectorAll('.secret,#secretTap').forEach(function(el){el.textContent='גרסה '+APP_VERSION_V538;});}catch(e){}
  }
  function isSaturdayV538(dateStr){var d=parseIsoDateV538(dateStr);return !!(d&&d.getDay()===6);}
  async function isVacationDateV538(dateStr){
    try{if(typeof window.isVacationDayV437==='function'&&window.isVacationDayV437(dateStr))return true;}catch(e){}
    try{if(Array.isArray(window.vacationDaysV437)&&window.vacationDaysV437.indexOf(dateStr)>=0)return true;}catch(e){}
    var workerId=selectedWorkerIdV538();
    if(!workerId||typeof db==='undefined'||!db||!db.collection)return false;
    try{
      var snap=await db.collection('workerDaysOff').where('workerId','==',workerId).get();
      var found=false;
      snap.docs.forEach(function(doc){var d=doc.data()||{};if(d.active!==false&&String(d.date||'')===String(dateStr))found=true;});
      return found;
    }catch(e){
      console.warn('v5.38 vacation date validation failed',e&& (e.code||e.message)?(e.code||e.message):e);
      // אם הבדיקה מול Firestore נכשלה, לא חוסמים סתם; עדיין נשארת בדיקה מקומית אם נטענה.
      return false;
    }
  }
  async function validateChangeDateTargetV538(dateStr,msg){
    if(!dateStr||!parseIsoDateV538(dateStr)){if(msg)msg.innerHTML='<p class="danger">צריך לבחור תאריך תקין.</p>';return false;}
    if(isSaturdayV538(dateStr)){if(msg)msg.innerHTML='<p class="danger">אי אפשר להעביר עבודה ליום שבת. שבת חסומה לעבודה, והתאריך לא שונה.</p>';return false;}
    if(await isVacationDateV538(dateStr)){if(msg)msg.innerHTML='<p class="danger">אי אפשר להעביר עבודה ליום חופש מסומן. בטל קודם את יום החופש או בחר תאריך אחר. התאריך לא שונה.</p>';return false;}
    return true;
  }
  window.confirmChangeEntryDateV537=async function(id){
    var input=q('changeDateInputV537'), msg=q('changeDateMsgV537');
    var newDate=input ? input.value : '';
    if(!(await validateChangeDateTargetV538(newDate,msg))) return;
    var entry=findEntryV538(id);
    var oldDate=entry&&entry.date?entry.date:(typeof selectedDate!=='undefined'?selectedDate:'');
    if(newDate===oldDate){if(msg)msg.innerHTML='<div class="notice">זה כבר התאריך הנוכחי.</div>';return;}
    try{
      if(msg)msg.innerHTML='<div class="notice">מעדכן תאריך...</div>';
      await db.collection('workEntries').doc(id).set({
        date:newDate,
        dateChangedFrom:oldDate||'',
        dateChangedTo:newDate,
        dateChangedAt:new Date().toISOString(),
        dateChangedBy:selectedWorkerNameV538(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      try{if(typeof closeChangeDateModalV537==='function')closeChangeDateModalV537();}catch(e){}
      var d=parseIsoDateV538(newDate);
      if(d){try{calendarDate=new Date(d.getFullYear(),d.getMonth(),1);}catch(e){}}
      try{selectedDate=newDate;selectedType=null;}catch(e){}
      if(typeof loadMonth==='function')await loadMonth();
      try{if(typeof loadVacationDaysV437==='function')await loadVacationDaysV437();}catch(e){}
      try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof renderDay==='function')renderDay();}catch(e){}
      try{if(typeof renderStats==='function')renderStats();}catch(e){}
      try{if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(e){}
    }catch(err){
      if(msg)msg.innerHTML='<p class="danger">שגיאה בשינוי תאריך: '+safeEsc(err&&(err.message||err.code)?(err.message||err.code):err)+'</p>';
    }
  };
  window.confirmChangeEntryDateV538=window.confirmChangeEntryDateV537;
  try{
    var oldRequired=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof oldRequired==='function'&&!oldRequired.__v538Wrapped){
      var wrapped=function(){
        var rows=[];try{rows=oldRequired.apply(this,arguments)||[];}catch(e){rows=[];}
        var exists=rows.some(function(r){return String(r.version||r.id||'')==='5.38';});
        if(!exists){rows.unshift({version:'5.38',title:'חסימת שינוי תאריך לשבת או יום חופש',createdAt:'2026-06-01',items:[
          'שינוי תאריך לא מאפשר להעביר עבודה ליום שבת.',
          'שינוי תאריך לא מאפשר להעביר עבודה ליום שמסומן כיום חופש.',
          'במקרה חסום מוצגת הודעה ברורה והתאריך המקורי נשאר ללא שינוי.',
          'לא שונו שמירת עבודות, מתוזמנות, לא בוצע, מחירון, תבניות, דשבורד, אופליין, גיבוי, אקסל או לוגין.'
        ]});}
        return rows;
      };
      wrapped.__v538Wrapped=true;
      window.requiredChangelogRows=wrapped;
      try{requiredChangelogRows=wrapped;}catch(e){}
    }
  }catch(e){}
  function bootV538(){updateVersionUiV538();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootV538);else bootV538();
  window.addEventListener('load',bootV538);
  setInterval(function(){try{updateVersionUiV538();}catch(e){}},2500);
})();
;
/* ===== v5.63: PDF חודשי מקצועי מלא - טעינה עצמאית לפי חודש ===== */
(function(){
  'use strict';

  function q(id){ return document.getElementById(id); }
  function safe(v){
    try{ if(typeof esc === 'function') return esc(v); }catch(e){}
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function moneyPdf(v){
    var n=Number(v||0);
    try{ return '₪'+n.toLocaleString('he-IL',{maximumFractionDigits:0}); }catch(e){ return '₪'+Math.round(n); }
  }
  function pctPdf(v){
    var n=Number(v||0);
    if(!isFinite(n)) n=0;
    return n.toLocaleString('he-IL',{maximumFractionDigits:1})+'%';
  }
  function datePdf(v){
    try{ if(typeof heDate === 'function') return heDate(v); }catch(e){}
    return String(v||'');
  }
  function monthLabelV563(month){
    var names=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    var p=String(month||'').split('-');
    var y=Number(p[0]||0), m=Number(p[1]||0);
    return (m>=1&&m<=12?names[m-1]+' ':'')+(y||String(month||''));
  }
  function currentReportMonthV563(){
    var settlementMonth=q('settlementMonthV547');
    if(settlementMonth && settlementMonth.value) return settlementMonth.value;
    try{ if(typeof settlementDefaultMonthV547 === 'function') return settlementDefaultMonthV547(); }catch(e){}
    try{ return calendarDate.getFullYear()+'-'+String(calendarDate.getMonth()+1).padStart(2,'0'); }catch(e){}
    return new Date().toISOString().slice(0,7);
  }
  function monthRangeV563(month){
    var p=String(month||'').split('-');
    var y=Number(p[0]), m=Number(p[1]);
    if(!y||!m){ var now=new Date(); y=now.getFullYear(); m=now.getMonth()+1; }
    var last=new Date(y,m,0).getDate();
    return {y:y,m:m,start:y+'-'+String(m).padStart(2,'0')+'-01',end:y+'-'+String(m).padStart(2,'0')+'-'+String(last).padStart(2,'0'),last:last};
  }
  function entryStatusV563(e){ return String((e&&(e.entryStatus||e.status))||'done').toLowerCase(); }
  function isPlannedForPdfV563(e){
    var st=entryStatusV563(e);
    if(st==='planned') return true;
    try{ if(typeof window.isPlannedV49==='function' && window.isPlannedV49(e)) return true; }catch(err){}
    return !!(e && (e.planned===true || e.isPlanned===true));
  }
  function isDoneForPdfV563(e){
    var st=entryStatusV563(e);
    if(st==='planned'||st==='not_done'||st==='cancelled') return false;
    if(isPlannedForPdfV563(e)) return false;
    return true;
  }
  function isNotDoneV563(e){ return entryStatusV563(e)==='not_done'; }
  async function allEntriesForMonthV563(month){
    try{
      if(!viewedWorker || !viewedWorker.id) return [];
      var r=monthRangeV563(month);
      var snap=await db.collection('workEntries').where('workerId','==',viewedWorker.id).get();
      return snap.docs.map(function(d){return Object.assign({id:d.id},d.data());}).filter(function(e){return String(e.date||'')>=r.start && String(e.date||'')<=r.end;});
    }catch(err){ console.error('PDF report entries load failed',err); return []; }
  }
  async function vacationDaysForMonthV563(month){
    try{
      if(!viewedWorker || !viewedWorker.id) return [];
      var r=monthRangeV563(month);
      var snap=await db.collection('workerDaysOff').where('workerId','==',viewedWorker.id).get();
      var arr=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());}).filter(function(x){
        return x && x.active!==false && String(x.date||'')>=r.start && String(x.date||'')<=r.end;
      }).map(function(x){return String(x.date||'');});
      return Array.from(new Set(arr)).sort();
    }catch(e){ console.warn('PDF vacation days load skipped', e && (e.code||e.message) ? (e.code||e.message) : e); return []; }
  }
  async function readPdfSettlementDataV563(month){
    try{
      if(typeof readSavedSettlementV548 === 'function'){
        var saved=await readSavedSettlementV548(month);
        return (saved && saved.exists) ? (saved.data||{}) : {};
      }
      if(typeof settlementRefV548 === 'function'){
        var ref=settlementRefV548(month);
        if(ref){ var doc=await ref.get(); return doc.exists ? (doc.data()||{}) : {}; }
      }
      if(viewedWorker && viewedWorker.id){
        var doc2=await db.collection('workers').doc(viewedWorker.id).collection('monthlySettlements').doc(String(month||'')).get();
        return doc2.exists ? (doc2.data()||{}) : {};
      }
    }catch(e){ console.warn('PDF settlement data load skipped', e && (e.code||e.message) ? (e.code||e.message) : e); }
    return {};
  }
  function goalForMonthV563(month){
    try{ if(typeof getWorkerGoalForMonthV556==='function') return Number(getWorkerGoalForMonthV556(month)||0); }catch(e){}
    var w=viewedWorker||{};
    var map=(w && typeof w.monthlyGoalsByMonth==='object' && w.monthlyGoalsByMonth) ? w.monthlyGoalsByMonth : {};
    if(map && map[month]!==undefined) return Number(map[month]||0);
    return Number(w.monthlyGoal||0);
  }
  function settlementIncomeV563(data){
    data=data||{};
    var b=(data.actualIncomeBreakdown && typeof data.actualIncomeBreakdown==='object') ? data.actualIncomeBreakdown : {};
    var legacy=Number(data.actualIncomeBeforeVat||0);
    var rf=Number(b.rf||0), fiber=Number(b.fiber||0), sales=Number(b.sales||0);
    var general=Number(b.general!==undefined?b.general:(legacy && !(rf||fiber||sales) ? legacy : 0));
    return {rf:rf,fiber:fiber,sales:sales,general:general,total:rf+fiber+sales+general};
  }
  function settlementDeductionsV563(data){
    data=data||{};
    var equipment=Number(data.equipmentDeduction||0);
    var fine=Number(data.fineDeduction!==undefined?data.fineDeduction:(data.fineAmount||0));
    var rows=Array.isArray(data.deductions)?data.deductions:[];
    var extra=rows.reduce(function(s,x){return s+Number(x.amount||0);},0);
    return {equipment:equipment,fine:fine,rows:rows,extra:extra,total:equipment+fine+extra};
  }
  function totalsV563(doneEntries){
    var expected=doneEntries.reduce(function(s,e){return s+Number(e.amount||0);},0);
    return {
      expected:expected,
      expectedVat:expected*0.18,
      expectedGross:expected*1.18,
      services:doneEntries.filter(function(e){return e.workType==='service';}).length,
      installs:doneEntries.filter(function(e){return e.workType==='install';}).length,
      returnCalls:doneEntries.filter(function(e){return e.workType==='service' && e.isReturnCall;}).length,
      pekaCN:doneEntries.filter(function(e){return String(e.pekaType||'').toUpperCase()==='CN';}).length,
      pekaCH:doneEntries.filter(function(e){return String(e.pekaType||'').toUpperCase()==='CH';}).length,
      count:doneEntries.length
    };
  }
  function groupByDayV563(entries, vacationDays){
    var map={};
    entries.forEach(function(e){
      var d=e.date||'ללא תאריך';
      if(!map[d]) map[d]={date:d,entries:[],done:[],planned:[],notDone:[],total:0,services:0,installs:0,cn:0,ch:0,vacation:false};
      map[d].entries.push(e);
      if(isNotDoneV563(e)){ map[d].notDone.push(e); return; }
      if(isPlannedForPdfV563(e)){ map[d].planned.push(e); return; }
      map[d].done.push(e);
      map[d].total+=Number(e.amount||0);
      if(e.workType==='service') map[d].services++;
      if(e.workType==='install') map[d].installs++;
      if(String(e.pekaType||'').toUpperCase()==='CN') map[d].cn++;
      if(String(e.pekaType||'').toUpperCase()==='CH') map[d].ch++;
    });
    (vacationDays||[]).forEach(function(d){
      if(!map[d]) map[d]={date:d,entries:[],done:[],planned:[],notDone:[],total:0,services:0,installs:0,cn:0,ch:0,vacation:true};
      map[d].vacation=true;
    });
    return Object.keys(map).sort().map(function(k){return map[k];});
  }
  function itemsHtmlV563(e){
    if(e.workType!=='install' || !Array.isArray(e.items) || !e.items.length){
      return e.isReturnCall ? 'קריאת שירות חוזרת / ללא תשלום' : 'קריאת שירות';
    }
    return e.items.map(function(i){return safe(i.name||'')+' × '+safe(i.quantity||0)+' = '+moneyPdf(i.total||0);}).join('<br>');
  }
  function barHtmlV563(label,value,max,cls){
    var pct=max>0?Math.max(3,Math.min(100,Math.round(Number(value||0)/max*100))):0;
    return '<div class="wm-pdf-bar-row"><div class="wm-pdf-bar-label">'+safe(label)+'</div><div class="wm-pdf-bar-track"><div class="wm-pdf-bar-fill '+(cls||'')+'" style="width:'+pct+'%"></div></div><div class="wm-pdf-bar-value">'+moneyPdf(value)+'</div></div>';
  }
  function kpiV563(label,value,cls){ return '<div class="wm-pdf-kpi"><div>'+safe(label)+'</div><b class="'+(cls||'')+'">'+value+'</b></div>'; }
  function miniV563(label,value,cls){ return '<div><span>'+safe(label)+'</span><b class="'+(cls||'')+'">'+value+'</b></div>'; }
  function buildReportHtmlV563(ctx){
    var month=ctx.month, allEntries=ctx.allEntries||[], vacationDays=ctx.vacationDays||[], settlement=ctx.settlement||{};
    var done=allEntries.filter(isDoneForPdfV563);
    var notDone=allEntries.filter(isNotDoneV563);
    var planned=allEntries.filter(function(e){return isPlannedForPdfV563(e) && !isNotDoneV563(e);});
    var t=totalsV563(done);
    var inc=settlementIncomeV563(settlement);
    var ded=settlementDeductionsV563(settlement);
    var goal=goalForMonthV563(month);
    var netBeforeVat=inc.total-ded.total;
    var vatAfter=netBeforeVat*0.18;
    var grossAfter=netBeforeVat+vatAfter;
    var diff=inc.total-t.expected;
    var goalPct=goal>0 ? (t.expected/goal*100) : 0;
    var days=groupByDayV563(allEntries, vacationDays);
    var workDaysWithDone=days.filter(function(d){return d.done&&d.done.length;}).length;
    var maxDay=days.reduce(function(m,d){return Math.max(m,d.total);},0);
    var cat=[
      {label:'RF',value:inc.rf,cls:'green'},
      {label:'סיבים',value:inc.fiber,cls:'green'},
      {label:'מכירות',value:inc.sales,cls:'green'},
      {label:'הכנסה כללית',value:inc.general,cls:'green'},
      {label:'ציוד שחור',value:ded.equipment,cls:'red'},
      {label:'קנסות',value:ded.fine,cls:'red'},
      {label:'הוצאות נוספות',value:ded.extra,cls:'red'}
    ];
    var maxCat=cat.reduce(function(m,x){return Math.max(m,Number(x.value||0));},0);
    var workerName=(viewedWorker&&viewedWorker.name)||'';
    var now=new Date().toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'});
    var notes=settlement.notes||'';
    var dailyRows=days.map(function(d){
      return '<tr class="'+(d.vacation?'vac-row':'')+'"><td>'+datePdf(d.date)+'</td><td>'+(d.vacation?'יום חופש':'')+'</td><td>'+((d.done||[]).length)+'</td><td>'+d.services+'</td><td>'+d.installs+'</td><td>'+d.cn+' / '+d.ch+'</td><td>'+((d.notDone||[]).length)+'</td><td>'+moneyPdf(d.total)+'</td></tr>';
    }).join('');
    var notDoneReasons={};
    notDone.forEach(function(e){ var r=e.notDoneReason||e.cancelReason||e.reason||'ללא סיבה'; notDoneReasons[r]=(notDoneReasons[r]||0)+1; });
    var notDoneHtml=Object.keys(notDoneReasons).length ? Object.keys(notDoneReasons).map(function(k){return '<span class="wm-pdf-pill red">'+safe(k)+': '+notDoneReasons[k]+'</span>';}).join('') : '<span class="wm-pdf-pill muted">אין פק״עות לא בוצעו</span>';
    var dayPages=days.filter(function(day){return (day.done&&day.done.length)||(day.notDone&&day.notDone.length)||day.vacation;}).map(function(day){
      var jobs=(day.done||[]).sort(function(a,b){return String((a.createdAt&&a.createdAt.seconds)||'').localeCompare(String((b.createdAt&&b.createdAt.seconds)||''));}).map(function(e){
        var peka=String(e.pekaType||'').toUpperCase();
        return '<div class="wm-pdf-job"><div class="wm-pdf-job-head"><b>'+safe(e.description||((e.workType==='install')?'התקנה':'קריאת שירות'))+'</b><span>'+moneyPdf(e.amount||0)+'</span></div>'+ 
          '<div class="wm-pdf-job-meta">לקוח: '+safe(e.customerNumber||'')+' · כתובת: '+safe(e.address||'')+(peka?' · פק״ע: '+safe(peka):'')+'</div>'+ 
          '<div class="wm-pdf-job-details">'+itemsHtmlV563(e)+'</div>'+ 
          (e.notes?'<div class="wm-pdf-job-notes">'+safe(e.notes)+'</div>':'')+'</div>';
      }).join('');
      var nd=(day.notDone||[]).map(function(e){
        return '<div class="wm-pdf-job wm-pdf-job-red"><div class="wm-pdf-job-head"><b>לא בוצע</b><span>₪0</span></div><div class="wm-pdf-job-meta">לקוח: '+safe(e.customerNumber||'')+' · כתובת: '+safe(e.address||'')+'</div><div class="wm-pdf-job-details">סיבה: '+safe(e.notDoneReason||e.cancelReason||e.reason||'')+'<br>'+safe(e.notDoneNote||e.notes||'')+'</div></div>';
      }).join('');
      return '<section class="wm-pdf-day"><h2>'+datePdf(day.date)+(day.vacation?' · יום חופש':'')+'</h2><div class="wm-pdf-day-total">סה״כ יום: '+moneyPdf(day.total)+' · עבודות שבוצעו: '+((day.done||[]).length)+' · לא בוצעו: '+((day.notDone||[]).length)+'</div>'+(jobs||'')+(nd||'')+(!jobs&&!nd&&day.vacation?'<div class="wm-pdf-vacation-box">🏖️ יום חופש — לא קיימות עבודות ביום הזה.</div>':'')+'</section>';
    }).join('');
    var diffCls=diff<0?'red-text':(diff>0?'green-text':'muted-text');
    var diffTxt=diff<0?'חסר '+moneyPdf(Math.abs(diff)):(diff>0?'עודף '+moneyPdf(diff):'מאוזן');
    var deductionRows=(ded.rows||[]).map(function(r){return '<tr><td>'+safe(r.name||r.label||'הוצאה')+'</td><td class="red-text">'+moneyPdf(r.amount||0)+'</td></tr>';}).join('');
    return '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>דוח חודשי '+safe(month)+'</title><style>'+cssV563()+'</style></head><body>'+ 
      '<section class="wm-pdf-cover"><div class="wm-pdf-logo">₪</div><h1>דוח חודשי מקצועי</h1><h2>'+safe(monthLabelV563(month))+'</h2><p>עובד: <b>'+safe(workerName)+'</b> · הופק: '+safe(now)+' · גרסה '+safe(window.APP_VERSION||APP_VERSION||'')+'</p>'+ 
      '<div class="wm-pdf-kpis">'+
        kpiV563('סכום מערכת לפני מע״מ',moneyPdf(t.expected),'green-text')+
        kpiV563('יעד חודשי',moneyPdf(goal),'')+
        kpiV563('עמידה ביעד',pctPdf(goalPct),goalPct>=100?'green-text':'red-text')+
        kpiV563('נטו נקסטקום לפני מע״מ',moneyPdf(netBeforeVat),netBeforeVat>=0?'green-text':'red-text')+
      '</div></section>'+ 
      '<section class="wm-pdf-page"><h2>תקציר כספי</h2><div class="wm-pdf-kpis">'+
        kpiV563('RF לפני מע״מ',moneyPdf(inc.rf),'green-text')+
        kpiV563('סיבים לפני מע״מ',moneyPdf(inc.fiber),'green-text')+
        kpiV563('מכירות לפני מע״מ',moneyPdf(inc.sales),'green-text')+
        kpiV563('סה״כ הכנסות נקסטקום',moneyPdf(inc.total),'green-text')+
        kpiV563('סה״כ קיזוזים',moneyPdf(ded.total),'red-text')+
        kpiV563('נטו לפני מע״מ',moneyPdf(netBeforeVat),netBeforeVat>=0?'green-text':'red-text')+
        kpiV563('מע״מ 18%',moneyPdf(vatAfter),'')+
        kpiV563('סכום סופי כולל מע״מ',moneyPdf(grossAfter),grossAfter>=0?'green-text':'red-text')+
      '</div><div class="wm-pdf-note"><b>הפרש מול סכום המערכת:</b> <span class="'+diffCls+'">'+diffTxt+'</span></div></section>'+ 
      '<section class="wm-pdf-page"><h2>ביצועים חודשיים</h2><div class="wm-pdf-mini-grid">'+
        miniV563('עבודות שבוצעו',t.count,'')+miniV563('קריאות שירות',t.services,'')+miniV563('התקנות',t.installs,'')+miniV563('קריאות חוזרות',t.returnCalls,'')+
        miniV563('פק״ע CN',t.pekaCN,'')+miniV563('פק״ע CH',t.pekaCH,'')+miniV563('לא בוצעו',notDone.length,'red-text')+miniV563('ימי חופש',vacationDays.length,'')+miniV563('ימי עבודה בפועל',workDaysWithDone,'')+miniV563('מתוזמנות בחודש',planned.length,'')+
      '</div><h3>לא בוצעו לפי סיבה</h3><div class="wm-pdf-pills">'+notDoneHtml+'</div></section>'+ 
      '<section class="wm-pdf-page"><h2>גרפים</h2><div class="wm-pdf-split"><div><h3>הכנסה לפי יום</h3>'+days.filter(function(d){return d.total>0;}).map(function(d){return barHtmlV563(datePdf(d.date),d.total,maxDay,'green');}).join('')+'</div><div><h3>התחשבנות נקסטקום</h3>'+cat.map(function(x){return barHtmlV563(x.label,x.value,maxCat,x.cls);}).join('')+'</div></div></section>'+ 
      '<section class="wm-pdf-page"><h2>סיכום לפי ימים</h2><table><thead><tr><th>תאריך</th><th>סטטוס</th><th>בוצעו</th><th>שירות</th><th>התקנות</th><th>CN/CH</th><th>לא בוצעו</th><th>סה״כ</th></tr></thead><tbody>'+dailyRows+'</tbody></table></section>'+ 
      dayPages+
      '<section class="wm-pdf-page"><h2>התחשבנות נקסטקום מלאה</h2><div class="wm-pdf-split"><div><h3>הכנסות לפני מע״מ</h3><table><tbody><tr><td>RF</td><td class="green-text">'+moneyPdf(inc.rf)+'</td></tr><tr><td>סיבים</td><td class="green-text">'+moneyPdf(inc.fiber)+'</td></tr><tr><td>מכירות</td><td class="green-text">'+moneyPdf(inc.sales)+'</td></tr><tr><td>הכנסה כללית</td><td class="green-text">'+moneyPdf(inc.general)+'</td></tr><tr><th>סה״כ הכנסות</th><th class="green-text">'+moneyPdf(inc.total)+'</th></tr></tbody></table></div><div><h3>קיזוזים / הוצאות לפני מע״מ</h3><table><tbody><tr><td>ציוד שחור</td><td class="red-text">'+moneyPdf(ded.equipment)+'</td></tr><tr><td>קנסות</td><td class="red-text">'+moneyPdf(ded.fine)+'</td></tr>'+deductionRows+'<tr><th>סה״כ קיזוזים</th><th class="red-text">'+moneyPdf(ded.total)+'</th></tr></tbody></table></div></div>'+ 
      '<div class="wm-pdf-kpis wm-pdf-final-kpis">'+kpiV563('נטו לפני מע״מ',moneyPdf(netBeforeVat),netBeforeVat>=0?'green-text':'red-text')+kpiV563('מע״מ 18%',moneyPdf(vatAfter),'')+kpiV563('סה״כ כולל מע״מ',moneyPdf(grossAfter),grossAfter>=0?'green-text':'red-text')+kpiV563('מול סכום המערכת',diffTxt,diffCls)+'</div>'+(notes?'<div class="wm-pdf-note"><b>הערות:</b><br>'+safe(notes)+'</div>':'')+'</section></body></html>';
  }
  function cssV563(){
    return 'body{font-family:Arial,"Noto Sans Hebrew",sans-serif;margin:0;padding:24px;color:#0f172a;background:#f8fafc}.wm-pdf-cover,.wm-pdf-page,.wm-pdf-day{background:white;border:1px solid #e2e8f0;border-radius:20px;padding:24px;margin:0 0 18px;box-shadow:0 10px 26px rgba(15,23,42,.07)}.wm-pdf-cover{text-align:center;padding:38px 24px}.wm-pdf-logo{width:68px;height:68px;border-radius:24px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;display:grid;place-items:center;font-size:34px;font-weight:900;margin:0 auto 14px}h1{font-size:32px;margin:8px 0}h2{font-size:23px;margin:0 0 14px}h3{font-size:16px;margin:14px 0 8px}.muted-text{color:#64748b!important}.green-text{color:#16a34a!important}.red-text{color:#dc2626!important}.wm-pdf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.wm-pdf-kpi{border:1px solid #e2e8f0;border-radius:16px;padding:13px;background:#fff}.wm-pdf-kpi div{font-size:12px;color:#64748b;font-weight:900}.wm-pdf-kpi b{display:block;font-size:20px;margin-top:5px;word-break:break-word}.wm-pdf-mini-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px}.wm-pdf-mini-grid div{background:#f1f5f9;border-radius:12px;padding:10px}.wm-pdf-mini-grid span{display:block;font-size:12px;color:#64748b;font-weight:900}.wm-pdf-mini-grid b{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #e2e8f0;padding:9px;text-align:right;font-size:13px;vertical-align:top}th{background:#eff6ff;color:#1d4ed8}.vac-row td{background:#fffbeb}.wm-pdf-bar-row{display:grid;grid-template-columns:120px 1fr 90px;gap:10px;align-items:center;margin:9px 0}.wm-pdf-bar-label{font-weight:900;font-size:13px}.wm-pdf-bar-track{height:16px;background:#e2e8f0;border-radius:999px;overflow:hidden}.wm-pdf-bar-fill{height:100%;background:#2563eb;border-radius:999px}.wm-pdf-bar-fill.green{background:#16a34a}.wm-pdf-bar-fill.red{background:#dc2626}.wm-pdf-bar-value{font-weight:900;font-size:13px}.wm-pdf-split{display:grid;grid-template-columns:1fr 1fr;gap:18px}.wm-pdf-job{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin:9px 0;background:#fff;page-break-inside:avoid}.wm-pdf-job-red{border-color:#fecaca;background:#fff7f7}.wm-pdf-job-head{display:flex;justify-content:space-between;gap:10px;font-size:15px}.wm-pdf-job-head span{font-weight:900;color:#16a34a}.wm-pdf-job-red .wm-pdf-job-head span{color:#dc2626}.wm-pdf-job-meta{color:#64748b;font-size:12px;font-weight:800;margin-top:5px}.wm-pdf-job-details{font-size:13px;line-height:1.55;margin-top:8px}.wm-pdf-job-notes{background:#f8fafc;border-radius:10px;padding:8px;margin-top:8px;color:#334155}.wm-pdf-day-total{background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;border-radius:12px;padding:10px;font-weight:900;margin-bottom:10px}.wm-pdf-vacation-box{background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:16px;font-weight:900}.wm-pdf-note{background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px;margin-top:12px;line-height:1.55}.wm-pdf-pills{display:flex;gap:8px;flex-wrap:wrap}.wm-pdf-pill{border-radius:999px;background:#f1f5f9;padding:8px 11px;font-size:12px;font-weight:900}.wm-pdf-pill.red{background:#fee2e2;color:#991b1b}.wm-pdf-final-kpis{margin-top:18px}@media print{body{background:white;padding:0}.wm-pdf-cover,.wm-pdf-page,.wm-pdf-day{box-shadow:none;border-radius:0;border:0;margin:0;page-break-after:always}.wm-pdf-job{page-break-inside:avoid}.wm-pdf-kpis{grid-template-columns:repeat(4,1fr)}}@media(max-width:760px){.wm-pdf-kpis,.wm-pdf-mini-grid,.wm-pdf-split{grid-template-columns:1fr}.wm-pdf-bar-row{grid-template-columns:90px 1fr 80px}}';
  }
  function choosePdfMonthV563(){
    var def=currentReportMonthV563();
    return new Promise(function(resolve){
      try{
        var existing=document.getElementById('pdfMonthSelectorOverlayV561');
        if(existing) existing.remove();
        var overlay=document.createElement('div');
        overlay.id='pdfMonthSelectorOverlayV561';
        overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;';
        var box=document.createElement('div');
        box.style.cssText='width:min(440px,100%);background:#fff;border-radius:24px;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.28);border:1px solid #e2e8f0;font-family:Arial,"Noto Sans Hebrew",sans-serif;color:#0f172a;';
        var title=document.createElement('h2'); title.textContent='בחר חודש לדוח PDF'; title.style.cssText='margin:0 0 8px;font-size:22px;font-weight:900;';
        var sub=document.createElement('div'); sub.textContent='הדוח יטען עבודות, יעד, ימי חופש והתחשבנות לפי החודש שתבחר.'; sub.style.cssText='font-size:12px;color:#64748b;font-weight:800;line-height:1.45;margin-bottom:12px;';
        var sel=document.createElement('select'); sel.id='pdfMonthSelectorV561'; sel.style.cssText='width:100%;border:1px solid #cbd5e1;border-radius:16px;padding:13px 14px;font-size:16px;font-weight:900;background:#fff;margin:8px 0 14px;';
        var baseParts=String(def||'').split('-');
        var baseYear=Number(baseParts[0])||new Date().getFullYear();
        var baseMonth=(Number(baseParts[1])||new Date().getMonth()+1)-1;
        var heMonths=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
        for(var i=-12;i<=6;i++){
          var d=new Date(baseYear,baseMonth+i,1);
          var v=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
          var o=document.createElement('option'); o.value=v; o.textContent=heMonths[d.getMonth()]+' '+d.getFullYear()+' ('+v+')'; if(v===def) o.selected=true; sel.appendChild(o);
        }
        var actions=document.createElement('div'); actions.style.cssText='display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap;margin-top:4px;';
        var ok=document.createElement('button'); ok.type='button'; ok.textContent='הפק דוח מקצועי'; ok.style.cssText='border:0;border-radius:16px;padding:12px 16px;background:linear-gradient(135deg,#16a34a,#22c55e);color:white;font-weight:900;cursor:pointer;font-family:inherit;';
        var cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='ביטול'; cancel.style.cssText='border:1px solid #e2e8f0;border-radius:16px;padding:12px 16px;background:#f8fafc;color:#0f172a;font-weight:900;cursor:pointer;font-family:inherit;';
        actions.appendChild(ok); actions.appendChild(cancel); box.appendChild(title); box.appendChild(sub); box.appendChild(sel); box.appendChild(actions); overlay.appendChild(box); document.body.appendChild(overlay);
        function close(v){ try{overlay.remove();}catch(e){} resolve(v||null); }
        ok.onclick=function(){ close(sel.value); }; cancel.onclick=function(){ close(null); }; overlay.addEventListener('click',function(ev){ if(ev.target===overlay) close(null); }); setTimeout(function(){ try{sel.focus();}catch(e){} },50);
      }catch(e){ console.warn('month selector failed', e); resolve(def); }
    });
  }
  async function openPrintV563(html,month){
    var title='work_month_professional_report_'+String(month||'').replace(/[^0-9-]/g,'_');
    var win=window.open('','_blank');
    if(!win){
      var blob=new Blob([html],{type:'text/html;charset=utf-8'});
      var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download=title+'.html'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},1500);
      alert('הדפדפן חסם חלון חדש. ירד קובץ HTML — פתח אותו ובחר הדפסה / שמירה כ-PDF.'); return;
    }
    win.document.open(); win.document.write(html); win.document.close(); win.focus(); setTimeout(function(){ try{ win.print(); }catch(e){} },700);
  }
  window.exportMonthlyPdfReportV558 = async function(){
    if(!viewedWorker){ alert('לא זוהה עובד פעיל ליצירת הדוח.'); return; }
    var month=await choosePdfMonthV563(); if(!month) return;
    var btn=null; try{ btn=[].slice.call(document.querySelectorAll('button')).find(function(b){return String(b.textContent||'').indexOf('סיכום חודש PDF')!==-1;}); }catch(e){}
    if(btn) btn.disabled=true;
    try{
      var msg=q('workerToolsMsg')||q('settlementMsgV547'); if(msg) msg.innerHTML='<div class="notice">מכין דוח PDF מקצועי לחודש '+safe(month)+'...</div>';
      var allEntries=await allEntriesForMonthV563(month);
      var settlement=await readPdfSettlementDataV563(month);
      var vacationDays=await vacationDaysForMonthV563(month);
      var html=buildReportHtmlV563({month:month,allEntries:allEntries,settlement:settlement,vacationDays:vacationDays});
      await openPrintV563(html,month);
      if(msg) msg.innerHTML='<div class="notice">הדוח המקצועי לחודש '+safe(month)+' נפתח להדפסה ✅ בחר שמירה כ-PDF.</div>';
    }catch(e){ console.error('exportMonthlyPdfReportV563 failed',e); alert('שגיאה ביצירת דוח PDF: '+(e.message||e)); }
    finally{ if(btn) btn.disabled=false; }
  };
})();
;
/* ===== v4.34: Boot guard חזק יותר להתחברות שמורה =====
   הבעיה: בטעינה עם עובד שמור, fallback ישן היה יכול להציג לרגע את מסך הכניסה לפני שהעובד סיים להיטען.
   הפתרון: כל עוד קיימת התחברות שמורה שעדיין בבדיקה, showWorkerLogin לא מציג מסך כניסה אלא משאיר את מסך הטעינה.
   אין שינוי בלוגיקה של עובדים, אדמין, שמירה, עריכה, מחירון או נתונים.
*/
(function(){
  var savedSessionBootActiveV434 = false;

  function hasSavedWorkerSessionV434(){
    try{
      var raw = localStorage.getItem('workSession');
      if(!raw) return false;
      var s = JSON.parse(raw);
      return !!(s && s.role === 'worker' && s.workerId);
    }catch(e){ return false; }
  }

  function showOnlyStartupV434(textLine){
    try{ document.body.classList.add('app-booting-v434'); }catch(e){}
    try{
      ['workerLoginView','adminLoginView','registerView','expiredView','adminView','workerView'].forEach(function(id){
        var el=document.getElementById(id);
        if(el) el.classList.add('hidden');
      });
      var startup=document.getElementById('startupView');
      if(startup) startup.classList.remove('hidden');
      var sub=document.querySelector('#startupView .startup-sub');
      if(sub) sub.textContent = textLine || 'משחזר התחברות שמורה וטוען נתונים...';
      var title=document.querySelector('#startupView .big-title');
      if(title) title.textContent='טוען נתונים';
      if(typeof text === 'function') text('userLine','טוען נתונים');
    }catch(e){}
  }

  function releaseBootV434(){
    savedSessionBootActiveV434 = false;
    try{ document.body.classList.remove('app-booting-v434'); }catch(e){}
  }
  window.releaseBootV434 = releaseBootV434;

  // אם showWorkerLogin נקרא באמצע שחזור session שמור — לא מציגים כניסה לרגע.
  var oldShowWorkerLoginV434 = window.showWorkerLogin;
  if(typeof oldShowWorkerLoginV434 === 'function' && !oldShowWorkerLoginV434.__v434NoFlash){
    window.showWorkerLogin = function(){
      if(savedSessionBootActiveV434 && hasSavedWorkerSessionV434()){
        showOnlyStartupV434('משחזר התחברות שמורה וטוען נתונים...');
        return;
      }
      releaseBootV434();
      return oldShowWorkerLoginV434.apply(this, arguments);
    };
    window.showWorkerLogin.__v434NoFlash = true;
  }

  function wrapReleaseV434(fnName){
    var old = window[fnName];
    if(typeof old !== 'function' || old.__v434Release) return;
    var wrapped = function(){
      var res = old.apply(this, arguments);
      if(res && typeof res.then === 'function'){
        return res.finally(function(){ releaseBootV434(); });
      }
      releaseBootV434();
      return res;
    };
    wrapped.__v434Release = true;
    window[fnName]=wrapped;
  }
  ['showWorker','showAdmin','showExpiredView','showRegister'].forEach(wrapReleaseV434);

  // Boot אחרון ועדין: לא משכתב לוגיקה, רק מונע הופעת login בזמן שיש session שמור.
  var previousOnloadV434 = window.onload;
  window.onload = async function(){
    savedSessionBootActiveV434 = hasSavedWorkerSessionV434();
    if(savedSessionBootActiveV434) showOnlyStartupV434('משחזר התחברות שמורה וטוען נתונים...');
    try{
      if(typeof previousOnloadV434 === 'function'){
        var res = previousOnloadV434.apply(this, arguments);
        if(res && typeof res.then === 'function') await res;
      }
    }finally{
      // אם עדיין יש session שמור והעובד עוד לא נחשף, ממשיכים להחזיק loader עוד קצת; לא מציגים login באמצע.
      setTimeout(function(){
        var workerVisible = document.getElementById('workerView') && !document.getElementById('workerView').classList.contains('hidden');
        var adminVisible = document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden');
        var expiredVisible = document.getElementById('expiredView') && !document.getElementById('expiredView').classList.contains('hidden');
        if(workerVisible || adminVisible || expiredVisible || !hasSavedWorkerSessionV434()) releaseBootV434();
      }, 120);
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    if(hasSavedWorkerSessionV434()){
      savedSessionBootActiveV434 = true;
      showOnlyStartupV434('משחזר התחברות שמורה וטוען נתונים...');
    }
  });

  try{ if(typeof setAppVersionUI === 'function') setAppVersionUI(); }catch(e){}
})();
;
/*
===============================================================================
CHANGELOG 4.40 - דשבורד חכם: מגמת הכנסות לפי חודשים
-------------------------------------------------------------------------------
1. נוספה מתחת ל"מגמת הכנסות לפי ימים" מגמת הכנסות לפי חודשים לכל 12 חודשי השנה.
2. חודשים ללא עבודות שבוצעו מוצגים כ־₪0, כדי שהשנה תישאר מלאה וברורה גם בתחילת שימוש.
3. החישוב מתבסס רק על עבודות שבוצעו בפועל, ולא כולל עבודות מתוזמנות.
4. העיצוב משתמש באותם רכיבי smart-bars / progress bar קיימים, עם גלילה פנימית עדינה.
5. תיקון תוספתי בלבד: לא שונה לוגין, לא שונו שמירות, לא שונו ימי חופש, לא שונה אדמין.
===============================================================================
*/
(function(){
  if(window.__dashboardMonthlyTrendV440Applied) return;
  window.__dashboardMonthlyTrendV440Applied=true;

  try{ window.APP_VERSION = APP_VERSION; if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}

  var monthlyTrendRequestV440=0;
  var monthNamesV440=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  function esc440(s){try{return esc(s)}catch(e){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}}
  function money440(n){try{return money(n)}catch(e){return '₪'+Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0})}}
  function isPlanned440(e){try{return (typeof isPlannedV49==='function' && isPlannedV49(e)) || e.entryStatus==='planned'}catch(_e){return e&&e.entryStatus==='planned'}}
  function done440(arr){return (arr||[]).filter(function(e){return !isPlanned440(e)})}
  function currentYear440(){try{return (calendarDate instanceof Date?calendarDate:new Date()).getFullYear()}catch(e){return new Date().getFullYear()}}
  function currentWorkerId440(){try{return (viewedWorker&&viewedWorker.id)||''}catch(e){return ''}}

  function ensureMonthlyTrendShell440(){
    var box=document.getElementById('smartDashboard');
    if(!box) return null;
    var existing=document.getElementById('monthlyTrendSectionV440');
    if(existing) return existing;

    var html='<div id="monthlyTrendSectionV440" class="smart-section-v423 smart-monthly-section-v440">'+
      '<h3>📊 מגמת הכנסות לפי חודשים</h3>'+
      '<div id="monthlyTrendContentV440" class="smart-monthly-scroll-v440"><p class="muted">טוען נתוני שנה...</p></div>'+
      '<div class="smart-monthly-note-v440">מציג את כל 12 חודשי השנה לפי עבודות שבוצעו בפועל בלבד.</div>'+
      '</div>';

    var dailySection=null;
    Array.from(box.querySelectorAll('.smart-section-v423')).some(function(sec){
      var h=sec.querySelector('h3');
      if(h && (h.textContent||'').indexOf('מגמת הכנסות לפי ימים')!==-1){dailySection=sec;return true;}
      return false;
    });

    if(dailySection && dailySection.parentNode){
      // אם מגמת הימים נמצאת בתוך גריד דו־עמודתי, מכניסים את מגמת החודשים אחרי כל הבלוק כדי שלא תידחס ליד התובנות.
      var two=dailySection.closest('.smart-two-v423');
      if(two && two.parentNode){two.insertAdjacentHTML('afterend',html);}
      else{dailySection.insertAdjacentHTML('afterend',html);}
    }else{
      box.insertAdjacentHTML('beforeend',html);
    }
    return document.getElementById('monthlyTrendSectionV440');
  }

  function renderMonthlyBars440(values,year){
    var max=Math.max(1,...values.map(function(v){return Number(v||0)}));
    var rows=values.map(function(v,i){
      var width=v>0?Math.max(4,Math.round((Number(v||0)/max)*100)):0;
      var zeroClass=v>0?'':' zero-v440';
      return '<div class="smart-bar-row-v423">'+
        '<div>'+esc440(monthNamesV440[i])+'</div>'+
        '<div class="smart-bar-track-v423"><div class="smart-bar-fill-v423'+zeroClass+'" style="width:'+width+'%"></div></div>'+
        '<div>'+money440(v)+'</div>'+
      '</div>';
    }).join('');
    return '<div class="smart-bars-v423" aria-label="מגמת הכנסות חודשית '+year+'">'+rows+'</div>';
  }

  async function loadMonthlyTrend440(){
    var section=ensureMonthlyTrendShell440();
    if(!section) return;
    var content=document.getElementById('monthlyTrendContentV440');
    if(!content) return;
    var workerId=currentWorkerId440();
    var year=currentYear440();
    var req=++monthlyTrendRequestV440;

    if(!workerId){
      content.innerHTML='<p class="muted">אין עובד פעיל להצגת מגמת חודשים.</p>';
      return;
    }

    try{
      content.innerHTML='<p class="muted">טוען מגמת חודשים...</p>';
      var start=year+'-01-01';
      var end=year+'-12-31';
      var snap=await db.collection('workEntries').where('workerId','==',workerId).get();
      if(req!==monthlyTrendRequestV440) return;
      var values=new Array(12).fill(0);
      snap.docs.map(function(d){return {id:d.id,...(d.data()||{})};})
        .filter(function(e){return e.date>=start && e.date<=end;})
        .filter(function(e){return !isPlanned440(e);})
        .forEach(function(e){
          var m=Number(String(e.date||'').slice(5,7));
          if(m>=1 && m<=12) values[m-1]+=Number(e.amount||0);
        });
      content.innerHTML=renderMonthlyBars440(values,year);
    }catch(e){
      // במקרה של הרשאות/רשת, מציגים לפחות את החודש הנוכחי מתוך monthEntries כדי לא לשבור את הדשבורד.
      var values=new Array(12).fill(0);
      try{
        done440(Array.isArray(monthEntries)?monthEntries:[]).forEach(function(e){
          if(String(e.date||'').startsWith(String(year)+'-')){
            var m=Number(String(e.date||'').slice(5,7));
            if(m>=1 && m<=12) values[m-1]+=Number(e.amount||0);
          }
        });
        content.innerHTML=renderMonthlyBars440(values,year)+'<p class="smart-monthly-note-v440">הוצג לפי הנתונים שכבר נטענו למסך. קריאת כל השנה נחסמה או נכשלה: '+esc440(e.code||e.message||e)+'</p>';
      }catch(_e){
        content.innerHTML='<p class="danger">שגיאה בטעינת מגמת חודשים: '+esc440(e.code||e.message||e)+'</p>';
      }
    }
  }

  var prevRenderSmart440=window.renderSmartDashboard;
  if(typeof prevRenderSmart440==='function'){
    window.renderSmartDashboard=function(){
      var res=prevRenderSmart440.apply(this,arguments);
      try{ensureMonthlyTrendShell440();}catch(e){}
      setTimeout(function(){loadMonthlyTrend440();},40);
      return res;
    };
  }

  var prevLoadMonth440=window.loadMonth;
  if(typeof prevLoadMonth440==='function'){
    window.loadMonth=async function(){
      var res=await prevLoadMonth440.apply(this,arguments);
      try{loadMonthlyTrend440();}catch(e){}
      return res;
    };
  }

  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){try{loadMonthlyTrend440();}catch(e){}},600);});
  window.addEventListener('load',function(){setTimeout(function(){try{loadMonthlyTrend440();}catch(e){}},950);});
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{document.title = "מעקב עבודה - גרסה " + APP_VERSION;}catch(e){}
  function setVersion426(){
    try{document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){el.textContent = APP_VERSION;});}catch(e){}
  }
  function fullMoney426(text){
    var raw=String(text||'').replace(/[₪,\s]/g,'').replace(/K$/i,'000');
    var n=Number(raw);
    if(!isFinite(n)) return text;
    return '₪'+Math.round(n).toLocaleString('he-IL',{maximumFractionDigits:0});
  }
  function restoreExactAmounts426(){
    var cal=document.getElementById('calendar');
    if(!cal)return;
    cal.querySelectorAll('.weekday').forEach(function(h){ if((h.textContent||'').trim()==='ש') h.textContent='שבת'; });
    cal.querySelectorAll('.day-total,.day-planned-v49').forEach(function(el){
      var original=el.dataset.fullMoney425 || el.dataset.fullMoney426 || el.textContent || '';
      // עבור planned יש לפעמים טקסט עם אייקון ושורה. מתקנים רק סכום שיש בתוכו.
      if((el.className||'').indexOf('day-planned-v49')>=0){
        el.innerHTML=String(el.innerHTML||'').replace(/₪\s*[0-9.,]+\s*K?/gi,function(m){return fullMoney426(m)});
      }else{
        el.dataset.fullMoney426=original;
        el.textContent=fullMoney426(original);
      }
    });
  }
  function fixCalendarScroll426(){
    var cal=document.getElementById('calendar');
    if(!cal)return;
    restoreExactAmounts426();
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
    var parent=cal.parentElement;
    if(parent){
      parent.style.overflowX='auto';
      parent.style.overflowY='visible';
      parent.style.webkitOverflowScrolling='touch';
      parent.style.maxWidth='100%';
    }
  }
  var oldRenderCalendar=window.renderCalendar;
  if(typeof oldRenderCalendar==='function' && !oldRenderCalendar.__v426){
    window.renderCalendar=function(){
      var res=oldRenderCalendar.apply(this,arguments);
      setTimeout(fixCalendarScroll426,0);
      return res;
    };
    window.renderCalendar.__v426=true;
  }
  var oldSelectDay=window.selectDay;
  if(typeof oldSelectDay==='function' && !oldSelectDay.__v426){
    window.selectDay=function(ds){
      var res=oldSelectDay.apply(this,arguments);
      setTimeout(fixCalendarScroll426,40);
      return res;
    };
    window.selectDay.__v426=true;
  }
  document.addEventListener('DOMContentLoaded',function(){setVersion426();setTimeout(fixCalendarScroll426,180);});
  window.addEventListener('load',function(){setTimeout(function(){setVersion426();fixCalendarScroll426();},300);});
  document.addEventListener('click',function(){setTimeout(fixCalendarScroll426,90);});
})();
;
(function(){
  window.APP_VERSION = APP_VERSION;
  try{ document.title = "מעקב עבודה - גרסה " + APP_VERSION; }catch(e){}
  function setVersion427(){
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent = APP_VERSION; }); }catch(e){}
  }

  function ensureWorkerLoadingOverlay427(){
    var view=document.getElementById('workerView');
    if(!view) return null;
    var overlay=document.getElementById('workerLoadingOverlayV427');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='workerLoadingOverlayV427';
      overlay.className='worker-loading-overlay-v427';
      overlay.innerHTML='<div class="worker-loading-card-v427"><div class="worker-loading-logo-v427">₪</div><div class="worker-loading-title-v427">טוען נתונים</div><p class="worker-loading-sub-v427">מחשב סיכומים, עבודות ומתוזמנות...</p><div class="worker-loading-bar-v427"><div></div></div></div>';
      document.body.appendChild(overlay);
    }
    return overlay;
  }
  function showWorkerLoading427(){
    ensureWorkerLoadingOverlay427();
    document.body.classList.add('worker-loading-active-v427');
  }
  function hideWorkerLoading427(){
    document.body.classList.remove('worker-loading-active-v427');
  }

  function safeArr427(a){ return Array.isArray(a) ? a : []; }
  function isPlanned427(e){
    try{ if(typeof window.isPlannedV49 === 'function') return !!window.isPlannedV49(e); }catch(_e){}
    return e && (e.entryStatus === 'planned' || e.status === 'planned' || e.planned === true);
  }
  function counts427(list){
    list=safeArr427(list);
    return {
      total:list.length,
      installs:list.filter(function(e){return e.workType==='install';}).length,
      services:list.filter(function(e){return e.workType==='service';}).length
    };
  }
  function countsHtml427(c){
    return '<span class="day-count-total-v427">סה״כ: '+c.total+'</span><span class="day-count-split-v427">התקנות: '+c.installs+' · קריאות שירות: '+c.services+'</span>';
  }
  window.countsTextV419=function(c){ return countsHtml427(c); };

  // תיקון הכרטיסים של עבודות היום: הסיכום נהיה שתי שורות במקום שורה אחת גולשת.
  var oldRenderDay427=window.renderDay;
  if(typeof oldRenderDay427==='function' && !oldRenderDay427.__v427){
    window.renderDay=function(){
      var res=oldRenderDay427.apply(this,arguments);
      try{
        var entries=safeArr427(window.monthEntries || monthEntries).filter(function(e){return e.date===selectedDate;});
        var done=entries.filter(function(e){return !isPlanned427(e);});
        var planned=entries.filter(function(e){return isPlanned427(e);});
        var pills=document.querySelectorAll('.day-count-pill-v419');
        if(pills[0]) pills[0].innerHTML=countsHtml427(counts427(done));
        if(pills[1]) pills[1].innerHTML=countsHtml427(counts427(planned));
      }catch(e){ console.warn('v4.28 day count fix',e); }
      return res;
    };
    window.renderDay.__v427=true;
  }

  // טעינת חודש בלי להציג אפסים זמניים: המסך נשאר על טעינה עד שהשאילתה והחישובים נגמרים.
  window.loadMonth = async function(){
    showWorkerLoading427();
    try{
      await loadPriceList();
      await loadTemplates();
      // v5.54 FIX: ימי חופש חייבים להיטען לפי החודש שמוצג כרגע לפני רינדור הלוח והדשבורד.
      // אחרת מעבר לחודש קודם מציג מערך חופש ישן מהחודש הקודם/הנוכחי עד שמסמנים שוב יום חופש.
      try{
        if(typeof window.loadVacationDaysV437 === 'function') await window.loadVacationDaysV437();
        else if(typeof window.loadVacationDaysV489 === 'function') await window.loadVacationDaysV489();
        else if(typeof loadVacationDaysV487 === 'function') await loadVacationDaysV487();
      }catch(vacErr){ console.warn('v5.54 loadMonth vacation days load failed', vacErr && (vacErr.code||vacErr.message) ? (vacErr.code||vacErr.message) : vacErr); }
      var y=calendarDate.getFullYear(), m=calendarDate.getMonth();
      var last=new Date(y,m+1,0).getDate();
      var start=y+'-'+pad(m+1)+'-01';
      var end=y+'-'+pad(m+1)+'-'+pad(last);
      text('calTitle', months[m]+' '+y);
      text('monthSub', 'חודש בתצוגה: '+months[m]+' '+y);
      var snap=await db.collection('workEntries').where('workerId','==',viewedWorker.id).get();
      // v5.11: שומרים את כל עבודות העובד בזיכרון כדי שמגמת 30 ימים תוכל למשוך גם מהחודש הקודם.
      // monthEntries נשאר רק החודש הנבחר כדי לא לפגוע בכל הסיכומים והמסכים הקיימים.
      window.workerAllEntriesV511=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
      monthEntries=window.workerAllEntriesV511.filter(function(e){return e.date>=start && e.date<=end;});
      renderCalendar();
      renderDay();
      renderStats();
      if(typeof renderSmartDashboard==='function') renderSmartDashboard();
      if($('searchPanel') && !$('searchPanel').classList.contains('hidden') && typeof renderFullSummary==='function') renderFullSummary();
      if(typeof cleanVisibleSlashN==='function') cleanVisibleSlashN();
      setVersion427();
    }catch(e){
      console.error('loadMonth v4.28 failed',e);
      try{ alert('שגיאה בטעינת נתוני החודש: '+(e.message||e)); }catch(_e){}
    }finally{
      setTimeout(hideWorkerLoading427,120);
    }
  };

  document.addEventListener('DOMContentLoaded',function(){ setVersion427(); ensureWorkerLoadingOverlay427(); });
  window.addEventListener('load',function(){ setTimeout(setVersion427,250); setTimeout(setVersion427,700); setTimeout(setVersion427,1400); });
})();
;
/*
===============================================================================
CHANGELOG 4.31 - תיקון אמיתי לכפתור חזרה לאדמין
-------------------------------------------------------------------------------
1. תוקן זיהוי מנהל: לא משתמשים יותר ב-window.session כי session הוגדר עם let.
2. הכפתור "חזרה לאדמין" מופיע רק כשהמנהל פתח עובד דרך "פתח מעקב".
3. עובד רגיל שנכנס למערכת לא רואה את הכפתור בכלל.
4. הזרקת הכפתור מתבצעת אחרי showWorkerById, אחרי showWorker, ואחרי loadMonth כדי למנוע מצב שרינדור מאוחר מוחק אותו.
5. תיקון נקודתי בלבד; אין שינוי בנתוני עובדים, מחירון, גיבויים, לוגין או טעינת חודש.
===============================================================================
*/
(function(){
  const PATCH_ID = "v4.31-admin-back-button-hard-fix";

  function getSessionRoleV431(){
    try{
      if(typeof session !== "undefined" && session && session.role) return session.role;
    }catch(e){}
    try{
      const saved = localStorage.getItem("workSession");
      if(saved){
        const parsed = JSON.parse(saved);
        if(parsed && parsed.role) return parsed.role;
      }
    }catch(e){}
    return "";
  }

  function isAdminSessionV431(){
    return getSessionRoleV431() === "admin";
  }

  function markAdminWorkerOpenV431(on){
    try{ window.__adminOpenedWorkerFromPanelV431 = !!on; }catch(e){}
    try{ window.__adminOpenedWorkerFromPanelV430 = !!on; }catch(e){}
  }

  function shouldShowAdminBackV431(){
    try{ return isAdminSessionV431() && window.__adminOpenedWorkerFromPanelV431 === true; }catch(e){ return false; }
  }

  function removeAdminBackButtonV431(){
    try{ document.querySelectorAll("#adminBackToPanelV431,#adminBackToPanelV430").forEach(function(el){ el.remove(); }); }catch(e){}
  }

  function ensureAdminBackButtonV431(){
    try{
      const workerView = document.getElementById("workerView");
      if(!workerView) return;

      if(!shouldShowAdminBackV431()){
        removeAdminBackButtonV431();
        return;
      }

      let bar = document.getElementById("adminBackToPanelV431");
      if(!bar){
        removeAdminBackButtonV431();
        bar = document.createElement("div");
        bar.id = "adminBackToPanelV431";
        bar.className = "admin-back-to-panel-v431";
        bar.innerHTML = '<div><div class="admin-back-title-v431">מצב צפייה כמנהל</div><div class="admin-back-sub-v431">פתחת מעקב של עובד מתוך האדמין</div></div><button type="button" class="btn-light" onclick="returnToAdminPanelV431(event)">↩ חזרה לאדמין</button>';
        workerView.insertBefore(bar, workerView.firstChild);
      }
    }catch(e){
      console.warn(PATCH_ID + " ensure failed", e);
    }
  }

  window.returnToAdminPanelV431 = async function(ev){
    try{ if(ev && ev.preventDefault) ev.preventDefault(); }catch(e){}
    markAdminWorkerOpenV431(false);
    removeAdminBackButtonV431();
    try{
      if(typeof showAdmin === "function") await showAdmin();
    }catch(e){
      alert("שגיאה בחזרה לאדמין: " + (e.message || String(e)));
    }
    return false;
  };

  // תאימות לכפתור הישן אם הדפדפן מחזיק קאש/HTML ישן חלקית.
  window.returnToAdminPanelV430 = window.returnToAdminPanelV431;

  const oldShowWorkerByIdV431 = window.showWorkerById;
  if(typeof oldShowWorkerByIdV431 === "function" && !oldShowWorkerByIdV431.__v431HardFix){
    window.showWorkerById = async function(id){
      const openedFromAdmin = isAdminSessionV431();
      markAdminWorkerOpenV431(openedFromAdmin);
      const result = await oldShowWorkerByIdV431.apply(this, arguments);
      setTimeout(ensureAdminBackButtonV431, 0);
      setTimeout(ensureAdminBackButtonV431, 150);
      setTimeout(ensureAdminBackButtonV431, 600);
      return result;
    };
    window.showWorkerById.__v431HardFix = true;
  }

  const oldShowWorkerV431 = window.showWorker;
  if(typeof oldShowWorkerV431 === "function" && !oldShowWorkerV431.__v431HardFix){
    window.showWorker = async function(worker){
      const result = await oldShowWorkerV431.apply(this, arguments);
      setTimeout(ensureAdminBackButtonV431, 0);
      setTimeout(ensureAdminBackButtonV431, 150);
      return result;
    };
    window.showWorker.__v431HardFix = true;
  }

  const oldLoadMonthV431 = window.loadMonth;
  if(typeof oldLoadMonthV431 === "function" && !oldLoadMonthV431.__v431HardFix){
    window.loadMonth = async function(){
      const result = await oldLoadMonthV431.apply(this, arguments);
      setTimeout(ensureAdminBackButtonV431, 0);
      setTimeout(ensureAdminBackButtonV431, 180);
      return result;
    };
    window.loadMonth.__v431HardFix = true;
  }

  const oldShowAdminV431 = window.showAdmin;
  if(typeof oldShowAdminV431 === "function" && !oldShowAdminV431.__v431HardFix){
    window.showAdmin = async function(){
      markAdminWorkerOpenV431(false);
      removeAdminBackButtonV431();
      return oldShowAdminV431.apply(this, arguments);
    };
    window.showAdmin.__v431HardFix = true;
  }

  const oldShowWorkerLoginV431 = window.showWorkerLogin;
  if(typeof oldShowWorkerLoginV431 === "function" && !oldShowWorkerLoginV431.__v431HardFix){
    window.showWorkerLogin = function(){
      markAdminWorkerOpenV431(false);
      removeAdminBackButtonV431();
      return oldShowWorkerLoginV431.apply(this, arguments);
    };
    window.showWorkerLogin.__v431HardFix = true;
  }

  const oldLogoutV431 = window.logout;
  if(typeof oldLogoutV431 === "function" && !oldLogoutV431.__v431HardFix){
    window.logout = async function(){
      markAdminWorkerOpenV431(false);
      removeAdminBackButtonV431();
      return oldLogoutV431.apply(this, arguments);
    };
    window.logout.__v431HardFix = true;
  }

  document.addEventListener("DOMContentLoaded", function(){
    if(!shouldShowAdminBackV431()) removeAdminBackButtonV431();
    try{ if(typeof enforceAppVersionUI === "function") enforceAppVersionUI(); }catch(e){}
  });
  window.addEventListener("load", function(){
    setTimeout(function(){ if(shouldShowAdminBackV431()) ensureAdminBackButtonV431(); }, 400);
  });
})();
;
/* ===== v4.30: אכיפת גרסה מקונסט יחיד בלבד ===== */
(function(){
  function runVersionEnforcerV429(){
    try{ if(typeof enforceAppVersionUI === "function") enforceAppVersionUI(); }catch(e){}
  }
  runVersionEnforcerV429();
  document.addEventListener("DOMContentLoaded", runVersionEnforcerV429);
  window.addEventListener("load", runVersionEnforcerV429);
  document.addEventListener("click", function(){ setTimeout(runVersionEnforcerV429, 80); });
  setInterval(runVersionEnforcerV429, 900);
})();
;
/*
===============================================================================
CHANGELOG 4.35 - תיקון תקיעה במסך "מכין את סביבת העבודה שלך"
-------------------------------------------------------------------------------
1. תיקון נקודתי על v4.34: אם שחזור התחברות שמורה לא מגיע למסך עובד/אדמין/מנוי,
   האפליקציה לא נשארת תקועה על מסך הטעינה.
2. נוסף rescue שמנסה לפתוח ישירות את העובד לפי ה-session השמור.
3. אם ה-session השמור לא תקין או שהעובד לא קיים, מנקים אותו ומציגים מסך כניסה רגיל.
4. עובד רגיל עדיין לא רואה כפתור חזרה לאדמין; כפתור חזרה לאדמין נשאר רק בפתיחה מתוך אדמין.
5. לא שונה כלום בשמירת עבודות, עריכת התקנות, מחירון, גיבוי, אדמין או נתוני Firestore.
===============================================================================
*/
(function(){
  var PATCH_ID = 'v4.35-saved-login-boot-rescue';
  var rescueStarted = false;

  function byId(id){ return document.getElementById(id); }
  function isVisible(id){ var el=byId(id); return !!(el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'); }
  function anyMainVisible(){ return isVisible('workerView') || isVisible('adminView') || isVisible('expiredView') || isVisible('workerLoginView') || isVisible('adminLoginView') || isVisible('registerView'); }
  function startupVisible(){ return isVisible('startupView') || (byId('startupView') && !byId('startupView').classList.contains('hidden')); }

  function getSavedSession(){
    try{
      var raw = localStorage.getItem('workSession');
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  function releaseAllBootLocks(){
    try{ document.body.classList.remove('app-booting-v433','app-booting-v434'); }catch(e){}
    try{ if(typeof window.releaseBootGuardV433 === 'function') window.releaseBootGuardV433(); }catch(e){}
    try{ if(typeof window.releaseBootV434 === 'function') window.releaseBootV434(); }catch(e){}
  }

  function forceWorkerLogin(){
    releaseAllBootLocks();
    try{ localStorage.removeItem('workSession'); }catch(e){}
    try{
      if(typeof session !== 'undefined') session = null;
      if(typeof viewedWorker !== 'undefined') viewedWorker = null;
    }catch(e){}
    try{
      ['startupView','registerView','expiredView','adminLoginView','adminView','workerView'].forEach(function(id){ var el=byId(id); if(el) el.classList.add('hidden'); });
      var login=byId('workerLoginView'); if(login) login.classList.remove('hidden');
      var logout=byId('logoutBtn'); if(logout) logout.classList.add('hidden');
      if(typeof text === 'function') text('userLine','לא מחובר');
    }catch(e){
      try{ if(typeof showWorkerLogin === 'function') showWorkerLogin(); }catch(_e){}
    }
  }

  async function rescueSavedWorkerSession(){
    if(rescueStarted) return;
    rescueStarted = true;

    var saved = getSavedSession();
    if(!saved || saved.role !== 'worker' || !saved.workerId){
      releaseAllBootLocks();
      return;
    }

    // אם בזמן ההמתנה המסך כבר התקדם - רק משחררים נעילות ולא נוגעים בכלום.
    if(isVisible('workerView') || isVisible('adminView') || isVisible('expiredView')){
      releaseAllBootLocks();
      return;
    }

    try{
      releaseAllBootLocks();
      if(typeof session !== 'undefined') session = saved;
      if(typeof showWorkerById === 'function'){
        await showWorkerById(saved.workerId);
        setTimeout(releaseAllBootLocks, 50);
        return;
      }
      forceWorkerLogin();
    }catch(e){
      console.warn(PATCH_ID + ' failed, clearing bad saved session', e);
      forceWorkerLogin();
    }
  }

  function scheduleRescue(){
    // נותנים ל-boot הרגיל לעבוד קודם. אם הוא הצליח, לא נוגעים בכלום.
    setTimeout(function(){
      if(isVisible('workerView') || isVisible('adminView') || isVisible('expiredView')){ releaseAllBootLocks(); return; }
      var saved = getSavedSession();
      if(saved && saved.role === 'worker' && saved.workerId && startupVisible()){
        rescueSavedWorkerSession();
      }else{
        releaseAllBootLocks();
      }
    }, 4500);

    // רשת ביטחון אחרונה: לעולם לא נשארים תקועים על טוען נתונים.
    setTimeout(function(){
      if(isVisible('workerView') || isVisible('adminView') || isVisible('expiredView') || isVisible('workerLoginView')){ releaseAllBootLocks(); return; }
      var saved = getSavedSession();
      if(saved && saved.role === 'worker' && saved.workerId){
        rescueSavedWorkerSession();
      }else{
        forceWorkerLogin();
      }
    }, 9000);
  }

  document.addEventListener('DOMContentLoaded', scheduleRescue);
  window.addEventListener('load', scheduleRescue);
  setTimeout(scheduleRescue, 1000);

  try{ if(typeof setAppVersionUI === 'function') setAppVersionUI(); }catch(e){}
})();
;
/*
===============================================================================
CHANGELOG 4.94 - מנגנון Changelog יחיד ונקי
-------------------------------------------------------------------------------
1. הסקריפט הזה מחליף את כל מנגנוני הצ׳יינג׳לוג הישנים שהיו בקובץ.
2. Firestore collection appChangelog הוא מקור האמת: קיימות רשומות? מציגים אותן.
3. אם חסרות גרסאות ברירת מחדל חדשות, האדמין מוסיף אותן ל-Firebase בלי לדרוס רשומות קיימות.
4. אם כתיבה ל-Firebase נכשלת אצל עובד ללא הרשאת כתיבה, התצוגה עדיין לא נשברת ומציגה fallback זמני בלבד.
5. כל השינויים מרוכזים כאן כדי למנוע פאץ׳ על פאץ׳ בהמשך.
===============================================================================
*/
(function(){
  var COLLECTION = 'appChangelog';
  try{ window.APP_VERSION = APP_VERSION; if(typeof setAppVersionUI==='function') setAppVersionUI(); if(typeof enforceAppVersionUI==='function') enforceAppVersionUI(); }catch(e){}
  function q(id){ return document.getElementById(id); }
  function esc(s){
    try{ if(typeof window.esc==='function') return window.esc(s); }catch(e){}
    return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
  function clean(s){ return String(s||'').trim(); }
  function todayHe(){ var d=new Date(); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); }
  function splitItems(text){
    if(Array.isArray(text)) return text.map(clean).filter(Boolean);
    return String(text||'').split(/\n+/).map(function(x){return clean(x).replace(/^[-•*]\s*/,'');}).filter(Boolean);
  }
  function docId(version){
    var v=clean(version||'').replace(/^v/i,'');
    return 'v_' + v.replace(/[^0-9A-Za-z_\-\.]/g,'_').replaceAll('.','_');
  }
  function row(id,data,source,i){
    data=data||{};
    var version=clean(data.version||'').replace(/^v/i,'');
    return {
      id:id||data.id||docId(version),
      version:version,
      title:clean(data.title||''),
      date:clean(data.date||''),
      items:Array.isArray(data.items)?data.items:splitItems(data.itemsText||data.text||''),
      active:data.active!==false,
      order:Number(data.order||((Number(i||0)+1)*10)),
      source:source||data.source||'',
      createdAt:data.createdAt||null,
      updatedAt:data.updatedAt||null
    };
  }
  function versionScore(v){ return String(v||'').replace(/^v/i,'').split('.').map(function(p){return parseInt(p,10)||0;}); }
  function sortRows(rows){
    return (rows||[]).slice().sort(function(a,b){
      var av=versionScore(a.version), bv=versionScore(b.version), len=Math.max(av.length,bv.length,4);
      for(var i=0;i<len;i++){ var x=av[i]||0, y=bv[i]||0; if(x!==y) return y-x; }
      return Number(a.order||0)-Number(b.order||0);
    });
  }
  function requiredChangelogRows(){
    var d=todayHe();
    return [
      {version:"6.07-beta", title:"תיקון הצגת ימי חופש במעבר בין חודשים בבטא", items:["תוקן מצב שבו מעבר לחודש קודם או הבא מתוך מטמון השנתיים לא טען את ימי החופש של החודש הנבחר.","לאחר כל מעבר חודש נטענים מ-workerDaysOff גם ימי החופש וגם נעילות הימים של חודש היעד לפני ציור הלוח והדשבורד.","עבודות החודש ממשיכות להגיע מהזיכרון בלבד ואינן נטענות מחדש מ-Firestore.","חישובי ימי החופש, ימי העבודה שנותרו והיעד היומי מתעדכנים לפי החודש שמוצג."], date:d},
      {version:"6.06-beta", title:"תיקון הצגת ימים נעולים במעבר בין חודשים בבטא", items:["תוקן מצב שבו מעבר לחודש אחר מתוך מטמון השנתיים הציג ימים שנשמרו כנעולים כאילו הם פתוחים.","לאחר מעבר חודש נטענות נעילות החודש הנבחר ולוח השנה והיום הנבחר מצוירים מחדש.","עבודות החודש ממשיכות להיטען מהזיכרון בלבד.","לא שונו שמירת נעילה, החיפוש או השלמת הכתובת."], date:d},
      {version:"6.05-beta", title:"בטא: השלמת כתובת רק מזיכרון השנתיים", items:["בעת הקלדת מספר לקוח, בדיקת הלקוח והשלמת הכתובת משתמשות רק במערך 730 הימים שכבר נטען לזיכרון.","הקלדת מספר לקוח אינה שולחת עוד שאילתת Firestore נפרדת ואינה מחפשת מעבר לשנתיים.","לקוחות ישנים יותר ממשיכים להופיע רק במסך החיפוש המלא, שממשיך לחפש בכל ההיסטוריה.","נשמרו התראות 30 הימים, פק״עות מתוזמנות ופק״עות שלא בוצעו על בסיס הנתונים הקיימים בזיכרון."], date:d},
      {version:"6.04-beta", title:"בטא: טעינה אחת של שנתיים ועבודה מהזיכרון", items:["בכניסה לעובד נטענות מ-Firestore רק העבודות מ-730 הימים האחרונים ונשמרות במערך זיכרון מרכזי.","מעבר בין חודשים וימים, רינדור לוח השנה, דשבורד וסטטיסטיקות עובדים מהזיכרון ללא טעינה מלאה חוזרת.","מאזין ממוקד מעדכן את הזיכרון לאחר שמירה, עריכה או מחיקה ומחזיר למסכים את הנתונים המעודכנים.","שדה החיפוש ממשיך לחפש בכל היסטוריית העובד, גם מעבר לשנתיים.","לחיצה על תוצאת חיפוש ישנה טוענת לפי דרישה רק את חודש היעד כדי לפתוח את הפק״ע המדויקת.","נוסף Debug אופציונלי באמצעות הפרמטר cacheDebug=1 לבדיקת טעינות, עדכוני זיכרון וחודשים היסטוריים."], date:d},
      {version:"6.03", title:"בחירת יום אופציונלית בקפיצה ללוח השנה", items:["נוסף שדה יום אופציונלי באותו חלון של בחירת חודש ושנה.","רשימת הימים מתעדכנת לפי החודש והשנה ומציגה רק ימים שקיימים בפועל.","ללא בחירת יום המערכת עוברת לחודש בלבד; עם בחירת יום היא פותחת את היום המדויק.","בבחירת שבת מופעלת לוגיקת המעבר ליום ראשון הקרוב."], date:d},
      {version:"6.02", title:"קפיצה ישירה לחודש ושנה בלוח השנה", items:["נוסף אייקון לוח שנה קטן ליד כותרת החודש והשנה.","נוסף חלון לבחירת חודש ושנה וכפתור היום לחזרה לתאריך הנוכחי.","חיצי החודשים הקיימים נשארו ללא שינוי."], date:d},
      {version:"6.01", title:"פיצול functions.js לשני קבצים", items:["קובץ JavaScript הגדול פוצל ל-functions1.js ול-functions2.js לפי גבול קוד תקין.","index.html טוען את functions1.js לפני functions2.js.","APP_VERSION נשאר מקור גרסה יחיד ב-functions1.js וכל פיתוח חדש מרוכז ב-functions2.js."], date:d},
      {version:"6.00", title:"גלילה חכמה בין רשימת העבודות לעמוד", items:["כאשר רשימת העבודות מגיעה לקצה העליון או התחתון, המשך הגלילה עובר באופן טבעי לעמוד.","באמצע הרשימה הגלילה נשארת בתוך אזור העבודות.","נשמרה הגלילה המדויקת לפק״ע בעת ניווט."], date:d},
      {version:"5.99", title:"מרכוז מדויק של פק״ע בניווט", items:["הניווט גולל תחילה את העמוד לאזור עבודות היום.","לאחר מכן מתבצעת גלילה פנימית לכרטיס המדויק ומרכוזו במסך.","הפק״ע מודגשת זמנית לאחר ההגעה."], date:d},
      {version:"5.98", title:"רשימת עבודות נגללת וניווט אחיד", items:["אזור עבודות היום הפך לרשימה פנימית גדולה ונגללת.","חיפוש, דשבורד ורשימות מתוזמנות משתמשים במנגנון ניווט אחיד לחודש, ליום ולפק״ע.","נשמרה הדגשה זמנית של הרשומה שנפתחה."], date:d},
      {version:"5.97", title:"חיפוש כתובת חכם עם תוצאות קרובות", items:["התוצאות המדויקות נשארות בראש החיפוש ללא שינוי.","מתחתיהן מוצגות תוצאות קרובות בחלונות גלילה נפרדים לפי שם הרחוב ולפי שם העיר.","מספר הבית מוסר רק לצורך החיפוש הקרוב, והכותרת מציגה את הביטוי שנמצא ואת מספר התוצאות.","אין כפילויות בין התוצאות המדויקות, קבוצת הרחוב וקבוצת העיר.","כל תוצאה קרובה ניתנת ללחיצה ומנווטת לחודש, ליום ולפק״ע המדויקת.","החיפוש משתמש בנתונים שכבר נטענו ואינו מוסיף שאילתות Firebase נוספות."], date:d},
      {version:"5.96", title:"תיקון פתיחת פק״ע מתוצאת חיפוש בחודש אחר", items:["לחיצה על תוצאת חיפוש מחודש אחר מעבירה תחילה את לוח השנה לחודש המתאים.","המערכת ממתינה לטעינת נתוני החודש מ-Firestore ורק לאחר מכן פותחת את היום.","הפק״ע המדויקת מוצגת, נגללת למרכז המסך ומודגשת זמנית.","תוקן מצב שבו הכותרת הציגה את התאריך הנכון אך היום נראה ריק בגלל שנתוני החודש הקודם נשארו בזיכרון."], date:d},
      {version:"5.95", title:"ניווט מפירוט תוצאות החיפוש לפק״ע המדויקת", items:["כל כרטיס בחלק פירוט תוצאות של החיפוש ניתן ללחיצה.","לחיצה עוברת ליום של הרשומה, פותחת את פאנל היום, גוללת לפק״ע לפי ה-ID ומדגישה אותה זמנית.","הכרטיסים נגישים גם באמצעות Enter או רווח.","השינוי משתמש במנגנון הניווט הקיים ואינו משנה את החיפוש או שמירת הנתונים."], date:d},
      {version:"5.94", title:"שבת לא לחיצה ופתיחה אוטומטית על יום ראשון", items:["תאי שבת בלוח השנה אינם לחיצים ואינם ניתנים לבחירה.","כאשר האפליקציה נפתחת בשבת, היא עוברת אוטומטית ליום ראשון הקרוב.","נוספה חסימת הגנה פנימית שמונעת פתיחת טפסים או שמירת עבודה בשבת דרך מסלול עקיף.","לא שונתה לוגיקת נעילת היום, הדוחות או הגיבוי."], date:d},
      {version:"5.93", title:"השלמת מה חדש עד גרסה 5.93", items:["הושלמו כל הרשומות החסרות מגרסה 5.85 ועד 5.93 במקור הקבוע שמזין את Firestore.","המנגנון מוסיף רק גרסאות חסרות ואינו דורס רשומות קיימות או עריכות קודמות.","APP_VERSION נשאר מקור הגרסה היחיד במערכת.","לא שונתה לוגיקת נעילת היום, העבודות, ההתחברות, הדוחות או הגיבוי."], date:d},
      {version:"5.92", title:"מניעת הבהוב חלון הדיבאג", items:["חלון דיבאג נעילת היום מוסתר כבר לפני הציור הראשון של הדפדפן.","מצב תצוגה ישן שנשמר בדפדפן מנוקה כדי למנוע הופעה רגעית לאחר רענון.","החלון נפתח רק בהפעלה מפורשת עם dayLockDebug=1.","לא שונתה לוגיקת נעילת היום או Firebase."], date:d},
      {version:"5.91", title:"טעינת נעילת יום לאחר רענון", items:["טעינת הנעילות ממתינה עד שמזהה העובד זמין.","לאחר זיהוי העובד מתבצעת קריאה מ-Firestore ורינדור מחדש של הלוח והיום הנבחר.","כלי הדיבאג נשאר בקוד אך מוסתר כברירת מחדל.","לא שונו עבודות או דוחות קיימים."], date:d},
      {version:"5.90", title:"כלי דיבאג לנעילת יום", items:["נוסף חלון אבחון לשלבי זיהוי המשתמש, שמירת הנעילה, אימות המסמך וטעינה לאחר רענון.","הלוג נשמר מקומית וכולל אפשרות העתקה מלאה.","הכלי נועד לאיתור נקודת הכשל בלי לשנות את נתוני העובד."], date:d},
      {version:"5.89", title:"אייקון עין יציב בכרום", items:["אייקון הצגת הסיסמה הוחלף מאימוג׳י ל-SVG פנימי שאינו תלוי בפונט הדפדפן.","העיצוב אחיד בכניסת עובד ובכניסת מנהל.","מצב הצגה והסתרה מקבלים אייקון ברור.","לא שונתה לוגיקת ההתחברות."], date:d},
      {version:"5.88", title:"חיזוק שמירת נעילת יום", items:["טעינת נעילות היום הותאמה להמתנה לשחזור Firebase Auth.","כשל זמני באימות או ברשת אינו מאפס את רשימת הנעילות.","לאחר השמירה מתבצעת קריאת אימות למסמך ב-Firestore."], date:d},
      {version:"5.87", title:"התאמת העין ומיקום המנעול", items:["אייקון העין בכניסת עובד הוקטן והותאם לכניסת מנהל.","אייקון המנעול בלוח השנה הוקטן והועבר לפינה כדי שלא יסתיר את מספר היום.","לא שונתה לוגיקת נעילת היום."], date:d},
      {version:"5.86", title:"נעילת יום מלאה", items:["חלון האישור המיותר בעת נעילת יום הוסר.","כרטיסי קריאת שירות והתקנה נחסמים בפועל כשהיום נעול.","נוסף אייקון מנעול ליום נעול בלוח השנה.","לא שונתה שמירת העבודות בימים פתוחים."], date:d},
      {version:"5.85", title:"בסיס נעילת יום ואייקון סיסמה", items:["נשמר הבסיס היציב שממנו בוצעו תיקוני נעילת היום והעין במסכי הכניסה.","הגרסה משמשת נקודת מוצא לרצף השיפורים 5.86–5.93."], date:d},
      {version:"5.83", title:"חיפוש מהיר פותח תוצאות גם כשהכרטיסייה מכווצת", items:["לחיצה על זכוכית מגדלת ליד מספר לקוח או כתובת פותחת את כרטיסיית חיפוש וסיכומים.","אם הכרטיסייה הייתה מכווצת, היא נפתחת אוטומטית כדי שהתוצאות יוצגו מיד.","החיפוש עדיין משתמש במנגנון הקיים וללא הגבלת זמן, בלי ליצור חיפוש חדש.","לא שונו עבודות, חישובים, גיבוי JSON, ייצוא אקסל או שמירת פק״עות."], date:d},
      {version:"5.82", title:"תיקון לחיצה על זכוכית מגדלת נקייה", items:["תוקנה הלחיצה על אייקון החיפוש הנקי ליד מספר לקוח וליד כתובת.","האייקון נשאר ללא מסגרת, רקע או ריבוע, אבל עכשיו מפעיל שוב את החיפוש הקיים בכל ההיסטוריה.","התיקון משתמש ב-event delegation יציב כדי שהלחיצה תעבוד גם אחרי רינדור מחדש של כרטיסי פק״ע.","לא שונו חישובים, שמירת פק״עות, כיווץ כרטיסיות, גיבוי JSON או ייצוא אקסל."], date:d},
      {version:"5.80", title:"תיקון יציבות גרסה והקטנת אייקון חיפוש", items:["תוקן מצב שבו תצוגת הגרסה התחלפה בין 5.78 ל-5.79 בגלל קוד פנימי ישן של קיצור החיפוש.","APP_VERSION נשאר מקור הגרסה היחיד להצגה בממשק.","זכוכית המגדלת ליד מספר לקוח וכתובת הוקטנה עוד יותר לאייקון קטן ועדין.","לא שונתה לוגיקת החיפוש, הכיווץ, שמירת פק״עות, גיבוי JSON או ייצוא אקסל."], date:d},
      {version:"5.79", title:"תיקון כיווץ בכרום והקטנת אייקון חיפוש", items:["זכוכית המגדלת ליד מספר לקוח וכתובת הוקטנה לאייקון קטן ועדין יותר.","כיווץ כרטיסיות העובד חוזק כך שהלחיצה תעבוד גם בכרום לאחר העלאה ל-GitHub.","מנגנון השמירה המקומית ב-localStorage נשאר ללא שינוי.","לא שונו חישובים, שמירת פק״עות, חיפוש, גיבוי JSON, אקסל או דוח התחשבנות."], date:d},
      {version:"5.78", title:"קיצור חיפוש מכרטיסי פק״ע", items:["נוסף אייקון חיפוש קטן ליד מספר לקוח וליד כתובת בכרטיסי פק״ע/עבודה.","לחיצה על האייקון פותחת את כרטיסיית החיפוש הקיימת, ממלאת את מספר הלקוח או הכתובת ומריצה חיפוש בכל ההיסטוריה ללא הגבלת זמן.","השינוי משתמש במנגנון החיפוש הקיים בלבד ולא מוסיף שדות חדשים או משנה נתונים."], date:d},
      {version:"5.77", title:"כיווץ רק בכרטיסיות העובד", items:["כפתור הכיווץ מופיע רק בכרטיסיות העליונות של העובד: תצוגה כללית, הכלים שלי, הגדרות אישיות, דשבורד חכם, היסטוריית לקוח והחיפוש וסיכומים.","לוח השנה, רשימת פק״עות ופאנלים של יום/עריכה לא מקבלים יותר כפתור כיווץ.","מצב הכיווץ נשמר מקומית ב-localStorage לכל כרטיסייה ומכשיר.","לא שונו חישובים, שמירת עבודות, גיבוי JSON, ייצוא אקסל או דוח התחשבנות."], date:d},
      {version:"5.76", title:"כיווץ כרטיסים ושמירה מקומית", items:["נוסף לכל כרטיס תוכן כפתור חץ בכותרת לפתיחה וכיווץ.","כאשר כרטיס מכווץ נשארת רק הכותרת, והאזורים שמתחתיו עולים למעלה כדי לחסוך מקום במסך.","מצב הכיווץ נשמר ב-localStorage לפי המכשיר, ולכן נשאר גם אחרי רענון או כניסה מחדש.","הושלמו רשומות מה חדש החסרות לגרסאות 5.70, 5.72, 5.74 ו-5.75."], date:d},
      {version:"5.84", title:"ניווט מהדשבורד החכם לפק״ע המדויקת", items:["כל רשומה במתוזמנות שבוצעו ובמתוזמנות שלא בוצעו ניתנת ללחיצה על כל הכרטיס.","לחיצה עוברת ליום המדויק, פותחת את פאנל היום, גוללת לפק״ע לפי ID ומדגישה אותה זמנית.","הניווט אינו מבוסס על מספר לקוח ולא מוסיף שדות חדשים."], date:d},
      {version:"5.75", title:"ניקוי טקסט טכני מדשבורד חכם", items:["הוסר מהכרטיס מתוזמנות שבוצעו הטקסט הטכני שהזכיר את convertedFromPlanned.","הכרטיס נשאר נקי עם כותרת, כמות, סכום ורשימת עבודות בלבד.","לא שונתה שום לוגיקה, חישוב או שמירת נתונים."], date:d},
      {version:"5.74", title:"דשבורד חכם: מתוזמנות שבוצעו", items:["נוסף מתחת לאזור מתוזמנות שלא בוצעו אזור חדש מתוזמנות שבוצעו.","החישוב משתמש בשדה הקיים convertedFromPlanned=true יחד עם עבודות שבוצעו בפועל.","האזור מציג כמות, סכום כולל ורשימה מתומצתת בגלילה לפי תאריך, לקוח, סוג עבודה, כתובת וסכום.","לא נוסף שדה חדש ולא שונתה שמירת נתונים."], date:d},
      {version:"5.72", title:"תיקון כפתור גיבוי JSON אישי", items:["גיבוי JSON אישי עטוף בטיפול שגיאות מלא כדי שכשל קריאה יוצג למשתמש במקום שקט מוחלט.","נוסף סטטוס בזמן הכנת הגיבוי ופירוט מקטעים שדולגו אם אין הרשאה.","הגיבוי ממשיך להוריד קובץ גם אם מקטע לא קריטי חסום בהרשאות.","לא שונו שמירת עבודות, שחזור JSON, דוח התחשבנות, ימי חופש, לוגין או אדמין."], date:d},
      {version:"5.70", title:"בסיס לאיתור פק״עות שלא בוצעו", items:["נשמר בסיס יציב לפני הרחבת גיבוי ושחזור JSON מלאים לעובד.","כולל את מנגנון פק״עות לא בוצעו ובדיקת לקוח לפי הרשומות הקיימות.","הרשומה נוספה כדי להשלים רצף מה חדש בין 5.69 ל-5.71."], date:d},
      {version:"5.71", title:"גיבוי ושחזור JSON מלא לעובד", items:["גיבוי JSON אישי כולל עכשיו פרופיל עסקי של העובד, יעד חודשי, יעדים לפי חודש, עבודות, ימי חופש, דוחות התחשבנות, תבניות, מחירון ובקשות תשלום אם קיימות.","שחזור JSON לעובד אחר ממפה את הרשומות לעובד היעד כדי לא לדרוס את העובד המקורי באותו Firebase.","ימי חופש ודוחות התחשבנות נשמרים לפי עובד היעד והתאריך/החודש המקוריים.","פרטי התחברות רגישים כמו username, passwordHash, authUid ו-authEmail לא מועתקים כדי לא לשבור כניסה קיימת."], date:d},
      {version:"5.69", title:"בדיקת לקוח: הצגת פק״ע שלא בוצעה", items:["בדיקת לקוח חוזר מציגה עכשיו פק״ע מתוזמנת שסומנה כלא בוצעה כהערה ברורה ולא כעבודה רגילה עם ₪0.","ההערה כוללת תאריך, סוג עבודה, סיבה ופירוט אם קיים.","מילוי הכתובת האוטומטי נשאר כמו שהיה וממשיך לעבוד גם לפי רשומות שלא בוצעו.","לא שונו שמירת עבודות, מתוזמנות, עריכה, דשבורד, HTML או CSS."], date:d},
      {version:"5.68", title:"חיוב בחירת פק״ע בכל התקנה", items:["בכל שמירת התקנה רגילה או מתוזמנת חובה לבחור סוג פק״ע CN או CH.","בחירה ריקה אינה נחשבת רגילה ולא מאפשרת שמירה.","אם סוג הפק״ע חסר, הטופס נשאר פתוח, מוצגת הודעה אדומה והסמן עובר לשדה סוג הפק״ע.","החובה חלה על כל התקנת RF או סיב, בלי קשר לפריט ההתקנה שנבחר."], date:d},
      {version:"5.67", title:"דשבורד חכם: פירוט CN/CH בהתקנות סיב", items:["כרטיס התקנות סיב מציג עכשיו כמה מתוך התקנות הסיב עם מודם הן פק״ע CN וכמה הן פק״ע CH.","הפירוט נספר רק כאשר בעבודה מסומן הפריט התקנת שקע סיב חדש - כולל מודם.","פק״עות CN/CH שלא כוללות את הפריט הזה לא נספרות בתוך התקנות הסיב כדי לשמור על מדד נקי.","לא שונו שמירת עבודות, מחירונים, דוחות, לוגין, HTML או CSS."], date:d},
      {version:"5.66", title:"ולידציה בשמירת פק״ע מתוזמנת", items:["שמירת קריאת שירות או התקנה מתוזמנת עם מספר לקוח חסר או כתובת חסרה כבר לא מאפסת את הטופס.","במקרה של שדה חובה חסר מוצגת הודעה אדומה והסמן עובר לשדה שצריך להשלים.","האיפוס והחזרה למסך הראשוני קורים רק אחרי שמירה מוצלחת בפועל.","התיקון בוצע ב-functions.js בלבד ללא שינוי HTML/CSS או מבנה נתונים."], date:d},
      {version:"5.65", title:"עריכת פק״ע CN/CH", items:["עריכת פק״ע קיימת או מתוזמנת טוענת את ערך CN/CH הקיים לתוך חלון העריכה.","שמירת העריכה מעדכנת את pekaType לערכים תקינים CN או CH בלבד.","אם סוג הפק״ע ריק או לא תקין הוא נמחק מהרשומה כדי לא להשאיר מידע שגוי.","לא שונו שמירת עבודות רגילה, מחירונים, דשבורד או Security Rules."], date:d},
      {version:"5.64", title:"בסיס יציב לפני תיקוני עריכה", items:["נשמר מבנה שלושת הקבצים היציב: index.html, styles.css ו-functions.js.","הגרסה שימשה בסיס לתיקוני CN/CH ולבדיקות שמירת פק״עות מתוזמנות.","לא בוצע שינוי עיצובי או שינוי מבנה Firebase במסגרת רשומת השלמה זו."], date:d},
      {version:"5.63", title:"PDF חודשי מקצועי מלא", items:["דוח ה-PDF החודשי שודרג לדוח מקצועי עם עמוד פתיחה, תקציר כספי, ביצועים, גרפים, פירוט יומי מלא ועמוד התחשבנות נקסטקום.","הדוח טוען עצמאית לפי החודש הנבחר: עבודות, יעד חודשי, ימי חופש, לא בוצעו ונתוני התחשבנות שמורים.","נוסף פירוט לפני מע״מ, מע״מ, כולל מע״מ, נטו אחרי קיזוזים והפרש מול סכום המערכת.","לא שונו שמירת עבודות, דשבורד, חיפוש, לוגין, Security Rules או מבנה שלושת הקבצים."], date:d},
      {version:"5.62", title:"חיפוש כללי בכל ההיסטוריה כשאין סינון תאריכים", items:["חיפוש לפי מספר לקוח, כתובת או פילטר ללא תאריך רץ עכשיו על כל היסטוריית העובד ולא רק על החודש שמוצג בלוח.","סיכום חודש מלא נשאר לפי החודש שמוצג בלוח.","אם נבחר חודש, יום או טווח תאריכים — החיפוש נשאר מוגבל לתאריכים שנבחרו.","לא שונו שמירת עבודות, דשבורד, PDF, התחשבנות, ימי חופש או לוגין."], date:d},
      {version:"5.61", title:"בחירת חודש לדוח PDF מתוך סלקטור", items:["ייצוא PDF חודשי כבר לא מבקש הקלדת חודש ידנית.","נוסף סלקטור חודשים מסודר כדי למנוע שגיאות פורמט.","ברירת המחדל היא החודש שמוצג בלוח / בדוח ההתחשבנות.","ה-PDF מופק לפי החודש שנבחר בסלקטור."], date:d},
      {version:"5.60", title:"PDF חודשי עם בחירת חודש וטעינה עצמאית", items:["בלחיצה על סיכום חודש PDF נפתחת בחירת חודש לדוח.","הדוח טוען לבד עבודות ונתוני התחשבנות של החודש שנבחר, בלי תלות בלחיצה קודמת על טען דוח.","הדוח כולל נתוני נקסטקום, קיזוזים, לפני מע״מ, מע״מ וכולל מע״מ.","לא שונו שמירת עבודות, דשבורד, ימי חופש, לוגין או Security Rules."], date:d},
      {version:"5.59", title:"עמוד התחשבנות נקסטקום בדוח PDF", items:["נוסף לדוח ה-PDF עמוד התחשבנות אחרון עם נתוני נקסטקום בפועל.","העמוד כולל RF, סיבים, מכירות, הכנסה כללית, ציוד שחור, קנסות והוצאות נוספות.","נוספו חישובי לפני מע״מ, מע״מ וכולל מע״מ בדוח הסופי.","לא שונו שמירת עבודות, דשבורד, חיפוש או לוגין."], date:d},
      {version:"5.58", title:"ייצוא סיכום חודש ל-PDF", items:["נוסף כפתור סיכום חודש PDF באזור הכלים של העובד.","נוצר דוח חודשי ראשוני לפתיחה בחלון הדפסה ושמירה כ-PDF.","הדוח כולל סיכום חודש, סיכום לפי ימים ופירוט עבודות.","לא שונו שמירת עבודות, דשבורד, התחשבנות או לוגין."], date:d},
      {version:"5.57", title:"יעד חודשי נקרא לפי החודש בדשבורד", items:["הדשבורד והכרטיסים קוראים יעד לפי החודש שמוצג בלוח מתוך monthlyGoalsByMonth.","אם אין יעד שמור לחודש, יש fallback ליעד monthlyGoal הכללי.","שינוי יעד לחודש אחד לא משנה את הצגת היעד בחודש אחר.","לא שונו Security Rules או שמירת עבודות."], date:d},
      {version:"5.56", title:"בחירת חודש יעד עם שדה חודש אמיתי", items:["בחירת חודש ליעד חודשי הוחלפה לשדה חודש אמיתי כדי שלא להישאר רק עם חודש נוכחי.","המשתמש יכול לבחור חודש ולשמור יעד ספציפי לאותו חודש.","השמירה נשארת בתוך מסמך העובד תחת monthlyGoalsByMonth.","לא שונו Security Rules או שמירת עבודות."], date:d},
      {version:"5.55", title:"שמירת יעד חודשי לפי חודש בתוך העובד", items:["נוסף מנגנון monthlyGoalsByMonth בתוך מסמך העובד לשמירת יעד לכל חודש.","בהגדרות העובד נוספה אפשרות לשייך יעד לחודש נבחר.","היעד הכללי monthlyGoal נשמר כתאימות לאחור לעובדים וחודשים ישנים.","לא נדרש שינוי Security Rules כי הנתון נשמר בתוך מסמך העובד הקיים."], date:d},
      {version:"5.73", title:"ייצוא עובד מלא לאקסל לפי כרטיסיות", items:["ייצוא העובד לאקסל הורחב לקובץ XLSX מלא עם כרטיסיות נפרדות ולא רק גליון עבודות בסיסי.","נוספו כרטיסיות סיכום, סיכום חודשים, כל העבודות, יעדים, ימי חופש, דוחות התחשבנות, תבניות, מחירון ובקשות תשלום.","כל חודש מקבל כרטיסיית עבודות נפרדת, והנתונים ממוינים לפי חודש ותאריך כדי שיהיה נוח לבדיקה.","אם מקטע מסוים חסום בהרשאות, הייצוא ממשיך עם שאר הנתונים ומציג כרטיסיית שגיאות ייצוא."], date:d},
      {version:"5.54", title:"ימי חופש לפי חודש בלוח ובדשבורד", items:["טעינת החודש הפעילה טוענת עכשיו את ימי החופש של החודש הנבחר לפני רינדור הלוח והדשבורד.","מעבר לחודש קודם או חודש הבא מציג מיד את סימוני החופש של אותו חודש, בלי צורך לסמן מחדש יום חופש.","הדשבורד החכם מחשב את מספר ימי החופש לפי החודש שמוצג בלוח ולא לפי נתון ישן שנשאר בזיכרון.","לא שונו שמירת יום חופש, ביטול יום חופש, עבודות, פק״ע, לא בוצע, דוח התחשבנות, גיבוי, אקסל או לוגין."], date:d},
      {version:"5.53", title:"דוח התחשבנות: צבעים וטקסטים קצרים", items:["שורת ההפרש מול המערכת קוצרה לשתי שורות כדי שלא תגלוש מחוץ לכרטיס במובייל.","חסר מול המערכת מוצג באדום, עודף מול המערכת מוצג בירוק, ומצב מאוזן מוצג באפור.","הכנסות, נטו וסכום סופי מוצגים בירוק; קנסות, ציוד שחור, הוצאות נוספות וסה״כ קיזוזים מוצגים באדום.","קוצרו טקסטים בדוח: ציוד שחור, הוצאות נוספות, נטו לפני מע״מ, סכום סופי כולל מע״מ.","לא שונו חישובי הדוח או שמירת הדוחות, ולא נגעו בעבודות, פק״ע, לא בוצע, גיבוי, אקסל או לוגין."], date:d},
      {version:"5.52", title:"דוח התחשבנות: הסברים קטנים וברוטו אחרי קיזוזים", items:["נוספו הסברונים קטנים מעל שדות דוח ההתחשבנות כדי שיהיה ברור מה מזינים בכל מספר גם אחרי שהשדה מלא.","תוקן חישוב הברוטו בפועל כך שמע״מ 18% מחושב על הנטו אחרי קיזוזים ולא על ההכנסה לפני קיזוזים.","שורת הפער מול המערכת מציגה עכשיו חסר / יותר / תואם במקום מספר שלילי מבלבל.","נשמרו כל שדות הדוח והמסמך הקיים תחת העובד, בלי לשנות שמירת עבודות, פק״ע, לא בוצע, גיבוי או אקסל."], date:d},
      {version:"5.50", title:"דוח התחשבנות: קיזוזים בפועל והרשאות שמירה", items:["הוסר חישוב קיזוז 6% אוטומטי מדוח ההתחשבנות כדי לא לערבב בין חישוב מערכת לבין מה שנקסטקום קיזזה בפועל.","קיזוז ציוד / ציוד שחור נשאר כשדה ידני בפועל לפני מע״מ, והמערכת מחשבת לבד את האחוז שלו מתוך ההכנסות בפועל.","סה״כ קיזוזים מחושב עכשיו מקיזוז ציוד בפועל, קנסות בפועל והוצאות דינמיות בלבד.","הדוח ממשיך להישמר תחת workers/{workerId}/monthlySettlements/{YYYY-MM}; נדרשת התאמת Security Rules לתת־האוסף הזה.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, לוח שנה, מחירון, גיבוי או אקסל."], date:d},
      {version:"5.49", title:"פירוט הכנסות בפועל בדוח התחשבנות", items:["בדוח ההתחשבנות הוחלפה רובריקת ההכנסה היחידה בארבע רובריקות נפרדות: יצרנות RF, יצרנות סיבים, מכירות והכנסה כללית.","כל ההכנסות מוזנות לפני מע״מ ומתחברות אוטומטית לסך הכנסה בפועל לפני מע״מ.","הקנס נשאר סכום בפועל והמערכת מחשבת לבד את אחוז הקנס מתוך סך ההכנסות בפועל או לפי המערכת.","הוצאות וקיזוזים דינמיים נשארו ללא שינוי.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, לוח שנה, מחירון או אקסל."], date:d},
      {version:"5.48", title:"דוח התחשבנות אישי וקנס כסכום בפועל", items:["דוח ההתחשבנות נשמר עכשיו תחת workers/{workerId}/monthlySettlements/{YYYY-MM} במקום collection כללי.","בחירת חודש לא מציגה שגיאת הרשאות אם אין דוח שמור; מוצג חישוב לפי העבודות שבוצעו.","שדה הקנס הפך להזנת סכום קנסות בפועל לפני מע״מ, והמערכת מחשבת את אחוז הקנס אוטומטית.","גיבוי ושחזור עובד כוללים גם דוחות התחשבנות אישיים.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, לוח שנה, מחירון או אקסל."], date:d},
      {version:"5.47", title:"גיבוי ימי חופש ודוח התחשבנות חודשי", items:["גיבוי JSON אישי של עובד כולל עכשיו גם ימי חופש של העובד המחובר בלבד.","שחזור JSON אישי משחזר ימי חופש רק לעובד המחובר, בלי לגעת בנתוני עובדים אחרים.","נוסף דוח התחשבנות חודשי דינמי באזור הכלים: בחירת חודש, חישוב עבודות שבוצעו בלבד, מע״מ 18%, קיזוז 6%, קנסות בפועל אופציונלי והוצאות דינמיות.","דוח ההתחשבנות נשמר ב-Firestore תחת workerMonthlySettlements לפי עובד וחודש, כדי שיהיה זמין מכל מכשיר.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, לוח שנה, מחירון או אקסל."], date:d},
      {version:"5.46", title:"גלילה פנימית ברשימת מחירון בעריכת עבודה", items:["במסך עריכת עבודה, רשימת פריטי המחירון של התקנה מוצגת בגלילה פנימית קבועה כדי שהעריכה לא תהפוך לרשימה ארוכה על כל המסך.","התיקון חל גם על עריכת התקנות סיב/RF וגם על עבודות מתוזמנות שנערכות כעבודת התקנה.","השינוי הוא תצוגה בלבד ולא משנה את חישוב הסכום או את שמירת העריכה.","לא שונו פק״ע, לא בוצע, שכפול, לקוח חוזר, Last Login, דשבורד, אופליין, גיבוי או אקסל."], date:d},
      {version:"5.45", title:"תיקון תצוגת חצי ניווט חודש במובייל", items:["חצי ניווט החודש הוקטנו משמעותית וקיבלו רוחב וגובה קבועים כדי שלא ייחתכו במסך מובייל.","שם החודש נשאר במרכז וברוחב מלא של אזור הלוח, בלי שהחצים דורסים אותו.","התיקון הוא תצוגה בלבד ולא משנה את לוגיקת changeMonth או את נתוני הלוח.","לא שונו פק״ע, לא בוצע, שכפול, לקוח חוזר, Last Login, דשבורד, אופליין, גיבוי או אקסל."], date:d},
      {version:"5.44", title:"ניווט חודש רספונסיבי ומילוי כתובת בפועל", items:["ניווט החודשים בלוח השנה סודר לרוחב מלא של אזור הלוח עם חצים קטנים וברורים ללא חיתוך במובייל.","שם החודש נשאר במרכז, ברור וקריא גם במסכים צרים.","בדיקת לקוח חוזר ממלאת בפועל את שדה הכתובת של קריאת שירות או התקנה כאשר נמצאה כתובת קודמת והשדה ריק.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, דשבורד, אופליין, גיבוי או אקסל."], date:d},
    {version:"5.43", title:"ניווט חודש נקי ומילוי כתובת לקוח חוזר", items:["ניווט החודשים בלוח השנה הוחלף לתצוגה נקייה עם חצים קטנים בלבד ושם חודש מרכזי וברור.","החצים יושבים בתוך אותה מסגרת רוחב של הלוח כדי שלא ייחתכו או ידרסו את כותרת החודש במובייל.","בדיקת לקוח חוזר ממלאת אוטומטית את שדה הכתובת מהעבודה האחרונה של אותו לקוח כאשר השדה ריק.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, דשבורד, אופליין, גיבוי או אקסל."], createdAt:"2026-06-02"},
    {version:"5.42", title:"יישור ניווט חודשים לרוחב הלוח", items:["ניווט החודשים יושב עכשיו באותו רוחב של לוח השנה ושורת ימי השבוע כדי שהחצים לא ייחתכו בגלילה או במובייל.","החצים הוקטנו ונשארים בתוך מסגרת הלוח; שם החודש נשאר במרכז עם כיתוב קטן וברור.","תוקנה התנגשות CSS מול חוקי יציבות הכפתורים במובייל, בלי לשנות את לוגיקת changeMonth.","לא שונו עריכת עבודה, מחירון, פק״ע, לא בוצע, שכפול, Last Login, דשבורד, אופליין, גיבוי או אקסל."], createdAt:"2026-06-02"},
    {version:"5.41", title:"התאמת גובה ניווט חודשים", items:["כפתורי חודש קודם/חודש הבא הוקטנו וקיבלו רוחב וגובה קבועים כדי שלא ידרסו את שם החודש.","שם החודש נשאר במרכז וקיבל הגנת גלישה במובייל כדי שהתצוגה תישאר נקייה.","השינוי הוא עיצוב בלבד ומשתמש באותה לוגיקת changeMonth הקיימת.","לא שונו עריכת עבודה, מחירון, פק״ע, לא בוצע, שכפול, Last Login, דשבורד, אופליין, גיבוי או אקסל."], createdAt:"2026-06-02"},
    {version:"5.40", title:"גלילה בעריכת מחירון וניווט חודשים קומפקטי", items:["במסך עריכת עבודה, רשימת פריטי המחירון של התקנה מוצגת בגלילה פנימית כדי שהעריכה לא תאריך את כל המסך.","ניווט החודשים בלוח השנה הוחלף לכפתורי חץ ימינה/שמאלה קומפקטיים עם כיתוב קטן ליד שם החודש.","הושלמו במקור מה חדש הרשומות החסרות 5.36 עד 5.39 כדי שהתצוגה לא תיעצר ב-5.35.","לא שונו שמירת עבודות, פק״ע, לא בוצע, שכפול, Last Login, דשבורד, אופליין, גיבוי או אקסל."], createdAt:"2026-06-02"},
    {version:"5.39", title:"לא בוצע עם שכפול אופציונלי למועד חדש", items:["בעת סימון פק״ע מתוזמנת כלא בוצעה, ניתן לשכפל אותה לתאריך חדש לפי בחירה.","ברשומה המקורית נשמרת הערה לאיזה תאריך הפק״ע עברה.","ברשומה החדשה המתוזמנת נשמרת הערה שוכפלה מתאריך המקור.","נשמר מקור גרסה יחיד כדי למנוע קפיצות גרסה בממשק."], createdAt:"2026-06-02"},
    {version:"5.38", title:"חסימת שינוי תאריך לשבת או יום חופש", items:["שינוי תאריך לא מאפשר להעביר עבודה ליום שבת.","שינוי תאריך לא מאפשר להעביר עבודה ליום שמסומן כיום חופש.","במקרה חסום מוצגת הודעה ברורה והתאריך המקורי נשאר ללא שינוי.","לא שונו שמירת עבודות, מתוזמנות, לא בוצע, מחירון, תבניות, דשבורד, אופליין, גיבוי, אקסל או לוגין."], createdAt:"2026-06-01"},
    {version:"5.37", title:"גלילה למחירון התקנה + שינוי תאריך עבודה", items:["אזור פריטי המחירון בטופס התקנה קיבל גלילה פנימית כדי שהמסך לא יתארך יותר מדי.","נוסף שינוי תאריך לעבודה קיימת בלי למחוק או לשכפל את הרשומה.","שינוי התאריך שומר את כל פרטי העבודה: לקוח, כתובת, פריטים, פק״ע, סטטוס, סיבה והערות.","לא שונו שמירת עבודות, יום חופש, תבניות, לא בוצע, אופליין, גיבוי, אקסל או לוגין."], createdAt:"2026-06-01"},
    {version:"5.36", title:"חזרה למסך בחירת סוג עבודה אחרי שמירה", items:["אחרי שמירת קריאת שירות, התקנה או סידור מתוזמן, הטופס חוזר למצב הראשוני של היום הנבחר.","היום נשאר מסומן בלוח השנה ומוצגים רק כפתורי הבחירה ויום החופש.","האיפוסים של פק״ע CN/CH וקריאת שירות חוזרת נשמרו.","לא שונו שמירת עבודות, יום חופש, תבניות, מתוזמנות, לא בוצע, דשבורד, אופליין, גיבוי או לוגין."], createdAt:"2026-06-01"},
    {version:"5.35", title:"איפוס פק״ע וקריאת שירות חוזרת אחרי שמירה/ניקוי", items:["שדה סוג פק״ע CN/CH מתאפס אחרי שמירת התקנה רגילה או מתוזמנת.","שדה סוג פק״ע CN/CH מתאפס גם אחרי ניקוי בחירת התקנה.","סימון קריאת שירות חוזרת יורד אחרי שמירת קריאת שירות רגילה או מתוזמנת, והסכום חוזר למחיר הרגיל.","התיקון נוגע רק לאיפוס שדות טופס ולא משנה יום חופש, תבניות, מתוזמנות, דשבורד, אופליין, גיבוי או לוגין."], createdAt:"2026-06-01"},
    {version:"5.34", title:"החזרת יום חופש למסך יום נבחר", items:["כפתור סמן כיום חופש הוחזר למסך היום הנבחר אחרי הפרדת בוצעו / מתוזמנות / לא בוצעו.","יום שמסומן כחופש מציג שוב הודעה ברורה וכפתור בטל יום חופש.","התיקון הוא תצוגה בלבד ולא משנה שמירת עבודות, פק״ע, תבניות, אופליין, גיבוי או לוגין."], createdAt:"2026-06-01"},
    {version:"5.33", title:"הפרדת עבודות שבוצעו ומתוזמנות ביום נבחר", items:["תצוגת היום הנבחר הוחזרה להפרדה ברורה בין עבודות שבוצעו לבין מתוזמנות.","עבודות בסטטוס not_done מוצגות באזור נפרד לא בוצעו אם קיימות באותו יום.","לא שונו שמירת עבודות, סימון בוצע, לא בוצע, מחירון, תבניות, אופליין, גיבוי או לוגין."], createdAt:"2026-05-31"},
    {version:"5.32", title:"תיקון תצוגת פק״ע וטעינת תבניות", items:["הוחלף הכיתוב למשתמש מפקה לפק״ע בכל התצוגות הרלוונטיות, בלי לשנות את שדה הנתונים pekaType.","תוקנה בחירת תבניות התקנה כך שאם ID ישן של פריט מחירון לא נמצא, המערכת מחפשת התאמה לפי שם הפריט.","פריטים שלא קיימים יותר במחירון מדולגים בלי לעצור את טעינת התבנית ובלי לפגוע בחישוב הסכום."], createdAt:"2026-05-31"},
    {version:"5.31", title:"תיקון תצוגת פק״ע וסינון רק להתקנות", items:["תוקנה תצוגת סוג פק״ע בכרטיסי עבודות ומתוזמנות כך ש-CN/CH יוצגו כתג תקין ולא כטקסט HTML שבור.","סינון לפי סוג פק״ע בחיפוש מופיע ופועל רק כאשר סוג העבודה הוא התקנות.","בחירת קריאות שירות או כל סוגי העבודה מנקה את סינון הפק״ע כדי שלא יסתיר תוצאות."], createdAt:"2026-05-31"},
    {version:"5.30", title:"תיקון טעינת פק״ע בחיפוש ובדשבורד", items:["תוקנה שגיאת selectedSearchPekaV528 is not defined בזמן טעינת נתוני העובד.","פונקציות פק״ע שנדרשות ל-wrapper של החיפוש והדשבורד נחשפות ל-window בצורה בטוחה.","לא שונו שמירת עבודות, לא בוצע, סיבות, אופליין, גיבוי, אקסל או לוגין."], createdAt:"2026-05-31"},
      {version:'5.29',title:'לא בוצע למתוזמנות + מיקום סוג פק״ע מתחת לתבניות',date:d,items:[
        'סוג פק״ע CN/CH הועבר בטופס ההתקנה למיקום מתחת לבחירת תבניות ההתקנה.',
        'בעבודות מתוזמנות נוסף כפתור לא בוצע שלא מוחק את העבודה אלא שומר סטטוס not_done.',
        'נוסף חלון בחירת סיבה: לקוח לא בבית, לקוח לא עונה, לקוח ביטל, ביקש מועד אחר, אין תשתית, השחלה תקועה, אין גישה או אחר.',
        'הדשבורד החכם מציג סיכום לא בוצעו החודש לפי סיבות ורשימת עבודות אחרונות שלא בוצעו.'
      ]},
      {version:'5.28',title:'סיכום וחיפוש לפי סוג פק״ע CN/CH',date:d,items:[
        'הדשבורד החכם מציג ספירה חודשית של פק״עות CN ופק״עות CH.',
        'הספירה מתייחסת לעבודות שבוצעו בפועל ולא לסידורים עתידיים.',
        'נוסף פילטר בחיפוש החכם לפי סוג פק״ע: הכל, CN או CH.',
        'עבודות ישנות ללא pekaType ממשיכות לעבוד רגיל ולא נפגעות.'
      ]},
      {version:'5.27',title:'סוג פק״ע בהתקנות CN/CH',date:d,items:[
        'נוסף סלקט קטן ויפה בטופס התקנה לבחירת סוג פק״ע CN או CH.',
        'השדה אינו חובה; אם לא נבחר סוג פק״ע, לא נשמר ולא מוצג כלום.',
        'עבודות התקנה חדשות שכוללות סוג פק״ע יציגו פק״ע: CN או פק״ע: CH בתצוגת היום.',
        'לא שונו מחירונים, דשבורד, אופליין, קריאות שירות, גיבויים או אקסל.'
      ]},
      {version:'5.26',title:'תיקון שמירת התקנת סיב/RF רגילה ומתוזמנת',date:d,items:[
        'תוקנה פונקציית addInstallWithStatusV411 שהיא הפונקציה הפעילה בפועל עבור התקנות סיב/RF.',
        'פונקציות העזר של השמירה נחשפו ל-window כדי שגם סקריפט V411 יוכל להשתמש בהן.',
        'התיקון מכסה התקנת סיב, התקנת RF, התקנה מתוזמנת וסיב/RF מתוזמן.',
        'השמירה מציגה חיווי מיידי, מנקה שדות ומונעת לחיצות כפולות גם באופליין או ברשת איטית.'
      ]},
      {version:'5.25',title:'תיקון שמירה לקריאת שירות / התקנה / מתוזמן',date:d,items:[
        'תוקנו כפתורי השמירה הפעילים בפועל: קריאת שירות, התקנה, קריאת שירות מתוזמנת והתקנה מתוזמנת.',
        'הוחזרו פונקציות עזר חסרות שגרמו ללחיצה על שמור להיראות כאילו לא עושה כלום.',
        'השמירה מציגה חיווי מיידי ומנקה שדות גם באופליין או ברשת איטית.',
        'נוספה נעילת לחיצה קצרה כדי למנוע שמירה כפולה.'
      ]},
      {version:'5.24',title:'התחברות אחרונה: הצגת חיבור נוכחי כשאין נתון קודם',date:d,items:[
        'אם אין התחברות קודמת ב-Firestore, הפאנל מציג התחברות נוכחית עם השעה הנוכחית.',
        'לאחר ההצגה, ההתחברות הנוכחית נשמרת ל-users/{authUid} ותופיע כ"חובר לאחרונה" בכניסה הבאה.',
        'המידע נשאר ב-Firestore בלבד, ללא localStorage וללא כתיבה ל-workers.',
        'לא שונו דשבורד, שמירות, אופליין, חיפוש או מחירונים.'
      ]},
      {version:'5.23',title:'התחברות אחרונה בפאנל תחתון נקי',date:d,items:[
        'חלון Debug התחברות אחרונה הוחלף בפאנל נקי ועדין שמציג רק את התוצאה.',
        'הפאנל מוצג באזור התחתון של מסך העובד מעל לוח השנה, בלי לגעת בפאנל העליון.',
        'כניסה אוטומטית מפרטי התחברות שמורים נחשבת כניסה מחדש ומעדכנת את הנתון לפעם הבאה.',
        'המידע נקרא ונשמר דרך Firestore בלבד במסמך users/{authUid}, ללא localStorage וללא כתיבה ל-workers.'
      ]},
      {version:'5.22',title:'Debug התחברות אחרונה וניקוי שגיאת מחירון לעובד',date:d,items:[
        'נוסף חלון Debug גלוי לבדיקת התחברות אחרונה באזור העובד.',
        'הדיבאג מציג UID, מצב Auth, קריאה מ-users/{uid}, תוצאה, כתיבה ושגיאות הרשאה אם יש.',
        'נוסף כפתור בדוק עכשיו להרצת הבדיקה ידנית.',
        'cleanupDuplicatePriceList לא רץ יותר לעובד רגיל בזמן טעינה, כדי למנוע permission-denied מיותר.'
      ]},
      {version:'5.21',title:'תיקון אמיתי לחישוב ימי עבודה עתידיים בדשבורד',date:d,items:[
        'תוקנה הפונקציה האמיתית שמזינה את הדשבורד החכם: remainingWorkDaysWithVacations.',
        'החישוב של כמה צריך לעשות לכל יום עבודה מתחיל עכשיו ממחר ולא מהיום.',
        'החישוב מתחשב בשבתות ובימי חופש עתידיים, ומחלק את החסר ליעד רק בימים שבאמת נשארו לעבוד.',
        'לא נוספו רובריקות חדשות ולא שונה UI; התיקון בוצע בתוך פונקציית החישוב הקיימת שמחוברת לדשבורד בפועל.'
      ]},
      {version:'5.20',title:'דשבורד חכם: ימי עבודה שנשארו לא כוללים את היום',date:d,items:[
        'חישוב כמה צריך לעשות לכל יום עבודה שנשאר בדשבורד החכם עודכן כך שהוא לא כולל את היום הנוכחי.',
        'בחודש הנוכחי הספירה מתחילה ממחר ועד סוף החודש, ללא שבתות, כדי שכל עבודה שנוספת היום תקזז את החסר ותתחלק רק בימים העתידיים.',
        'אם מסתכלים על חודש שעבר, ימי העבודה שנשארו מוחזרים כ-0 כדי למנוע חישוב מטעה.',
        'לא נוספו רובריקות חדשות ולא שונה UI; התיקון נעשה ישירות בפונקציית remainingWorkDaysInMonth הקיימת.'
      ]},
      {version:'5.19',title:'תיקון הצגת חובר לאחרונה מיד אחרי Login',date:d,items:[
        'תוקן מצב שבו חובר לאחרונה לא הופיע אחרי Logout/Login בגלל ש-serverTimestamp עדיין לא חזר מ-Firestore.',
        'המערכת מציגה קודם את ההתחברות הקודמת ורק אחר כך מעדכנת את ההתחברות הנוכחית.',
        'נוסף fallback מקומי קטן כדי שהמידע יוצג גם אם Firestore מתעכב או המכשיר היה במצב אופליין.',
        'לא שונו זרימת login, הרשאות, שמירת עבודות, Offline sync, גיבוי, אקסל או דשבורד.'
      ]},
      {version:'5.18',title:'התחברות אחרונה בפאנל העליון',date:d,items:[
        'נוסף טקסט קטן ועדין בפאנל העליון שמציג מתי המשתמש חובר לאחרונה.',
        'בעת כניסה מוצלחת של עובד או אדמין נשמר lastLoginAt ב-Firestore עם serverTimestamp.',
        'אם אין התחברות קודמת, השורה מוסתרת כדי לא להעמיס על המסך.',
        'אינדיקטור אונליין/אופליין הוקטן מעט בלי לשנות את לוגיקת הסנכרון או ספירת העבודות הממתינות.'
      ]},
      {version:'5.17',title:'תיקון מקור מה חדש לגרסאות האחרונות',date:d,items:[
        'נוספו רשומות 5.15, 5.16 ו-5.17 ישירות למקור requiredChangelogRows שממנו נבנה חלון מה חדש.',
        'האדמין יוסיף ל-Firestore רק גרסאות חסרות, בלי לדרוס גרסאות קיימות שנערכו ידנית.',
        'העובד והאדמין יראו את העדכון גם אם appChangelog כבר הכיל רשומות ישנות בלבד.',
        'התיקון בוצע בתוך מנגנון ה-Changelog הקיים ולא כשכבת Patch חדשה בסוף הקובץ.'
      ]},
      {version:'5.16',title:'חיווי שמירה מיידי במצב Offline ומניעת כפילויות',date:d,items:[
        'שמירת קריאת שירות והתקנה מציגה חיווי מיידי גם כשהמכשיר אופליין.',
        'הכתיבה ל-Firestore לא חוסמת יותר את ניקוי השדות בזמן Offline; הנתונים נשמרים מקומית ומסתנכרנים ברקע.',
        'נוספה נעילת כפתור קצרה בזמן שמירה כדי למנוע לחיצות חוזרות ושמירת אותה עבודה כמה פעמים.',
        'ניקוי השדות והחזרת הטופס למצב מוכן לעבודה חדשה מתבצעים מיד אחרי קליטת השמירה המקומית.'
      ]},
      {version:'5.15',title:'תיקון הודעת שמירה אחרי רענון חודש',date:d,items:[
        'הודעת ההצלחה אחרי שמירה נשמרת גם אחרי loadMonth ולא נמחקת על ידי רינדור מחדש של היום.',
        'הטופס חוזר למצב נקי ומוכן להזנה חדשה אחרי שמירת קריאת שירות או התקנה.',
        'היום הנבחר נשאר פתוח כדי שהעובד ימשיך לעבוד בלי קפיצה מבלבלת במסך.',
        'השינוי התמקד בחוויית המשתמש אחרי שמירה ולא שינה את מבנה הנתונים או מחירוני העבודה.'
      ]},
      {version:'5.14',title:'מיקום אינדיקטור חיבור עליון',date:d,items:[
        'אינדיקטור אונליין/אופליין/מסנכרן הועבר מהפינה התחתונה לאזור העליון ליד סטטוס המשתמש.',
        'האינדיקטור הוקטן כדי שלא יסתיר כפתורי נגישות, מה חדש או אלמנטים צפים אחרים.',
        'נשמרת אותה לוגיקת Offline וספירת עבודות ממתינות מסנכרון מגרסה 5.13.',
        'השינוי הוא שינוי UI בלבד ולא נוגע בשמירה, אקסל, גיבוי, שחזור, חיפוש, דשבורד או לוגין.'
      ]},
      {version:'5.13',title:'מצב Offline וסנכרון עבודות',date:d,items:[
        'הופעל Firestore offline persistence כדי לאפשר שמירת עבודות גם כשאין אינטרנט.',
        'נוסף אינדיקטור מצב קבוע שמציג אונליין, אופליין או מסנכרן.',
        'האינדיקטור מציג כמה עבודות ממתינות לסנכרון ל-Firebase.',
        'השינוי נעשה כשכבת תצוגה וסנכרון בטוחה, בלי לשנות את לוגיקת השמירה, האקסל, הגיבוי, החיפוש או הדשבורד.'
      ]},
      {version:'5.12',title:'תיקון הצגת מה חדש לגרסאות אחרונות',date:d,items:[
        'תוקן מנגנון ברירות המחדל של Changelog כך שיזרע למסד גם את גרסאות 5.09, 5.10 ו-5.11 שהיו חסרות.',
        'נוספה רשומת מה חדש לגרסה 5.12 כדי שהעדכון עצמו יופיע באדמין ובעובד.',
        'הכתיבה ל-Firestore נשארת במצב בטוח: מוסיפים רק גרסאות חסרות ולא דורסים גרסאות קיימות שהאדמין ערך.',
        'לא שונו לוגין, חיפוש, דשבורד, אקסל, גיבוי, שחזור או שמירת עבודות.'
      ]},
      {version:'5.11',title:'טוגל מגמת הכנסות בדשבורד החכם',date:d,items:[
        'נוסף טוגל למגמת הכנסות לפי ימים בדשבורד החכם.',
        'אפשר לבחור בין מתחילת החודש, 7 ימים אחרונים, 14 ימים אחרונים ו-30 ימים אחרונים.',
        'בחירה של 30 ימים יכולה לכלול נתונים מחודש קודם בלי לשנות את סיכומי החודש הרגילים.',
        'השינוי בוצע נקודתית במגמת ההכנסות בלבד.'
      ]},
      {version:'5.10',title:'מגמת הכנסות מתחילת החודש',date:d,items:[
        'מגמת הכנסות לפי ימים בדשבורד מציגה את כל ימי החודש במקום 10 ימים אחרונים בלבד.',
        'הוסרה מגבלת התצוגה הקבועה שהייתה מקצצת את הגרף.',
        'החישוב נשאר ממוקד בנתוני הדשבורד ולא משנה את הסיכומים או החיפוש.',
        'לא שונו אקסל, גיבוי, שחזור, לוגין או שמירת עבודות.'
      ]},
      {version:'5.09',title:'ניקוי UI שדות תאריך בחיפוש',date:d,items:[
        'שדה יום ספציפי הוסתר מה-UI בלבד כדי למנוע בלבול, בלי למחוק את הפונקציונליות הקיימת.',
        'בחירת חודש מנקה אוטומטית את שדות מתאריך ועד תאריך.',
        'מילוי מתאריך או עד תאריך מנקה אוטומטית את החודש הנבחר.',
        'לוגיקת החיפוש עצמה נשארה כפי שעבדה בגרסה הקודמת.'
      ]},
      {version:'5.08',title:'הבהרת שדות התאריך בחיפוש',date:d,items:[
        'נוספו תוויות ברורות לכל שדות התאריך בכרטיסיית חיפוש וסיכומים.',
        'הובהר ההבדל בין יום ספציפי, מתאריך, עד תאריך וחודש נבחר.',
        'נוספה הערת סדר עדיפות כדי להבין מה משפיע על החיפוש בפועל.',
        'לא שונתה לוגיקת הסינון, האקסל, הגיבוי, השחזור, הלוגין או שמירת עבודות.'
      ]},
      {version:'5.07',title:'טווח תאריכים בחיפוש וסיכומים',date:d,items:[
        'נוספו שדות מתאריך ועד תאריך בכרטיסיית חיפוש וסיכומים.',
        'תאריך אחד בלבד מפעיל חיפוש על אותו יום ספציפי.',
        'שני תאריכים מפעילים טווח מלא, גם מעבר לחודשים.',
        'נוספה בדיקת תקינות שמונעת חיפוש כאשר תאריך הסיום קטן מתאריך ההתחלה.'
      ]},
      {version:'5.06',title:'תיקון כפתור ייצוא עובד ותאימות לאחור',date:d,items:[
        'תוקנה הקריאה לפונקציה downloadExcelTsvV504 שהייתה חסרה וגרמה לשגיאת is not defined במסך העובד.',
        'כפתור ייצוא לאקסל של העובד נשאר מחובר לאותו שם פונקציה, אבל מאחוריו נוצר קובץ XLSX אמיתי.',
        'לא שונו לוגין, דשבורד, שמירת עבודות, מחירונים, ימי חופש או הרשאות.',
        'נוסף רישום מה חדש לגרסה 5.06 כדי שיוזרע למסד הנתונים יחד עם שאר הגרסאות.'
      ]},
      {version:'5.05',title:'ייצוא Excel אמיתי ללא קובץ פגום',date:d,items:[
        'ייצוא לאקסל נבנה מחדש כ-XLSX אמיתי בדפדפן, ללא ספרייה חיצונית.',
        'ייצוא אדמין מלא יוצר גיליון נפרד לכל אוסף במסד הנתונים.',
        'ייצוא עובד אישי מיועד לעבודות של העובד בלבד.',
        'גיבוי ושחזור JSON של האדמין ממשיכים לכלול appChangelog.'
      ]},
      {version:'5.04',title:'תיקון יציב לייצוא אקסל במובייל',date:d,items:[
        'הוחלף ייצוא Excel XML שגרם לקובץ פגום/לא נתמך בחלק מהמכשירים.',
        'ייצוא העובד נבנה כקובץ Excel יציב עם הפרדת טאבים וירידות שורה תקינות, כדי שלא ייפתח כשורה אחת ארוכה.',
        'ייצוא האדמין נבנה כטבלת מסד מלאה במבנה collection / id / field / value לכל האוספים.',
        'הגיבוי והשחזור JSON נשארו ללא שינוי לוגי, כדי לא לפגוע בנתונים.'
      ]},
      {version:'5.03',title:'תיקון ייצוא Excel אמיתי וגיבוי Changelog',date:d,items:[
        'ייצוא האדמין לאקסל נבנה מחדש כקובץ Excel XML תקין עם גיליונות נפרדים: summary, workers, workEntries, priceList, settings, appChangelog ועוד.',
        'ייצוא העובד לאקסל נבנה מחדש עם עמודות אמיתיות ושורות אמיתיות, בלי שורה אחת ארוכה ובלי תגיות HTML.',
        'גיבוי ושחזור האדמין כוללים עכשיו גם את appChangelog כדי שגרסאות מה חדש יישמרו במסד הנתונים.',
        'נוספו רשומות מה חדש חסרות לגרסאות 5.00, 5.01 ו-5.02 כך שהאדמין יזרע אותן ל-Firebase בלי לדרוס רשומות קיימות.'
      ]},
      {version:'5.02',title:'גיבוי ושחזור אדמין מלא',date:d,items:[
        'נוסף גיבוי אדמין מלא לכל האוספים המרכזיים במסד הנתונים.',
        'נוסף שחזור אדמין מלא עם דרישת Auto Backup לפני פעולת שחזור.',
        'נוסף ייצוא אדמין מלא לכל הנתונים, בנפרד מכלי העובד האישיים.',
        'כלי העובד נשארו מוגבלים לנתוני העובד בלבד.'
      ]},
      {version:'5.01',title:'תיקון ייצוא עובד וגיבוי JSON אישי',date:d,items:[
        'תוקן ייצוא העובד כך שלא ישתמש ב-br בין שורות ולא ישבור את Excel.',
        'שופרה פונקציית הגיבוי האישית של העובד כדי לכלול עבודות, תבניות אישיות ומחירון.',
        'שופר שחזור JSON אישי כך שהנתונים משויכים לעובד המחובר בלבד.',
        'עודכנו שמות קבצים לפי APP_VERSION.'
      ]},
      {version:'5.00',title:'דשבורד חכם וספירת התקנות סיב/RF/Change',date:d,items:[
        'נוספה בדשבורד שורת ספירה ברורה להתקנות סיב, התקנות RF ופקודות Change.',
        'עודכן חישוב RF לפי סוג התקנה/מחירון RF.',
        'התקנת סיב ללא פריט מודם נספרת כפקודת Change.',
        'הגרסה נשענת על APP_VERSION כמקור גרסה מרכזי.'
      ]},
      {version:'4.98',title:'תיקון ימי עבודה שנותרו וניקוי כפילויות בדשבורד',date:d,items:[
        'נשאר לך לעבוד מחושב עכשיו ממחר עד סוף החודש, ללא שבתות וללא ימי חופש עתידיים מתוך Firestore.',
        'נוקו כפילויות של עבדת עד היום ונשאר לך לעבוד, כך שהנתונים מופיעים פעם אחת בלבד באזור ימי עבודה וחופש.',
        'התובנות האוטומטיות והכרטיס העליון משתמשים באותו חישוב יעד אחיד.'
      ]},
      {version:'4.97',title:'יישור תובנות אוטומטיות וימי עבודה בדשבורד',date:d,items:[
        'התובנה הראשונה משתמשת בדיוק באותו חישוב כמו הכרטיס העליון: חסר ליעד חלקי ימי עבודה שנשארו אחרי חופש עתידי.',
        'נוסף חיווי: כמה ימי עבודה עברו עד היום ללא שבתות וללא ימי חופש.',
        'נוסף חיווי: כמה ימי עבודה נשארו ממחר עד סוף החודש, ללא שבתות וללא חופש עתידי, עם הערה לא כולל היום.'
      ]},
      {version:'4.96',title:'איחוד חישובי יעד, תחזית וימי עבודה בדשבורד',date:d,items:[
        'כרטיס צריך לכל יום עבודה והתובנות משתמשים באותו חישוב של ימי העבודה שנשארו אחרי חופש עתידי.',
        'הוסר הכרטיס הכפול של ימים עבודה שנשארו מהחלק העליון כדי שלא יהיו שני מספרים שונים.',
        'תחזית סוף חודש מציגה הסבר מלא: בוצע בפועל + ממוצע ליום עבודה × ימי עבודה שנשארו.',
        'אזור ימי עבודה/חופש ממשיך להציג ימי עבודה בחודש, ימי חופש שסומנו, ימי עבודה שנשארו וצריך לכל יום עבודה.'
      ]},
      {version:'4.95',title:'תיקון ימי עבודה וחופש בדשבורד',date:d,items:[
        'ימי עבודה בחודש מחושבים ככל ימי החודש פחות שבתות בלבד.',
        'ימי חופש שסומנו מציג את כל ימי החופש שסומנו בחודש מתוך Firestore.',
        'ימי עבודה שנשארו מחושבים מהיום עד סוף החודש, ללא שבתות, ובניכוי ימי חופש מהיום והלאה בלבד.',
        'התיקון נעשה בתוך פונקציות הדשבורד/ימי החופש הקיימות, בלי להוסיף Patch חדש בסוף הקובץ.'
      ]},
      {version:'4.94',title:'ניקוי מנגנוני Changelog כפולים',date:d,items:[
        'הוסר מצב שבו סקריפטים ישנים של Changelog דרסו את התיקונים החדשים.',
        'האדמין והעובד נטענים עכשיו ממנגנון Changelog אחד ונקי.',
        'גרסאות חסרות מ-v4.87 עד v4.94 נוצרות ב-Firebase בלי לדרוס עריכות קיימות.',
        'נוספו הערות קוד ליד מנגנון ה-Changelog כדי שיהיה ברור מה שונה ולמה.'
      ]},
      {version:'4.93',title:'השלמת גרסאות חסרות ב-Changelog',date:d,items:[
        'אם ב-Firebase קיימות גרסאות ישנות בלבד, המערכת מוסיפה אוטומטית רק את גרסאות ברירת המחדל שחסרות.',
        'גרסאות קיימות שהאדמין ערך לא נדרסות ולא מוחלפות.',
        'אחרי השלמת החסר, חלון מה חדש ופאנל האדמין נטענים מחדש מתוך Firebase בלבד.'
      ]},
      {version:'4.92',title:'ברירות מחדל מ-Firebase בלבד',date:d,items:[
        'Firestore appChangelog הפך למקור האמת של חלון מה חדש וניהול הגרסאות.',
        'אם אין רשומות בכלל, ברירות המחדל נוצרות פעם אחת בתוך Firebase.',
        'לא נעשה שימוש ב-localStorage עבור Changelog.'
      ]},
      {version:'4.91',title:'תיקון תצוגת Changelog',date:d,items:[
        'תיקון הסיסמה מגרסה 4.90 נוסף לחלון מה חדש.',
        'נוסף רישום Changelog ברור לתיקונים האחרונים.'
      ]},
      {version:'4.90',title:'תיקון שינוי סיסמה מהגדרות עובד',date:d,items:[
        'שינוי סיסמה מהגדרות העובד מעדכן את Firebase Auth בפועל.',
        'אחרי שינוי הסיסמה ניתן לצאת ולהיכנס עם הסיסמה החדשה.',
        'הסיסמה הישנה כבר לא מתקבלת אחרי שינוי מוצלח.'
      ]},
      {version:'4.89',title:'ביטול יום חופש אמיתי',date:d,items:[
        'ביטול יום חופש מבטל את כל מסמכי יום החופש של אותו עובד ואותו תאריך.',
        'הטעינה והביטול מתבצעים מול Firestore בלבד ללא localStorage.',
        'נמנע מצב שבו יום חופש חוזר אחרי רענון בגלל מסמך ישן שנשאר פעיל.'
      ]},
      {version:'4.88',title:'טעינת ימי חופש בלי אינדקס מורכב',date:d,items:[
        'טעינת ימי חופש מבצעת query לפי workerId בלבד וסינון תאריך בצד הלקוח.',
        'נפתרה שגיאת failed-precondition של Firestore שנבעה מדרישת אינדקס מורכב.'
      ]},
      {version:'4.87',title:'ימי חופש מ-Firestore בלבד',date:d,items:[
        'ימי חופש הועברו לליבה אחת מול Firestore בלבד.',
        'הוסרה תלות ב-localStorage עבור ימי חופש.',
        'טעינת ימי חופש מתבצעת רק אחרי זיהוי עובד פעיל.'
      ]},
      {version:'4.86',title:'העברת ימי חופש מ-localStorage ל-Firestore',date:d,items:[
        'ימי חופש אינם נשמרים יותר ב-localStorage.',
        'הנתונים נטענים ונשמרים מול Firebase כדי לשרוד רענון וכניסה מחדש.'
      ]}
    ].map(function(x,i){ return row(docId(x.version),Object.assign({active:true,order:(i+1)*10},x),'required-default-v4-94',i); });
  }
  async function firebaseRows(){
    try{
      var snap=await db.collection(COLLECTION).get();
      return snap.docs.map(function(d,i){ return row(d.id,d.data(),'firebase',i); });
    }catch(e){
      console.warn('v4.94 changelog read failed', e && e.message ? e.message : e);
      return null;
    }
  }
  async function seedMissingRows(existingRows){
    /*
      v4.94 CORE FIX:
      מוסיף ל-Firebase רק רשומות חסרות. לא מוחק, לא משנה ולא דורס גרסאות קיימות שהאדמין ערך.
      זה פותר מצב שבו Firebase נשאר תקוע עד v4.82 למרות שהקובץ כבר בגרסאות גבוהות יותר.
    */
    var existing=Array.isArray(existingRows)?existingRows:[];
    var existingMap={};
    existing.forEach(function(r){ existingMap[docId(r.version||r.id)] = true; });
    var missing=requiredChangelogRows().filter(function(r){ return !existingMap[docId(r.version||r.id)]; });
    if(!missing.length) return existing;
    var batch=db.batch();
    missing.forEach(function(r,i){
      batch.set(db.collection(COLLECTION).doc(docId(r.version)),{
        version:r.version,
        title:r.title,
        date:r.date,
        items:r.items||[],
        active:true,
        order:Number(r.order||((i+1)*10)),
        source:'firebase-missing-seed-v4-94',
        seedVersion:APP_VERSION,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:false});
    });
    await batch.commit();
    return await firebaseRows() || existing.concat(missing);
  }
  async function fetchChangelog(includeInactive){
    var fb=await firebaseRows();
    if(Array.isArray(fb)){
      try{ fb=await seedMissingRows(fb); }
      catch(e){
        /*
          v4.94 SAFE FALLBACK:
          לעובד רגיל אין תמיד הרשאת כתיבה ל-appChangelog. אם השלמת החסר נכשלה,
          עדיין ממזגים את ברירות המחדל לתצוגה כדי שהעובד לא יישאר תקוע על v4.82.
          בפעם הבאה שאדמין ייכנס, הרשומות החסרות יישמרו בפועל ב-Firebase.
        */
        console.warn('v4.94 changelog seed failed; using display fallback', e && e.message ? e.message : e);
        var map={};
        fb.forEach(function(r){ map[docId(r.version||r.id)] = r; });
        requiredChangelogRows().forEach(function(r){ if(!map[docId(r.version)]) fb.push(r); });
      }
      return sortRows(fb.filter(function(r){ return (includeInactive||r.active!==false) && !!(r.version||r.title||(r.items&&r.items.length)); }));
    }
    return sortRows(requiredChangelogRows().filter(function(r){ return includeInactive || r.active!==false; }));
  }
  window.fetchGlobalChangelogV476 = fetchChangelog;
  window.fetchGlobalChangelogV477 = fetchChangelog;
  window.fetchChangelogV475 = fetchChangelog;
  window.fetchCleanChangelogV494 = fetchChangelog;

  function ensureCss(){
    if(q('cleanChangelogCssV494')) return;
    var st=document.createElement('style');
    st.id='cleanChangelogCssV494';
    st.textContent='\
      .worker-bottom-links-v474{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:10px auto 2px;text-align:center}\
      a.whats-new-link-v474,a.whats-new-link-v475{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:transparent!important;color:#64748b!important;border:0!important;box-shadow:none!important;font-size:12px!important;font-weight:900!important;text-decoration:underline!important;padding:5px 8px!important;width:auto!important;min-height:0!important}\
      .whats-new-overlay-v474{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl}\
      .whats-new-card-v474{width:min(720px,96vw);max-height:86vh;display:flex;flex-direction:column;background:rgba(255,255,255,.98);border-radius:26px;box-shadow:0 24px 70px rgba(15,23,42,.28);border:1px solid rgba(255,255,255,.9);overflow:hidden}\
      .whats-new-head-v474{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#eff6ff,#fff)}\
      .whats-new-title-v474{font-weight:900;font-size:20px;color:#0f172a}.whats-new-close-v474{width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;border-radius:999px!important;background:#f1f5f9!important;color:#0f172a!important;box-shadow:none!important;border:1px solid #e2e8f0!important;font-size:24px!important}\
      .whats-new-body-v474{padding:14px;overflow-y:auto;overscroll-behavior:contain}.whats-new-version-v474,.admin-changelog-row-v475{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:13px;margin-bottom:8px;box-shadow:0 8px 18px rgba(15,23,42,.055)}\
      .whats-new-version-head-v474,.admin-changelog-row-head-v475{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.whats-new-version-title-v474,.admin-changelog-title-v475{font-weight:900;color:#0f172a}\
      .whats-new-ver-v474,.admin-changelog-version-v475{font-weight:900;color:#2563eb;white-space:nowrap}.whats-new-date-v474,.admin-changelog-meta-v475{color:#94a3b8;font-size:12px;font-weight:800;margin-top:3px}\
      .whats-new-list-v474,.admin-changelog-list-v475{margin:8px 0 0;padding:0 18px 0 0;color:#334155;line-height:1.5;font-size:13px}.whats-new-list-v474 li,.admin-changelog-list-v475 li{margin-bottom:3px}\
      .whats-new-footer-v474{padding:10px 14px;text-align:center;color:#94a3b8;font-size:12px;font-weight:900;border-top:1px solid #e2e8f0}.admin-changelog-panel-v475 .admin-changelog-form-v475{background:rgba(248,250,252,.72);border:1px solid #e2e8f0;border-radius:20px;padding:14px;margin:10px 0}.admin-changelog-scroll-v475{max-height:420px;overflow-y:auto;overflow-x:hidden;border:1px solid #e2e8f0;border-radius:20px;padding:8px;background:rgba(255,255,255,.72);scrollbar-width:thin;overscroll-behavior:contain}\
    ';
    document.head.appendChild(st);
  }
  function rowsHtml(rows,admin){
    return (rows||[]).map(function(r){
      var ctr=admin?'<div class="actions" style="margin-top:10px"><button class="btn-yellow" type="button" onclick="editChangelogVersionV475(\''+esc(r.id)+'\')">ערוך</button><button class="btn-red" type="button" onclick="deleteChangelogVersionV475(\''+esc(r.id)+'\')">מחק</button></div>':'';
      return '<div class="admin-changelog-row-v475"><div class="admin-changelog-row-head-v475"><div><div class="admin-changelog-title-v475">'+esc(r.title||'ללא כותרת')+'</div><div class="admin-changelog-meta-v475">'+esc(r.date||'')+'</div></div><div class="admin-changelog-version-v475">v'+esc(r.version||'')+'</div></div><ul class="admin-changelog-list-v475">'+(r.items||[]).map(function(i){return '<li>'+esc(i)+'</li>';}).join('')+'</ul>'+ctr+'</div>';
    }).join('');
  }
  function ensureAdminPanel(){
    ensureCss();
    var admin=q('adminView'); if(!admin) return;
    var panel=q('adminChangelogPanelV475');
    if(!panel){
      panel=document.createElement('div');
      panel.id='adminChangelogPanelV475';
      panel.className='card admin-changelog-panel-v475';
      var after=q('adminDataToolsPrimary')||admin.firstElementChild;
      if(after&&after.parentNode===admin) after.insertAdjacentElement('afterend',panel); else admin.insertBefore(panel,admin.firstChild);
    }
    panel.innerHTML='<div class="cal-head"><h2>📝 ניהול גרסאות / Changelog</h2><div class="actions"><button class="btn-light" type="button" onclick="loadAdminChangelogV475()">רענן</button></div></div><p>רשימה כללית אחת לכל העובדים. Firestore הוא מקור האמת, וגרסאות ברירת מחדל חסרות נוצרות רק אם הן לא קיימות.</p><div class="admin-changelog-form-v475"><input id="changelogEditIdV475" type="hidden"><div class="grid3"><input id="changelogVersionV475" placeholder="גרסה, למשל 4.94"><input id="changelogTitleV475" placeholder="כותרת קצרה לגרסה"><input id="changelogDateV475" placeholder="תאריך, למשל 07/05/2026"></div><textarea id="changelogItemsV475" placeholder="שורת שינוי אחת בכל שורה"></textarea><div class="actions"><button class="btn-green" type="button" onclick="saveChangelogVersionV475()">שמור / הוסף גרסה</button><button class="btn-light" type="button" onclick="resetChangelogFormV475()">נקה טופס</button></div><div id="changelogAdminMsgV475"></div></div><div class="admin-changelog-scroll-v475" id="adminChangelogListV475"><p class="muted">טוען גרסאות...</p></div>';
  }
  window.ensureAdminChangelogPanelV475=ensureAdminPanel;
  window.resetChangelogFormV475=function(){ ['changelogEditIdV475','changelogVersionV475','changelogTitleV475','changelogItemsV475'].forEach(function(id){var el=q(id); if(el) el.value='';}); var date=q('changelogDateV475'); if(date) date.value=todayHe(); var msg=q('changelogAdminMsgV475'); if(msg) msg.innerHTML=''; };
  window.loadAdminChangelogV475=async function(){ ensureAdminPanel(); var box=q('adminChangelogListV475'); if(!box) return; box.innerHTML='<p class="muted">טוען גרסאות...</p>'; var rows=await fetchChangelog(false); box.innerHTML=rows.length?rowsHtml(rows,true):'<p class="muted">אין גרסאות עדיין.</p>'; };
  window.editChangelogVersionV475=async function(id){ ensureAdminPanel(); var rows=await fetchChangelog(true); var r=rows.find(function(x){return x.id===id;})||rows.find(function(x){return docId(x.version)===id;}); if(!r) return alert('הגרסה לא נמצאה. לחץ רענן ונסה שוב.'); q('changelogEditIdV475').value=r.id||docId(r.version); q('changelogVersionV475').value=r.version||''; q('changelogTitleV475').value=r.title||''; q('changelogDateV475').value=r.date||todayHe(); q('changelogItemsV475').value=(r.items||[]).join('\n'); try{q('adminChangelogPanelV475').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){} };
  window.saveChangelogVersionV475=async function(){
    var msg=q('changelogAdminMsgV475');
    var editId=clean(q('changelogEditIdV475')&&q('changelogEditIdV475').value);
    var version=clean(q('changelogVersionV475')&&q('changelogVersionV475').value).replace(/^v/i,'');
    var title=clean(q('changelogTitleV475')&&q('changelogTitleV475').value);
    var date=clean(q('changelogDateV475')&&q('changelogDateV475').value)||todayHe();
    var items=splitItems(q('changelogItemsV475')&&q('changelogItemsV475').value);
    if(!version){ if(msg) msg.innerHTML='<p class="danger">חובה למלא מספר גרסה.</p>'; return; }
    if(!title){ if(msg) msg.innerHTML='<p class="danger">חובה למלא כותרת.</p>'; return; }
    if(!items.length){ if(msg) msg.innerHTML='<p class="danger">חובה למלא לפחות שורת שינוי אחת.</p>'; return; }
    try{
      var id=(editId&&editId.indexOf('v_')===0)?editId:docId(version);
      await db.collection(COLLECTION).doc(id).set({version:version,title:title,date:date,items:items,active:true,source:'admin-crud-v4-94',pageVersion:APP_VERSION,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      if(msg) msg.innerHTML='<div class="notice">הגרסה נשמרה לכל העובדים ✅</div>';
      window.resetChangelogFormV475(); await window.loadAdminChangelogV475();
    }catch(e){ if(msg) msg.innerHTML='<p class="danger">שגיאה בשמירה: '+esc(e.message||e)+'</p>'; }
  };
  window.deleteChangelogVersionV475=async function(id){ if(!confirm('למחוק את הגרסה מהחלון "מה חדש" לכל העובדים?')) return; try{ var rows=await fetchChangelog(true); var r=rows.find(function(x){return x.id===id;})||rows.find(function(x){return docId(x.version)===id;}); var did=(r&&r.version)?docId(r.version):id; await db.collection(COLLECTION).doc(did).set({version:r&&r.version?r.version:'',title:r&&r.title?r.title:'',date:r&&r.date?r.date:'',items:r&&r.items?r.items:[],active:false,source:'admin-deleted-v4-94',deletedAt:new Date().toISOString(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); await window.loadAdminChangelogV475(); }catch(e){ alert('שגיאה במחיקת גרסה: '+(e.message||e)); } };
  function whatsHtml(rows){return (rows||[]).map(function(v){return '<div class="whats-new-version-v474"><div class="whats-new-version-head-v474"><div><div class="whats-new-version-title-v474">'+esc(v.title)+'</div><div class="whats-new-date-v474">'+esc(v.date||'')+'</div></div><div class="whats-new-ver-v474">v'+esc(v.version)+'</div></div><ul class="whats-new-list-v474">'+(v.items||[]).map(function(i){return '<li>'+esc(i)+'</li>';}).join('')+'</ul></div>';}).join('');}
  window.openWhatsNewV474=async function(){ ensureCss(); var old=q('whatsNewOverlayV474'); if(old) old.remove(); var overlay=document.createElement('div'); overlay.id='whatsNewOverlayV474'; overlay.className='whats-new-overlay-v474'; overlay.innerHTML='<div class="whats-new-card-v474" role="dialog" aria-modal="true"><div class="whats-new-head-v474"><div class="whats-new-title-v474">✨ מה חדש באפליקציה</div><button class="whats-new-close-v474" type="button" id="whatsNewCloseV474">×</button></div><div class="whats-new-body-v474" id="whatsNewBodyV474"><p class="muted">טוען גרסאות...</p></div><div class="whats-new-footer-v474">מעודכן לגרסה '+esc(window.APP_VERSION||APP_VERSION||'')+'</div></div>'; try{document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';}catch(e){} document.body.appendChild(overlay); var body=overlay.querySelector('#whatsNewBodyV474'); function close(){try{overlay.remove();}catch(e){} try{document.documentElement.style.overflow='';document.body.style.overflow='';}catch(e){}} overlay.querySelector('#whatsNewCloseV474').onclick=close; overlay.addEventListener('click',function(ev){if(ev.target===overlay)close();}); try{body.innerHTML=whatsHtml(await fetchChangelog(false));}catch(e){body.innerHTML=whatsHtml(requiredChangelogRows());} };
  function ensureWorkerLink(){ ensureCss(); var worker=q('workerView'); if(!worker) return; var shell=q('workerBottomLinksV474'); if(!shell){ shell=document.createElement('div'); shell.id='workerBottomLinksV474'; shell.className='worker-bottom-links-v474'; worker.appendChild(shell); } var old=q('whatsNewLinkV474'); if(old&&old.tagName&&old.tagName.toLowerCase()!=='a'){try{old.remove();}catch(e){}} if(!q('whatsNewLinkV474')){ var link=document.createElement('a'); link.id='whatsNewLinkV474'; link.href='#'; link.className='whats-new-link-v474 whats-new-link-v475'; link.textContent='מה חדש'; link.onclick=function(ev){ev.preventDefault(); window.openWhatsNewV474();}; shell.appendChild(link); }else{ q('whatsNewLinkV474').onclick=function(ev){if(ev&&ev.preventDefault)ev.preventDefault(); window.openWhatsNewV474();}; } var bug=q('bugContactLinkV220'); if(bug&&bug.parentNode!==shell){try{shell.insertBefore(bug,q('whatsNewLinkV474'));}catch(e){}} }
  window.ensureWhatsNewLinkV474=ensureWorkerLink;
  window.ensureWorkerLinksV475=ensureWorkerLink;
  var oldAdmin=window.showAdmin;
  if(typeof oldAdmin==='function'&&!oldAdmin.__changelogWrappedV494){
    var adminWrap=async function(){ var res=await oldAdmin.apply(this,arguments); try{ ensureAdminPanel(); window.resetChangelogFormV475(); await window.loadAdminChangelogV475(); }catch(e){console.warn('v4.94 changelog admin',e&&e.message?e.message:e);} return res; };
    adminWrap.__changelogWrappedV494=true;
    window.showAdmin=adminWrap;
  }
  var oldWorker=window.showWorker;
  if(typeof oldWorker==='function'&&!oldWorker.__workerLinksWrappedV494){
    var workerWrap=async function(){ var res=await oldWorker.apply(this,arguments); try{ setTimeout(ensureWorkerLink,80); setTimeout(ensureWorkerLink,350); }catch(e){} return res; };
    workerWrap.__workerLinksWrappedV494=true;
    window.showWorker=workerWrap;
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(ensureWorkerLink,300); setTimeout(function(){ if(q('adminView')&&!q('adminView').classList.contains('hidden')){ ensureAdminPanel(); window.loadAdminChangelogV475(); } },700); });
  window.addEventListener('load',function(){ setTimeout(ensureWorkerLink,300); setTimeout(ensureWorkerLink,1200); setTimeout(function(){ if(q('adminView')&&!q('adminView').classList.contains('hidden')){ ensureAdminPanel(); window.loadAdminChangelogV475(); } },900); });
})();
;
(function(){
  try{ window.APP_VERSION = APP_VERSION; if(typeof setAppVersionUI==='function') setAppVersionUI(); if(typeof enforceAppVersionUI==='function') enforceAppVersionUI(); }catch(e){}

  function q(id){ return document.getElementById(id); }
  function htmlEsc(v){
    try{ if(typeof esc==='function') return esc(v); }catch(e){}
    return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});
  }
  function safeMoney(v){ try{ return money(v); }catch(e){ return '₪'+Number(v||0).toLocaleString('he-IL',{maximumFractionDigits:0}); } }
  function safeHeDate(v){ try{ return heDate(v); }catch(e){ return String(v||''); } }
  function normalizePekaV531(v){ v=String(v||'').trim().toUpperCase(); return (v==='CN'||v==='CH') ? v : ''; }
  function statusOfV531(e){ return String((e&&e.entryStatus)||(e&&e.status)||'done').toLowerCase(); }
  function isPlannedV531(e){ return !!(e && (statusOfV531(e)==='planned' || e.planned===true || e.isPlanned===true)); }
  function isNotDoneV531(e){ return statusOfV531(e)==='not_done'; }
  function isInstallSearchV531(){ var el=q('searchType'); return !!(el && el.value==='install'); }

  function refreshPekaSearchVisibilityV531(){
    try{
      var sel=q('searchPekaTypeV528');
      if(!sel) return;
      var row=sel.closest ? sel.closest('.peka-search-row-v528') : null;
      var shouldShow=isInstallSearchV531();
      if(row) row.classList.toggle('peka-hidden-v531', !shouldShow);
      if(!shouldShow && sel.value){ sel.value=''; }
    }catch(e){}
  }
  window.refreshPekaSearchVisibilityV531=refreshPekaSearchVisibilityV531;

  // v5.31: peka filter is meaningful only for installations. Service calls can never be CN/CH.
  window.selectedSearchPekaV528=function(){
    try{
      if(!isInstallSearchV531()) return '';
      var el=q('searchPekaTypeV528');
      return normalizePekaV531(el ? el.value : '');
    }catch(e){ return ''; }
  };
  window.filterEntriesByPekaSearchV528=function(entries){
    try{
      var p=window.selectedSearchPekaV528();
      if(!p) return entries;
      return (entries||[]).filter(function(e){ return e && e.workType==='install' && normalizePekaV531(e.pekaType)===p; });
    }catch(e){ return entries; }
  };

  function attachPekaSearchTypeV531(){
    try{
      var type=q('searchType');
      if(type && !type.dataset.v531PekaBound){
        type.dataset.v531PekaBound='1';
        type.addEventListener('change',function(){
          refreshPekaSearchVisibilityV531();
          try{ if(typeof renderFullSummary==='function') renderFullSummary(); }catch(e){}
        });
        type.addEventListener('input',refreshPekaSearchVisibilityV531);
      }
      if(typeof window.onWorkerSearchTypeChangeV22==='function' && !window.onWorkerSearchTypeChangeV22.__v531Wrapped){
        var old=window.onWorkerSearchTypeChangeV22;
        var wrapped=function(){
          var r=old.apply(this,arguments);
          try{ refreshPekaSearchVisibilityV531(); }catch(e){}
          return r;
        };
        wrapped.__v531Wrapped=true;
        window.onWorkerSearchTypeChangeV22=wrapped;
      }
      refreshPekaSearchVisibilityV531();
    }catch(e){}
  }

  function textWithBrV531(v){ return htmlEsc(v).replace(/\\n/g,'<br>').replace(/\n/g,'<br>'); }
  function pekaBadgeV531(e){
    var p=normalizePekaV531(e && e.pekaType);
    return p ? '<br><span class="peka-badge-v527 peka-badge-clean-v531">פק״ע: '+htmlEsc(p)+'</span>' : '';
  }
  function entryLabelV531(e){ return e && e.workType==='install' ? 'התקנה' : 'קריאת שירות'; }
  function detailsHtmlV531(e){
    if(!e) return '';
    var html='מספר לקוח: '+htmlEsc(e.customerNumber||'')+'<br>כתובת: '+htmlEsc(e.address||'')+'<br>';
    if(e.workType==='install'){
      var itemHtml=(e.items||[]).map(function(i){
        return htmlEsc(i.name||'')+' × '+htmlEsc(i.quantity||0)+' = '+safeMoney(i.total||0);
      }).join('<br>');
      if(itemHtml) html+=itemHtml;
      html+=pekaBadgeV531(e)+'<br>';
    }else{
      html+=htmlEsc(e.isReturnCall?'קריאה חוזרת ללא תשלום':'קריאת שירות')+'<br>';
    }
    if(isNotDoneV531(e)){
      html+='לא בוצע — סיבה: '+htmlEsc(e.notDoneReason||'')+'<br>';
      if(e.notDoneNote) html+='פירוט: '+textWithBrV531(e.notDoneNote)+'<br>';
    }
    if(e.notes) html+=textWithBrV531(e.notes);
    return html;
  }

  function renderDayV531(){
    if(typeof selectedDate==='undefined' || !selectedDate){
      try{ hide('dayPanel'); show('selectDayHint'); }catch(e){}
      return;
    }
    try{ show('dayPanel'); hide('selectDayHint'); }catch(e){}
    try{ text('dateTitle','יום '+safeHeDate(selectedDate)); }catch(e){ var dt=q('dateTitle'); if(dt) dt.textContent='יום '+safeHeDate(selectedDate); }
    try{ if(typeof renderInstallItems==='function') renderInstallItems(); }catch(e){}
    try{ if(typeof setType==='function') setType(selectedType,false); }catch(e){}
    try{ if(typeof updateServicePriceLabels==='function') updateServicePriceLabels(); }catch(e){}

    var box=q('dayEntries');
    if(!box) return;
    var entries=[];
    try{
      entries=((typeof monthEntries!=='undefined' && Array.isArray(monthEntries))?monthEntries:[])
        .filter(function(e){return e && e.date===selectedDate;})
        .sort(function(a,b){return ((b.createdAt&&b.createdAt.seconds)||0)-((a.createdAt&&a.createdAt.seconds)||0);});
    }catch(e){ entries=[]; }
    box.innerHTML=entries.length ? '' : '<p class="muted">אין עבודות ביום הזה עדיין.</p>';
    entries.forEach(function(e){
      var planned=isPlannedV531(e), notDone=isNotDoneV531(e);
      var row=document.createElement('div');
      row.className='item'+(planned?' planned-card-v49':'')+(notDone?' not-done-card-v529':'');
      var iconClass=e.workType==='install'?'install':(e.isReturnCall?'return':'service');
      var icon=notDone?'🚫':(planned?'📋':(e.workType==='install'?'🛠️':(e.isReturnCall?'🔁':'☎️')));
      var badge=notDone?'<span class="not-done-badge-v529">לא בוצע</span>':(planned?'<span class="planned-badge-v49">מתוכנן</span>':'<span class="done-badge-v49">בוצע</span>');
      var actions='';
      if(planned){ actions+='<button class="btn-green" onclick="markEntryDoneV49(\''+htmlEsc(e.id)+'\')">בוצע</button><button class="btn-red" onclick="openNotDoneModalV529(\''+htmlEsc(e.id)+'\')">לא בוצע</button>'; }
      if(notDone){ actions+='<button class="btn-yellow" onclick="restorePlannedV529(\''+htmlEsc(e.id)+'\')">החזר למתוזמן</button>'; }
      actions+='<button class="btn-yellow" onclick="openEntryEdit(\''+htmlEsc(e.id)+'\')">ערוך</button>';
      if(!planned && !notDone && e.workType==='install') actions+='<button class="btn-light" onclick="saveEntryAsTemplate(\''+htmlEsc(e.id)+'\')">שמור כתבנית</button>';
      actions+='<button class="btn-red" onclick="deleteEntry(\''+htmlEsc(e.id)+'\')">מחק</button>';
      var amountHtml=notDone ? '₪0' : safeMoney(e.amount||0);
      row.innerHTML='<div class="work-row-main"><div class="work-icon '+htmlEsc(iconClass)+'">'+icon+'</div><div><div class="item-title">'+htmlEsc(e.description||entryLabelV531(e))+' '+badge+'</div><div class="item-sub">'+detailsHtmlV531(e)+'</div></div></div><div><div class="money '+(planned?'planned-money-v49 ':'')+(notDone?'not-done-money-v529':'')+'">'+amountHtml+'</div><div class="actions" style="margin-top:8px">'+actions+'</div></div>';
      box.appendChild(row);
    });
    try{ if(typeof cleanVisibleSlashN==='function') cleanVisibleSlashN(); }catch(e){}
  }
  window.renderDay=renderDayV531;

  function bootV531(){
    try{ if(typeof ensurePekaSearchFilterV528==='function') ensurePekaSearchFilterV528(); }catch(e){}
    attachPekaSearchTypeV531();
    try{ if(typeof selectedDate!=='undefined' && selectedDate) renderDayV531(); }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV531,500); setTimeout(bootV531,1600); });
  window.addEventListener('load',function(){ setTimeout(bootV531,500); setTimeout(bootV531,1800); });
  setInterval(function(){ try{ attachPekaSearchTypeV531(); }catch(e){} },2000);
})();
;
(function(){
  'use strict';
  var APP_VERSION_V532 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));

  function q(id){ return document.getElementById(id); }
  function normNameV532(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function escHtmlV532(v){
    try{ if(typeof esc==='function') return esc(v); }catch(e){}
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }

  function updateVersionUiV532(){
    try{ window.APP_VERSION=APP_VERSION_V532; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V532; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V532; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V532; }); }catch(e){}
  }
  window.updateVersionUiV532=updateVersionUiV532;

  function fixPekaLabelsV532(root){
    try{
      var scope=root || document;
      var walker=document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
      var nodes=[];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function(n){
        if(!n || !n.nodeValue) return;
        if(n.parentNode && ['SCRIPT','STYLE','TEXTAREA'].indexOf(String(n.parentNode.tagName||'').toUpperCase())!==-1) return;
        n.nodeValue=n.nodeValue
          .replace(/סוג פקה/g,'סוג פק״ע')
          .replace(/סינון לפי פקה/g,'סינון לפי פק״ע')
          .replace(/פקה:/g,'פק״ע:')
          .replace(/פקות CN/g,'פק״עות CN')
          .replace(/פקות CH/g,'פק״עות CH')
          .replace(/\bפקה\b/g,'פק״ע');
      });
      try{
        document.querySelectorAll('[title]').forEach(function(el){
          el.title=String(el.title||'').replace(/סוג פקה/g,'סוג פק״ע').replace(/פקה/g,'פק״ע');
        });
      }catch(e){}
    }catch(e){ console.warn('fixPekaLabelsV532 failed',e); }
  }
  window.fixPekaLabelsV532=fixPekaLabelsV532;

  function findTemplateInputForItemV532(templateItem){
    if(!templateItem) return null;
    var directId=templateItem.id ? q('qty_'+templateItem.id) : null;
    if(directId) return {el:directId, priceItem:(Array.isArray(priceList)?priceList:[]).find(function(p){return p.id===templateItem.id;}) || templateItem, matchedBy:'id'};

    var wanted=normNameV532(templateItem.name);
    if(!wanted) return null;
    var list=Array.isArray(priceList)?priceList:[];
    var found=list.find(function(p){ return normNameV532(p.name)===wanted; });
    if(!found){
      var wantedLoose=wanted.replace(/[״"'׳]/g,'').toLowerCase();
      found=list.find(function(p){ return normNameV532(p.name).replace(/[״"'׳]/g,'').toLowerCase()===wantedLoose; });
    }
    if(!found) return null;
    var fallbackEl=q('qty_'+found.id);
    return fallbackEl ? {el:fallbackEl, priceItem:found, matchedBy:'name'} : null;
  }

  function clearInstallSelectionKeepTemplateV532(){
    try{
      (Array.isArray(priceList)?priceList:[]).forEach(function(p){
        var el=q('qty_'+p.id);
        if(!el) return;
        if(String(p.inputMode||'qty')==='check') el.checked=false;
        else el.value='';
      });
    }catch(e){}
  }

  window.applyTemplateFromSelect=function(){
    var select=q('installTemplateSelect');
    var id=select ? select.value : '';
    if(!id) return;
    var tpl=(Array.isArray(templates)?templates:[]).find(function(t){ return t.id===id; });
    if(!tpl) return;

    clearInstallSelectionKeepTemplateV532();

    var applied=0, missing=[];
    (tpl.items||[]).forEach(function(item){
      var match=findTemplateInputForItemV532(item);
      if(!match || !match.el){ missing.push(item && item.name ? item.name : 'פריט ללא שם'); return; }
      var mode=String((match.priceItem && match.priceItem.inputMode) || item.inputMode || 'qty');
      var qty=Number(item.quantity || 0);
      if(mode==='check') match.el.checked=qty>0;
      else match.el.value=qty>0 ? qty : '';
      if(qty>0) applied++;
    });

    try{ if(typeof updateInstallPreview==='function') updateInstallPreview(); }catch(e){}
    try{ fixPekaLabelsV532(document); }catch(e){}

    var msg=q('entryMsg');
    if(msg){
      if(applied){
        msg.innerHTML='<div class="notice">התבנית נטענה ✅'+(missing.length?'<br><span class="muted">דולגו פריטים שכבר לא קיימים במחירון: '+escHtmlV532(missing.join(', '))+'</span>':'')+'</div>';
      }else{
        msg.innerHTML='<p class="danger">התבנית לא סימנה פריטים. כנראה שכל הפריטים שבתבנית כבר לא קיימים במחירון הפעיל.</p>';
      }
    }
  };

  function bootV532(){
    updateVersionUiV532();
    fixPekaLabelsV532(document);
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV532,300); setTimeout(bootV532,1400); });
  window.addEventListener('load',function(){ setTimeout(bootV532,300); setTimeout(bootV532,1600); });
  setInterval(function(){ try{ fixPekaLabelsV532(document); updateVersionUiV532(); }catch(e){} },2500);
})();
;
(function(){
  'use strict';
  var APP_VERSION_V533 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));

  function byId(id){ return document.getElementById(id); }
  function html(v){
    try{ if(typeof esc==='function') return esc(v); }catch(e){}
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function nl(v){ return String(v==null?'':v).replace(/\\n/g,'\n').split('\n').map(html).join('<br>'); }
  function moneySafe(v){ try{ if(typeof money==='function') return money(Number(v||0)); }catch(e){} return '₪'+Number(v||0).toLocaleString('he-IL'); }
  function heDateSafe(v){ try{ if(typeof heDate==='function') return heDate(v); }catch(e){} return String(v||''); }
  function jsArg(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
  function status(e){ return String((e && (e.entryStatus || e.status)) || 'done'); }
  function isPlanned(e){
    try{ if(typeof window.isPlannedV49==='function') return !!window.isPlannedV49(e); }catch(err){}
    return !!(e && (status(e)==='planned' || e.planned===true || e.isPlanned===true));
  }
  function isNotDone(e){ return !!(e && status(e)==='not_done'); }
  function normalizePeka(v){ var s=String(v||'').trim().toUpperCase(); return (s==='CN'||s==='CH') ? s : ''; }
  function pekaBadge(e){ var p=normalizePeka(e && e.pekaType); return p ? '<br><span class="peka-badge-v527 peka-badge-clean-v531">פק״ע: '+html(p)+'</span>' : ''; }
  function label(e){ return e && e.workType==='install' ? 'התקנה' : 'קריאת שירות'; }
  function details(e){
    if(!e) return '';
    var out='מספר לקוח: '+html(e.customerNumber||'')+'<br>כתובת: '+html(e.address||'')+'<br>';
    if(e.workType==='install'){
      var items=(Array.isArray(e.items)?e.items:[]).map(function(i){return html(i.name||'')+' × '+html(i.quantity||0)+' = '+moneySafe(i.total||0);}).join('<br>');
      if(items) out+=items;
      out+=pekaBadge(e)+'<br>';
    }else{
      out+=html(e.isReturnCall?'קריאה חוזרת ללא תשלום':'קריאת שירות')+'<br>';
    }
    if(isNotDone(e)){
      out+='לא בוצע — סיבה: '+html(e.notDoneReason||'')+'<br>';
      if(e.notDoneNote) out+='פירוט: '+nl(e.notDoneNote)+'<br>';
    }
    if(e.notes) out+=nl(e.notes);
    return out;
  }

  function renderEntryCard(e){
    var planned=isPlanned(e), notDone=isNotDone(e);
    var row=document.createElement('div');
    row.className='item'+(planned?' planned-card-v49':'')+(notDone?' not-done-card-v529':'');
    // v5.84: מזהה הרשומה נשמר על כרטיס היום כדי לאפשר ניווט והדגשה מדויקים מהדשבורד החכם.
    row.dataset.entryId=String(e.id||'');
    var iconClass=e.workType==='install'?'install':(e.isReturnCall?'return':'service');
    var icon=notDone?'🚫':(planned?'📋':(e.workType==='install'?'🛠️':(e.isReturnCall?'🔁':'☎️')));
    var badge=notDone?'<span class="not-done-badge-v529">לא בוצע</span>':(planned?'<span class="planned-badge-v49">מתוכנן</span>':'<span class="done-badge-v49">בוצע</span>');
    var actions='';
    if(planned){
      actions+='<button class="btn-green" onclick="markEntryDoneV49(\''+jsArg(e.id)+'\')">בוצע</button>';
      actions+='<button class="btn-red" onclick="openNotDoneModalV529(\''+jsArg(e.id)+'\')">לא בוצע</button>';
    }
    if(notDone){ actions+='<button class="btn-yellow" onclick="restorePlannedV529(\''+jsArg(e.id)+'\')">החזר למתוזמן</button>'; }
    actions+='<button class="btn-yellow" onclick="openEntryEdit(\''+jsArg(e.id)+'\')">ערוך</button>';
    if(!planned && !notDone && e.workType==='install') actions+='<button class="btn-light" onclick="saveEntryAsTemplate(\''+jsArg(e.id)+'\')">שמור כתבנית</button>';
    actions+='<button class="btn-red" onclick="deleteEntry(\''+jsArg(e.id)+'\')">מחק</button>';
    var amountHtml=notDone ? '₪0' : moneySafe(e.amount||0);
    row.innerHTML='<div class="work-row-main"><div class="work-icon '+html(iconClass)+'">'+icon+'</div><div><div class="item-title">'+html(e.description||label(e))+' '+badge+'</div><div class="item-sub">'+details(e)+'</div></div></div><div><div class="money '+(planned?'planned-money-v49 ':'')+(notDone?'not-done-money-v529':'')+'">'+amountHtml+'</div><div class="actions" style="margin-top:8px">'+actions+'</div></div>';
    return row;
  }

  function addSection(box,title,icon,list,emptyText){
    var section=document.createElement('div');
    section.className='day-section-v533';
    section.innerHTML='<div class="day-section-title-v533">'+icon+' '+html(title)+' <span class="day-section-count-v533">'+list.length+'</span></div>';
    if(list.length){ list.forEach(function(e){ section.appendChild(renderEntryCard(e)); }); }
    else if(emptyText){ section.innerHTML+='<div class="day-empty-v533">'+html(emptyText)+'</div>'; }
    box.appendChild(section);
  }

  function renderDayV533(){
    if(typeof selectedDate==='undefined' || !selectedDate){
      try{ hide('dayPanel'); show('selectDayHint'); }catch(e){}
      return;
    }
    try{ show('dayPanel'); hide('selectDayHint'); }catch(e){}
    try{ text('dateTitle','יום '+heDateSafe(selectedDate)); }catch(e){ var dt=byId('dateTitle'); if(dt) dt.textContent='יום '+heDateSafe(selectedDate); }
    try{ if(typeof renderInstallItems==='function') renderInstallItems(); }catch(e){}
    try{ if(typeof setType==='function') setType(selectedType,false); }catch(e){}
    try{ if(typeof updateServicePriceLabels==='function') updateServicePriceLabels(); }catch(e){}
    try{ if(typeof movePekaUnderTemplatesV529==='function') movePekaUnderTemplatesV529(); }catch(e){}

    var box=byId('dayEntries'); if(!box) return;
    var all=[];
    try{
      all=((typeof monthEntries!=='undefined' && Array.isArray(monthEntries))?monthEntries:[])
        .filter(function(e){return e && e.date===selectedDate;})
        .sort(function(a,b){return ((b.createdAt&&b.createdAt.seconds)||0)-((a.createdAt&&a.createdAt.seconds)||0);});
    }catch(e){ all=[]; }
    var done=all.filter(function(e){return !isPlanned(e) && !isNotDone(e);});
    var planned=all.filter(isPlanned);
    var notDone=all.filter(isNotDone);

    box.innerHTML='';
    if(!all.length){ box.innerHTML='<p class="muted">אין עבודות ביום הזה עדיין.</p>'; return; }
    if(done.length) addSection(box,'עבודות שבוצעו ביום הזה','✅',done,'');
    if(planned.length) addSection(box,'מתוזמנות ליום הזה','📋',planned,'');
    if(notDone.length) addSection(box,'לא בוצעו ביום הזה','🚫',notDone,'');
    try{ if(typeof cleanVisibleSlashN==='function') cleanVisibleSlashN(); }catch(e){}
  }
  window.renderDay=renderDayV533;

  function updateVersionUiV533(){
    try{ window.APP_VERSION=APP_VERSION_V533; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V533; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V533; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V533; }); }catch(e){}
  }

  function bootV533(){
    updateVersionUiV533();
    try{ if(typeof selectedDate!=='undefined' && selectedDate) renderDayV533(); }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV533,400); setTimeout(bootV533,1700); });
  window.addEventListener('load',function(){ setTimeout(bootV533,500); setTimeout(bootV533,1900); });
  setInterval(function(){ try{ updateVersionUiV533(); }catch(e){} },2500);
})();
;
(function(){
  'use strict';
  var APP_VERSION_V534 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));

  function q(id){ return document.getElementById(id); }
  function heDateSafeV534(v){ try{ if(typeof heDate==='function') return heDate(v); }catch(e){} return String(v||''); }
  function isVacationV534(date){
    try{ if(typeof window.isVacationDayV437==='function') return !!window.isVacationDayV437(date); }catch(e){}
    try{ if(Array.isArray(window.vacationDaysV437)) return window.vacationDaysV437.indexOf(date)>=0; }catch(e){}
    return false;
  }
  function updateVersionUiV534(){
    try{ window.APP_VERSION=APP_VERSION_V534; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V534; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V534; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V534; }); }catch(e){}
  }
  function showVacationStateV534(){
    try{ show('dayPanel'); hide('selectDayHint'); }catch(e){}
    try{ text('dateTitle','יום '+heDateSafeV534(selectedDate)+' — יום חופש'); }catch(e){ var title=q('dateTitle'); if(title) title.textContent='יום '+heDateSafeV534(selectedDate)+' — יום חופש'; }
    var form=q('entryForm'); if(form) form.classList.add('hidden');
    var edit=q('editEntryPanel'); if(edit) edit.classList.add('hidden');
    var holder=q('dayOffToolsV437'); if(holder) holder.remove();
    var box=q('dayEntries');
    if(box){
      box.innerHTML='<div class="day-off-panel-v437">🏖️ היום הזה מסומן כיום חופש ולכן הוא לא נספר כיום עבודה בדשבורד החכם.<br>אין אפשרות להוסיף עבודה ביום הזה עד שמבטלים את יום החופש.</div><div class="actions"><button class="btn-yellow" type="button" onclick="cancelVacationDayV437(\''+String(selectedDate).replace(/'/g,"\\'")+'\')">בטל יום חופש</button></div>';
    }
  }
  function injectVacationButtonV534(){
    if(typeof selectedDate==='undefined' || !selectedDate) return;
    if(isVacationV534(selectedDate)) return;
    var form=q('entryForm'); if(form) form.classList.remove('hidden');
    var holder=q('dayOffToolsV437');
    if(!holder){
      holder=document.createElement('div');
      holder.id='dayOffToolsV437';
      holder.className='day-off-tools-v437';
      var title=q('dateTitle');
      if(title && title.parentNode) title.parentNode.insertBefore(holder,title.nextSibling);
    }
    if(holder){
      holder.innerHTML='<button class="btn-light" type="button" onclick="setVacationDayV437(\''+String(selectedDate).replace(/'/g,"\\'")+'\')">🏖️ סמן כיום חופש</button>';
    }
  }

  var baseRenderDayV534=window.renderDay;
  window.renderDay=function(){
    if(typeof selectedDate==='undefined' || !selectedDate){
      try{ if(typeof baseRenderDayV534==='function') return baseRenderDayV534.apply(this,arguments); }catch(e){}
      try{ hide('dayPanel'); show('selectDayHint'); }catch(e){}
      return;
    }
    if(isVacationV534(selectedDate)){
      showVacationStateV534();
      return;
    }
    var res;
    try{ if(typeof baseRenderDayV534==='function') res=baseRenderDayV534.apply(this,arguments); }catch(e){ console.warn('v5.34 base renderDay failed', e); }
    injectVacationButtonV534();
    try{ if(typeof cleanVisibleSlashN==='function') cleanVisibleSlashN(); }catch(e){}
    return res;
  };

  function bootV534(){
    updateVersionUiV534();
    try{ if(typeof selectedDate!=='undefined' && selectedDate) window.renderDay(); }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV534,350); setTimeout(bootV534,1500); });
  window.addEventListener('load',function(){ setTimeout(bootV534,450); setTimeout(bootV534,1800); });
  setInterval(function(){ try{ updateVersionUiV534(); }catch(e){} },2500);
})();
;
(function(){
  'use strict';
  var APP_VERSION_V539 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.41'));
  if(window.__notDoneRescheduleV539Applied) return;
  window.__notDoneRescheduleV539Applied=true;

  function q(id){return document.getElementById(id);}
  function safeEsc(v){try{if(typeof esc==='function')return esc(v);}catch(e){}return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function safeHeDate(v){try{if(typeof heDate==='function')return heDate(v);}catch(e){}return String(v||'');}
  function parseIsoV539(v){var p=String(v||'').split('-').map(Number);if(p.length!==3||!p[0]||!p[1]||!p[2])return null;return new Date(p[0],p[1]-1,p[2]);}
  function isSaturdayV539(dateStr){var d=parseIsoV539(dateStr);return !!(d&&d.getDay()===6);}
  function currentWorkerIdV539(){try{if(typeof viewedWorker!=='undefined'&&viewedWorker&&viewedWorker.id)return viewedWorker.id;}catch(e){}try{if(typeof session!=='undefined'&&session&&session.workerId)return session.workerId;}catch(e){}return '';}
  function currentWorkerNameV539(){try{if(typeof viewedWorker!=='undefined'&&viewedWorker&&viewedWorker.name)return viewedWorker.name;}catch(e){}try{if(typeof session!=='undefined'&&session&&session.name)return session.name;}catch(e){}return '';}
  function findEntryV539(id){try{return (Array.isArray(monthEntries)?monthEntries:[]).find(function(e){return e&&String(e.id)===String(id);});}catch(e){return null;}}
  function updateVersionUiV539(){
    try{window.APP_VERSION=APP_VERSION_V539;}catch(e){}
    try{document.title='מעקב עבודה - גרסה '+APP_VERSION_V539;}catch(e){}
    try{document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){el.textContent=APP_VERSION_V539;});}catch(e){}
    try{document.querySelectorAll('.secret,#secretTap').forEach(function(el){el.textContent='גרסה '+APP_VERSION_V539;});}catch(e){}
  }

  async function isVacationDateV539(dateStr){
    try{if(typeof window.isVacationDayV437==='function'&&window.isVacationDayV437(dateStr))return true;}catch(e){}
    try{if(Array.isArray(window.vacationDaysV437)&&window.vacationDaysV437.indexOf(dateStr)>=0)return true;}catch(e){}
    var workerId=currentWorkerIdV539();
    if(!workerId||typeof db==='undefined'||!db||!db.collection)return false;
    try{
      var snap=await db.collection('workerDaysOff').where('workerId','==',workerId).get();
      var found=false;
      snap.docs.forEach(function(doc){var d=doc.data()||{};if(d.active!==false&&String(d.date||'')===String(dateStr))found=true;});
      return found;
    }catch(e){
      console.warn('v5.39 vacation validation failed',e&&(e.code||e.message)?(e.code||e.message):e);
      return false;
    }
  }
  async function validateTargetDateV539(dateStr,msg){
    if(!dateStr||!parseIsoV539(dateStr)){if(msg)msg.innerHTML='<p class="danger">צריך לבחור תאריך חדש תקין.</p>';return false;}
    if(isSaturdayV539(dateStr)){if(msg)msg.innerHTML='<p class="danger">אי אפשר לקבוע פק״ע מתוזמנת לשבת. לא נוצר מועד חדש.</p>';return false;}
    if(await isVacationDateV539(dateStr)){if(msg)msg.innerHTML='<p class="danger">אי אפשר לקבוע פק״ע מתוזמנת ליום חופש מסומן. בטל קודם את יום החופש או בחר תאריך אחר.</p>';return false;}
    return true;
  }

  function clonePlannedEntryV539(entry,newDate,reason,note){
    var originalAmount=Number(entry&& (entry.originalAmount||entry.amount) ||0);
    if(!originalAmount && entry&&Array.isArray(entry.items)) originalAmount=entry.items.reduce(function(s,i){return s+Number(i.total||0);},0);
    if(!originalAmount && entry&&entry.workType==='service'&&!entry.isReturnCall){try{originalAmount=Number(SERVICE_PRICE||0);}catch(e){}}
    var originalDateLabel='';
    try{ originalDateLabel=safeHeDate((entry&&entry.date)||''); }catch(e){ originalDateLabel=(entry&&entry.date)||''; }
    var clonedFromLine='שוכפלה מתאריך '+originalDateLabel;
    var clonedNotes=String((entry&&entry.notes)||'').trim();
    clonedNotes=clonedNotes ? (clonedNotes+'\n'+clonedFromLine) : clonedFromLine;
    var out={
      workerId:(entry&&entry.workerId)||currentWorkerIdV539(),
      workerName:(entry&&entry.workerName)||currentWorkerNameV539(),
      authUid:(entry&&entry.authUid)||'',
      date:newDate,
      workType:(entry&&entry.workType)||'install',
      description:(entry&&entry.description)||((entry&&entry.workType)==='service'?'קריאת שירות':'התקנה'),
      customerNumber:(entry&&entry.customerNumber)||'',
      address:(entry&&entry.address)||'',
      notes:clonedNotes,
      isReturnCall:!!(entry&&entry.isReturnCall),
      pekaType:(entry&&entry.pekaType)||'',
      entryStatus:'planned',
      status:'planned',
      planned:true,
      amount:originalAmount,
      originalAmount:originalAmount,
      rescheduledFrom:(entry&&entry.id)||'',
      rescheduledFromDate:(entry&&entry.date)||'',
      rescheduledReason:reason||'',
      rescheduledNote:String(note||'').trim(),
      rescheduledAt:new Date().toISOString(),
      rescheduledBy:currentWorkerNameV539(),
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    if(entry&&Array.isArray(entry.items)) out.items=JSON.parse(JSON.stringify(entry.items));
    Object.keys(out).forEach(function(k){if(out[k]==='' && k==='pekaType') delete out[k];});
    return out;
  }

  function openNotDoneModalV539(entryId){
    try{var old=q('notDoneOverlayV529');if(old)old.remove();}catch(e){}
    var reasons=(window.NOT_DONE_REASONS_V529||['לקוח לא בבית','לקוח לא עונה','לקוח ביטל','ביקש מועד אחר','אין תשתית','השחלה תקועה','אין גישה','אחר']);
    var overlay=document.createElement('div');
    overlay.id='notDoneOverlayV529';
    overlay.className='not-done-overlay-v529';
    overlay.innerHTML='<div class="not-done-modal-v529" role="dialog" aria-modal="true">'+
      '<h3>סימון עבודה כלא בוצעה</h3>'+
      '<p class="muted">בחר סיבה. העבודה המקורית לא תימחק ותישמר בדוחות כלא בוצעה.</p>'+
      '<select id="notDoneReasonSelectV529">'+reasons.map(function(r){return '<option value="'+safeEsc(r)+'">'+safeEsc(r)+'</option>';}).join('')+'</select>'+
      '<textarea id="notDoneNoteV529" class="not-done-other-v529 hidden" placeholder="כתוב סיבה חופשית"></textarea>'+
      '<div class="not-done-reschedule-v539">'+
        '<label><input id="notDoneRescheduleCheckV539" type="checkbox"> קבע מועד חדש ושכפל כמתוזמן</label>'+
        '<div id="notDoneRescheduleDateWrapV539" class="not-done-reschedule-date-v539 hidden">'+
          '<input id="notDoneRescheduleDateV539" type="date">'+
          '<div class="not-done-reschedule-help-v539">המקור יישאר לא בוצע בתאריך המקורי, ותיווצר פק״ע מתוזמנת חדשה לתאריך שבחרת.</div>'+
        '</div>'+
      '</div>'+
      '<div class="actions" style="margin-top:12px"><button class="btn-red" type="button" id="confirmNotDoneV529">שמור כלא בוצע</button><button class="btn-light" type="button" id="cancelNotDoneV529">ביטול</button></div>'+
      '<div id="notDoneMsgV529"></div>'+
      '</div>';
    document.body.appendChild(overlay);
    var select=q('notDoneReasonSelectV529'), note=q('notDoneNoteV529'), check=q('notDoneRescheduleCheckV539'), wrap=q('notDoneRescheduleDateWrapV539'), date=q('notDoneRescheduleDateV539');
    function refresh(){
      if(note) note.classList.toggle('hidden', !(select&&select.value==='אחר'));
      if(wrap) wrap.classList.toggle('hidden', !(check&&check.checked));
      if(check&&select&&select.value==='ביקש מועד אחר') check.checked=true;
      if(wrap) wrap.classList.toggle('hidden', !(check&&check.checked));
    }
    if(select) select.onchange=refresh;
    if(check) check.onchange=refresh;
    try{if(date){var e=findEntryV539(entryId);date.value=(e&&e.date)||'';}}catch(e){}
    refresh();
    q('cancelNotDoneV529').onclick=function(){overlay.remove();};
    overlay.addEventListener('click',function(ev){if(ev.target===overlay)overlay.remove();});
    q('confirmNotDoneV529').onclick=function(){saveNotDoneV539(entryId);};
  }
  window.openNotDoneModalV529=openNotDoneModalV539;

  async function saveNotDoneV539(entryId){
    var reason=(q('notDoneReasonSelectV529')||{}).value||'';
    var note=(q('notDoneNoteV529')||{}).value||'';
    var msg=q('notDoneMsgV529');
    var shouldReschedule=!!(q('notDoneRescheduleCheckV539')&&q('notDoneRescheduleCheckV539').checked);
    var newDate=(q('notDoneRescheduleDateV539')||{}).value||'';
    if(!reason){if(msg)msg.innerHTML='<p class="danger">חובה לבחור סיבה.</p>';return;}
    if(reason==='אחר'&&!String(note).trim()){if(msg)msg.innerHTML='<p class="danger">בחרת אחר — חובה לרשום סיבה.</p>';return;}
    if(shouldReschedule&&!(await validateTargetDateV539(newDate,msg))) return;
    var entry=findEntryV539(entryId)||{};
    var originalDate=entry.date||'';
    if(shouldReschedule&&newDate===originalDate){if(msg)msg.innerHTML='<p class="danger">בחרת את אותו תאריך. כדי לשכפל למועד חדש צריך לבחור תאריך אחר.</p>';return;}
    try{
      if(msg)msg.innerHTML='<div class="notice">שומר לא בוצע...</div>';
      var finalNote=String(note||'').trim();
      var newDocRef=null;
      if(shouldReschedule){
        var newEntry=clonePlannedEntryV539(entry,newDate,reason,note);
        newDocRef=await db.collection('workEntries').add(newEntry);
        var transferLine='לא בוצע - נוצרה פק״ע מתוזמנת חדשה לתאריך '+safeHeDate(newDate);
        finalNote=finalNote ? (finalNote+'\n'+transferLine) : transferLine;
      }
      await db.collection('workEntries').doc(entryId).set({
        entryStatus:'not_done',
        status:'not_done',
        planned:false,
        notDoneReason:reason,
        notDoneNote:finalNote,
        notDoneAt:firebase.firestore.FieldValue.serverTimestamp(),
        notDoneByWorkerId:currentWorkerIdV539(),
        notDoneByName:currentWorkerNameV539(),
        originalEntryStatus:entry.entryStatus||'planned',
        originalAmount:Number(entry.originalAmount||entry.amount||0),
        rescheduledToDate:shouldReschedule?newDate:'',
        rescheduledToEntryId:(newDocRef&&newDocRef.id)||'',
        rescheduledToCreatedAt:shouldReschedule?firebase.firestore.FieldValue.serverTimestamp():null,
        amount:0,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      var overlay=q('notDoneOverlayV529');if(overlay)overlay.remove();
      if(q('entryMsg')) q('entryMsg').innerHTML= shouldReschedule ? '<div class="notice">המקור סומן כלא בוצע ונוצרה פק״ע מתוזמנת חדשה ✅</div>' : '<div class="notice">העבודה סומנה כלא בוצעה ונשמרה בדוחות ✅</div>';
      if(shouldReschedule){
        var d=parseIsoV539(newDate); if(d){try{calendarDate=new Date(d.getFullYear(),d.getMonth(),1);}catch(e){}}
        try{selectedDate=originalDate||selectedDate; selectedType=null;}catch(e){}
      }
      if(typeof loadMonth==='function') await loadMonth();
    }catch(e){
      if(msg) msg.innerHTML='<p class="danger">שגיאה בשמירה: '+safeEsc(e&&(e.message||e.code)?(e.message||e.code):e)+'</p>';
    }
  }
  window.saveNotDoneV529=saveNotDoneV539;
  window.saveNotDoneV539=saveNotDoneV539;

  try{
    var oldRequired=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRequired==='function'&&!oldRequired.__v539Wrapped){
      var wrapped=function(){
        var rows=[];try{rows=oldRequired.apply(this,arguments)||[];}catch(e){rows=[];}
        var exists=rows.some(function(r){return String(r.version||r.id||'')==='5.39';});
        if(!exists){rows.unshift({version:'5.39',title:'לא בוצע עם שכפול אופציונלי למועד חדש',createdAt:'2026-06-02',items:[
          'בחלון לא בוצע נוספה אפשרות אופציונלית לקבוע מועד חדש וליצור פק״ע מתוזמנת חדשה.',
          'אם לא מסמנים קביעת מועד חדש, לא בוצע נשאר עובד בדיוק כמו קודם בלי שכפול.',
          'הפק״ע המקורית נשארת בתאריך המקורי בסטטוס לא בוצע עם סיבה והערת תיעוד אם נוצר מועד חדש.',
          'הפק״ע החדשה שנוצרת כמתוזמנת מקבלת הערה אוטומטית: שוכפלה מתאריך המקור.',
          'הפק״ע החדשה נוצרת כמתוזמנת עם אותם פרטי לקוח, כתובת, פריטים, סכום, הערות וסוג פק״ע CN/CH.',
          'קביעת מועד חדש נחסמת לשבת או ליום חופש מסומן.'
        ]});}
        return rows;
      };
      wrapped.__v539Wrapped=true;
      window.requiredChangelogRows=wrapped;
      try{requiredChangelogRows=wrapped;}catch(e){}
    }
  }catch(e){}

  updateVersionUiV539();
  window.addEventListener('load',updateVersionUiV539);
  document.addEventListener('DOMContentLoaded',updateVersionUiV539);
  setInterval(updateVersionUiV539,2200);
})();


/*
===============================================================================
CHANGELOG 5.65 - תיקון אמיתי לעריכת פק״ע CN/CH
-------------------------------------------------------------------------------
1. תיקון ממוקד בלבד לפונקציות openEntryEdit/saveEntryEdit שנדרסו בהמשך הקובץ על ידי גרסאות ישנות.
2. חלון עריכת עבודה משתמש ב-monthEntries המקומי כמקור אמת, לכן הוא מוצא גם פק״ע רגילה וגם פק״ע מתוזמנת בחודש הנבחר.
3. אם העבודה היא התקנה, שדה סוג פק״ע מוצג בחלון העריכה ונטען מהערך השמור הקיים.
4. בשמירה נשמר pekaType לערכים CN/CH בלבד; אם השדה ריק או לא תקין הוא נמחק מהרשומה כדי לא להשאיר מידע שגוי.
5. נשמרה הלוגיקה הקיימת של פריטי התקנה, סכום, סוג סיב/RF, סטטוס מתוזמן/לא בוצע, רענון החודש והודעת שמירה.
===============================================================================
*/
(function(){
  try{ window.APP_VERSION = APP_VERSION; }catch(e){}

  function byIdV565(id){ return document.getElementById(id); }
  function safeEscV565(s){
    try{ return esc(s); }catch(e){
      return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});
    }
  }
  function normalizePekaV565(v){
    v=String(v||'').trim().toUpperCase();
    return (v==='CN'||v==='CH') ? v : '';
  }
  function entryPekaV565(entry){
    if(!entry) return '';
    return normalizePekaV565(entry.pekaType || entry.pekaTypeV527 || entry.installPekaType || entry.peka || entry.pekaKind || entry.cnch || '');
  }
  function setEditPekaV565(entry){
    var wrap=byIdV565('editPekaTypeWrapV564');
    var sel=byIdV565('editPekaTypeV564');
    var isInstall=!!(entry && entry.workType==='install');
    if(wrap) wrap.classList.toggle('hidden', !isInstall);
    if(sel) sel.value=isInstall ? entryPekaV565(entry) : '';
  }
  function selectedPekaV565(){
    var sel=byIdV565('editPekaTypeV564');
    return normalizePekaV565(sel && sel.value);
  }
  function currentEntriesV565(){
    try{ if(Array.isArray(monthEntries)) return monthEntries; }catch(e){}
    try{ if(Array.isArray(window.monthEntries)) return window.monthEntries; }catch(e){}
    return [];
  }
  function findEntryV565(id){
    return currentEntriesV565().find(function(x){ return x && String(x.id)===String(id); });
  }
  function getEditedInstallV565(){
    try{ if(typeof window.getEditedInstallItemsV415==='function') return window.getEditedInstallItemsV415(); }catch(e){}
    try{ if(typeof window.getEditedInstallItems==='function') return window.getEditedInstallItems(); }catch(e){}
    try{ if(typeof getEditedInstallItems==='function') return getEditedInstallItems(); }catch(e){}
    return null;
  }
  function kindLabelForV565(kind){
    try{ if(typeof kindLabelV415==='function') return kindLabelV415(kind); }catch(e){}
    return String(kind||'').toLowerCase()==='rf' ? 'RF' : 'סיב';
  }
  function renderEditItemsV565(entry){
    try{
      if(typeof window.renderEditInstallItemsV415==='function') return window.renderEditInstallItemsV415(entry,false);
    }catch(e){}
    try{
      if(typeof window.renderEditInstallItems==='function') return window.renderEditInstallItems(entry);
    }catch(e){}
    try{
      if(typeof renderEditInstallItems==='function') return renderEditInstallItems(entry);
    }catch(e){}
  }
  function showAfterEditV565(){
    try{ if(typeof showSavedNoticeAfterEditV417==='function') return showSavedNoticeAfterEditV417(); }catch(e){}
    var msg=byIdV565('entryMsg');
    if(msg) msg.innerHTML='<div class="notice">העבודה נשמרה בהצלחה ✅</div>';
  }

  window.openEntryEdit=function(id){
    var e=findEntryV565(id);
    if(!e) return;
    var panel=byIdV565('editEntryPanel');
    if(panel) panel.classList.remove('hidden'); else if(typeof show==='function') show('editEntryPanel');
    if(byIdV565('editEntryId')) byIdV565('editEntryId').value=id;
    if(byIdV565('editEntryCustomer')) byIdV565('editEntryCustomer').value=e.customerNumber||'';
    if(byIdV565('editEntryAddress')) byIdV565('editEntryAddress').value=e.address||'';
    if(byIdV565('editEntryNotes')) byIdV565('editEntryNotes').value=e.notes||'';
    if(byIdV565('editEntryAmount')) byIdV565('editEntryAmount').value=Number(e.amount||0);
    if(byIdV565('editEntryMsg')) byIdV565('editEntryMsg').innerHTML='';
    renderEditItemsV565(e);
    setEditPekaV565(e);
    try{ window.scrollTo({top:byIdV565('editEntryPanel').offsetTop-20,behavior:'smooth'}); }catch(err){}
  };

  window.saveEntryEdit=async function(){
    var id=(typeof val==='function') ? val('editEntryId') : (byIdV565('editEntryId')||{}).value;
    var customerNumber=(typeof val==='function') ? val('editEntryCustomer') : (byIdV565('editEntryCustomer')||{}).value;
    var address=(typeof val==='function') ? val('editEntryAddress') : (byIdV565('editEntryAddress')||{}).value;
    var notes=(typeof val==='function') ? val('editEntryNotes') : (byIdV565('editEntryNotes')||{}).value;
    var amount=Number(((typeof val==='function') ? val('editEntryAmount') : (byIdV565('editEntryAmount')||{}).value) || 0);
    var editMsg=byIdV565('editEntryMsg');

    if(!customerNumber || !/^\d+$/.test(String(customerNumber))){ if(editMsg) editMsg.innerHTML='<p class="danger">מספר לקוח חייב להיות ספרות בלבד.</p>'; return; }
    if(!address){ if(editMsg) editMsg.innerHTML='<p class="danger">חובה למלא כתובת.</p>'; return; }

    var original=findEntryV565(id);
    var update={customerNumber:customerNumber,address:address,notes:notes,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};

    if(original && original.workType==='install'){
      var edited=getEditedInstallV565();
      if(!edited || !Array.isArray(edited.items) || !edited.items.length){
        if(editMsg) editMsg.innerHTML='<p class="danger">חובה לבחור לפחות פריט התקנה אחד.</p>';
        return;
      }
      update.items=edited.items.map(function(i){
        var q=Number(i.quantity||0), price=Number(i.price||0), kind=i.installKind||i.priceType||edited.kind||original.installKind||original.priceType||'';
        return {
          id:i.id||'', name:i.name||'', price:price, quantity:q, inputMode:i.inputMode||'qty',
          installKind:kind, priceType:kind,
          total:Number(i.total!==undefined ? i.total : (q*price))
        };
      });
      update.amount=Number(edited.total || update.items.reduce(function(sum,i){return sum+Number(i.total||0);},0));
      if(edited.kind){
        update.installKind=edited.kind;
        update.priceType=edited.kind;
        update.description='התקנת '+kindLabelForV565(edited.kind);
      }else if(original.description){
        update.description=original.description;
      }

      // v5.68: בכל עריכת התקנה חובה לבחור פק״ע CN או CH; ריק אינו נחשב סוג רגיל.
      var peka=selectedPekaV565();
      if(!peka){
        if(editMsg) editMsg.innerHTML='<p class="danger">חובה לבחור סוג פק״ע: CN או CH.</p>';
        var pekaSel=byIdV565('editPekaTypeV564');
        if(pekaSel){ try{ pekaSel.focus({preventScroll:false}); }catch(_e){ try{ pekaSel.focus(); }catch(_err){} } try{ pekaSel.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_e2){} }
        return;
      }
      update.pekaType=peka;
    }else{
      if(Number.isNaN(amount)||amount<0){ if(editMsg) editMsg.innerHTML='<p class="danger">סכום לא תקין.</p>'; return; }
      update.amount=amount;
    }

    try{
      if(editMsg) editMsg.innerHTML='<div class="notice">שומר...</div>';
      await db.collection('workEntries').doc(id).update(update);
      try{ if(typeof hide==='function') hide('editEntryPanel'); else byIdV565('editEntryPanel').classList.add('hidden'); }catch(e){}
      if(typeof loadMonth==='function') await loadMonth();
      showAfterEditV565();
      try{ if(typeof cleanVisibleSlashN==='function') cleanVisibleSlashN(); }catch(e){}
    }catch(e){
      if(editMsg) editMsg.innerHTML='<p class="danger">שגיאה בשמירה: '+safeEscV565(e && (e.message||e.code) ? (e.message||e.code) : e)+'</p>';
    }
  };

  try{
    var oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRows==='function' && !oldRows.__v565Wrapped){
      var wrappedRows=function(){
        var rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.65'; });
        if(!exists){ rows.unshift({version:'5.65', title:'תיקון עריכת פק״ע CN/CH', createdAt:'2026-06-08', items:[
          'תוקנה העריכה של פק״ע רגילה ומתוזמנת כך ששדה CN/CH נטען בחלון העריכה.',
          'שמירת עריכה שומרת pekaType תקין לערכים CN או CH בלבד.',
          'התיקון בוצע מעל פונקציות העריכה שנדרסו בגרסאות ישנות, בלי לשנות לוגין, לוח שנה, גיבוי, אקסל או דוחות.'
        ]}); }
        return rows;
      };
      wrappedRows.__v565Wrapped=true;
      window.requiredChangelogRows=wrappedRows;
      try{ requiredChangelogRows=wrappedRows; }catch(e){}
    }
  }catch(e){}

  try{ if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}
})();


/*
===============================================================================
CHANGELOG 5.66 - תיקון שמירה מתוזמנת שלא תאפס טופס בכשל ולידציה
-------------------------------------------------------------------------------
תיקון נקודתי לפונקציות השמירה הפעילות בפועל.
בגרסאות קודמות עטיפת 5.36 החזירה למסך בחירת סוג עבודה גם כאשר פונקציית השמירה
החזירה שגיאת ולידציה. כאן מחליפים בסוף הקובץ את פונקציות השמירה הגלובליות כך
שהחזרה למסך תקרה רק אחרי קריאה אמיתית ל-wmAfterLocalEntrySaveV516, כלומר אחרי
שהולידציה עברה והעבודה נכתבה מקומית/ל-Firestore.
===============================================================================
*/
(function(){
  'use strict';

  function qV566(id){ return document.getElementById(id); }
  function valueV566(id){
    try{ if(typeof val==='function') return val(id); }catch(e){}
    var el=qV566(id); return el ? String(el.value||'').trim() : '';
  }
  function escV566(s){
    try{ return esc(s); }catch(e){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];}); }
  }
  function showValidationV566(msg, fieldId){
    var box=qV566('entryMsg');
    if(box) box.innerHTML='<p class="danger">'+escV566(msg)+'</p>';
    var el=qV566(fieldId);
    if(el){
      try{ el.focus({preventScroll:false}); }catch(e){ try{ el.focus(); }catch(err){} }
      try{ el.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){}
    }
    return false;
  }
  function beginSaveV566(){
    try{ if(typeof window.wmBeginEntrySaveV516==='function') return window.wmBeginEntrySaveV516(); }catch(e){}
    return true;
  }
  function saveNoticeV566(label, amount, status, plannedNote){
    try{ if(typeof window.wmOfflineSaveNoticeV516==='function') return window.wmOfflineSaveNoticeV516(label, amount, status, plannedNote); }catch(e){}
    return '<div class="notice">'+escV566(label||'העבודה')+' נשמרה ✅</div>';
  }
  function afterSaveV566(msg){
    try{ if(typeof window.wmAfterLocalEntrySaveV516==='function') return window.wmAfterLocalEntrySaveV516(msg); }catch(e){}
    var box=qV566('entryMsg'); if(box) box.innerHTML=msg || '<div class="notice">העבודה נשמרה ✅</div>';
  }
  function handleErrorV566(err){
    try{ if(typeof window.wmHandleEntrySaveErrorV516==='function') return window.wmHandleEntrySaveErrorV516(err); }catch(e){}
    var box=qV566('entryMsg'); if(box) box.innerHTML='<p class="danger">שגיאה בשמירה: '+escV566((err&&(err.message||err.code))||(String(err)))+'</p>';
  }
  function selectedPekaV566(){
    var el=qV566('pekaTypeV527');
    var v=String((el&&el.value)||'').trim().toUpperCase();
    return (v==='CN'||v==='CH') ? v : '';
  }
  function selectedKindV566(){
    try{ if(typeof selectedKindV411==='function') return selectedKindV411(); }catch(e){}
    try{ if(typeof window.selectedInstallKindV411==='function') return window.selectedInstallKindV411(); }catch(e){}
    var rf=qV566('installKindRfV411'); if(rf && rf.checked) return 'rf';
    return 'fiber';
  }
  function kindLabelV566(kind){
    try{ if(typeof kindLabelV411==='function') return kindLabelV411(kind); }catch(e){}
    return String(kind||'').toLowerCase()==='rf' ? 'RF' : 'סיב';
  }
  function currentAuthUidV566(){
    try{ if(typeof currentAuthUid==='function') return currentAuthUid(); }catch(e){}
    return '';
  }
  function servicePriceV566(){
    try{ return Number(SERVICE_PRICE||0); }catch(e){ return 65; }
  }

  // v5.66: פונקציית שירות אחת לכל המסלולים. כשל ולידציה מחזיר לפני כל איפוס/חזרה למסך.
  function addServiceWithStatusV566(status){
    var customerNumber=valueV566('sCustomer');
    var address=valueV566('sAddress');
    var notes=valueV566('sNotes');
    var returnCb=qV566('sReturnCall');
    var isReturnCall=!!(returnCb&&returnCb.checked);
    var amount=isReturnCall?0:servicePriceV566();

    if(!customerNumber || !/^\d+$/.test(String(customerNumber))) return showValidationV566('חובה למלא מספר לקוח בספרות בלבד.','sCustomer');
    if(!address) return showValidationV566('חובה למלא כתובת.','sAddress');
    if(!viewedWorker || !viewedWorker.id || !selectedDate) return showValidationV566('חסר עובד או יום נבחר. רענן את המסך ונסה שוב.','sCustomer');
    if(!beginSaveV566()) return false;

    var successMsg=saveNoticeV566('קריאת השירות', status==='planned'?null:amount, status, 'היא לא נכנסה להתחשבנות עד שתלחץ בוצע.');
    try{
      var writePromise=db.collection('workEntries').add({
        workerId:viewedWorker.id,
        workerName:viewedWorker.name,
        authUid:viewedWorker.authUid||currentAuthUidV566(),
        date:selectedDate,
        workType:'service',
        entryStatus:status,
        description:isReturnCall?'קריאת שירות חוזרת':'קריאת שירות',
        customerNumber:customerNumber,
        address:address,
        notes:notes,
        isReturnCall:isReturnCall,
        amount:amount,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      writePromise.then(function(){ try{ if(typeof loadMonth==='function') loadMonth(); }catch(e){} }).catch(handleErrorV566);
      afterSaveV566(successMsg);
      return true;
    }catch(err){ handleErrorV566(err); return false; }
  }

  // v5.66: התקנה רגילה/מתוזמנת עם שמירת סוג סיב/RF ופק״ע CN/CH, בלי איפוס בכשל ולידציה.
  function addInstallWithStatusV566(status){
    var customerNumber=valueV566('iCustomer');
    var address=valueV566('iAddress');
    var notes=valueV566('iNotes');

    if(!customerNumber || !/^\d+$/.test(String(customerNumber))) return showValidationV566('חובה למלא מספר לקוח בספרות בלבד.','iCustomer');
    if(!address) return showValidationV566('חובה למלא כתובת.','iAddress');
    if(!viewedWorker || !viewedWorker.id || !selectedDate) return showValidationV566('חסר עובד או יום נבחר. רענן את המסך ונסה שוב.','iCustomer');

    var items=[];
    var total=0;
    var kind=selectedKindV566();
    var peka=selectedPekaV566();

    // v5.68: כל התקנה, RF או סיב, חייבת סוג פק״ע CN/CH לפני שמירה רגילה או מתוזמנת.
    if(!peka) return showValidationV566('חובה לבחור סוג פק״ע: CN או CH.','pekaTypeV527');

    try{
      (priceList||[]).forEach(function(p){
        var el=qV566('qty_'+p.id);
        var qty=0;
        if(el) qty=(p.inputMode||'qty')==='check' ? (el.checked?1:0) : Number(el.value||0);
        if(qty>0){
          var price=Number(p.price||0);
          items.push({
            id:p.id,
            name:p.name,
            price:price,
            quantity:qty,
            inputMode:p.inputMode||'qty',
            priceType:kind,
            installKind:kind,
            pekaType:peka || '',
            total:qty*price
          });
          total+=qty*price;
        }
      });
    }catch(e){}

    if(!items.length) return showValidationV566('חובה לבחור לפחות פריט אחד.','iCustomer');
    if(!beginSaveV566()) return false;

    var label='התקנת '+kindLabelV566(kind);
    var successMsg=saveNoticeV566(label, status==='planned'?null:total, status, 'היא לא נכנסה להתחשבנות עד שתלחץ בוצע.');
    try{
      var data={
        workerId:viewedWorker.id,
        workerName:viewedWorker.name,
        authUid:viewedWorker.authUid||currentAuthUidV566(),
        date:selectedDate,
        workType:'install',
        installKind:kind,
        priceType:kind,
        entryStatus:status,
        description:label,
        customerNumber:customerNumber,
        address:address,
        notes:notes,
        items:items,
        amount:total,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      if(peka) data.pekaType=peka;
      var writePromise=db.collection('workEntries').add(data);
      writePromise.then(function(){ try{ if(typeof loadMonth==='function') loadMonth(); }catch(e){} }).catch(handleErrorV566);
      afterSaveV566(successMsg);
      return true;
    }catch(err){ handleErrorV566(err); return false; }
  }

  window.addService=function(){ return addServiceWithStatusV566('done'); };
  window.addInstall=function(){ return addInstallWithStatusV566('done'); };
  window.addServicePlannedV49=function(){ return addServiceWithStatusV566('planned'); };
  window.addInstallPlannedV49=function(){ return addInstallWithStatusV566('planned'); };
  window.addServiceWithStatusV566=addServiceWithStatusV566;
  window.addInstallWithStatusV566=addInstallWithStatusV566;

  try{
    var oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRows==='function' && !oldRows.__v566Wrapped){
      var wrappedRows=function(){
        var rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.66'; });
        if(!exists){ rows.unshift({version:'5.66', title:'תיקון שמירה מתוזמנת בלי איפוס בכשל', createdAt:'2026-06-22', items:[
          'אם חסר מספר לקוח או כתובת בשמור מתוזמן, הטופס נשאר פתוח ומציג הודעה אדומה.',
          'הסמן עובר לשדה החסר כדי להשלים אותו בלי להזין את כל הטופס מחדש.',
          'החזרה למסך בחירת סוג עבודה מתבצעת רק אחרי שמירה מוצלחת.',
          'התיקון חל על קריאת שירות, התקנה, קריאת שירות מתוזמנת והתקנה מתוזמנת.'
        ]}); }
        return rows;
      };
      wrappedRows.__v566Wrapped=true;
      window.requiredChangelogRows=wrappedRows;
      try{ requiredChangelogRows=wrappedRows; }catch(e){}
    }
  }catch(e){}

  try{ if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}
})();


/*
===============================================================================
CHANGELOG 5.68 - חיוב בחירת סוג פק״ע בכל התקנה
-------------------------------------------------------------------------------
1. תיקון ממוקד ב-functions.js בלבד.
2. כל שמירת התקנה רגילה או מתוזמנת מחייבת pekaType בערך CN או CH.
3. בחירה ריקה נעצרת בוולידציה, מציגה הודעה אדומה ומשאירה את הטופס פתוח.
4. גם עריכת התקנה קיימת/מתוזמנת מחייבת CN/CH ולא מוחקת pekaType לריק.
===============================================================================
*/
(function(){
  try{ window.APP_VERSION = APP_VERSION; }catch(e){}

  // v5.68: גיבוי לעדכון מה חדש במקרה שמקור הרשומות כבר נעטף על ידי גרסאות קודמות.
  try{
    var oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRows==='function' && !oldRows.__v568Wrapped){
      var wrappedRows=function(){
        var rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.68'; });
        if(!exists){ rows.unshift({version:'5.68', title:'חיוב בחירת פק״ע בכל התקנה', createdAt:'2026-06-23', items:[
          'בכל שמירת התקנה רגילה או מתוזמנת חובה לבחור סוג פק״ע CN או CH.',
          'בחירה ריקה אינה נחשבת רגילה ולא מאפשרת שמירה.',
          'אם סוג הפק״ע חסר, הטופס נשאר פתוח, מוצגת הודעה אדומה והסמן עובר לשדה סוג הפק״ע.',
          'החובה חלה על כל התקנת RF או סיב, בלי קשר לפריט ההתקנה שנבחר.'
        ]}); }
        return rows;
      };
      wrappedRows.__v568Wrapped=true;
      window.requiredChangelogRows=wrappedRows;
      try{ requiredChangelogRows=wrappedRows; }catch(e){}
    }
  }catch(e){}

  try{ if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}
})();


/*
===============================================================================
CHANGELOG 5.69 - בדיקת לקוח: הצגת פק״ע שלא בוצעה
-------------------------------------------------------------------------------
1. תיקון ממוקד ב-functions.js בלבד.
2. בדיקת לקוח חוזר מפרידה entryStatus=not_done מעבודות שבוצעו ומתוזמנות.
3. פק״ע שלא בוצעה מוצגת כהערה עם סיבה ופירוט, ולא כעבודה רגילה בסכום ₪0.
===============================================================================
*/
(function(){
  try{ window.APP_VERSION = APP_VERSION; }catch(e){}

  // v5.69: גיבוי לעדכון מה חדש במקרה שמקור הרשומות כבר נעטף על ידי גרסאות קודמות.
  try{
    var oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRows==='function' && !oldRows.__v569Wrapped){
      var wrappedRows=function(){
        var rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.69'; });
        if(!exists){ rows.unshift({version:'5.69', title:'בדיקת לקוח: הצגת פק״ע שלא בוצעה', createdAt:'2026-06-24', items:[
          'בדיקת לקוח חוזר מציגה פק״ע מתוזמנת שסומנה כלא בוצעה כהערה ברורה ולא כעבודה רגילה עם ₪0.',
          'ההערה כוללת תאריך, סוג עבודה, סיבה ופירוט אם קיים.',
          'מילוי הכתובת האוטומטי נשאר כמו שהיה וממשיך לעבוד גם לפי רשומות שלא בוצעו.',
          'לא שונו שמירת עבודות, מתוזמנות, עריכה, דשבורד, HTML או CSS.'
        ]}); }
        return rows;
      };
      wrappedRows.__v569Wrapped=true;
      window.requiredChangelogRows=wrappedRows;
      try{ requiredChangelogRows=wrappedRows; }catch(e){}
    }
  }catch(e){}

  try{ if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}
})();


/*
===============================================================================
CHANGELOG 5.70 - תיקון סופי להצגת פק״ע שלא בוצעה בבדיקת לקוח
-------------------------------------------------------------------------------
1. תיקון ממוקד ב-functions.js בלבד.
2. הוגדר override סופי ל-checkRecentCustomer בסוף הקובץ, אחרי כל עטיפות הגרסאות הישנות.
3. רשומות entryStatus/status=not_done אינן מוצגות עוד כעבודה רגילה עם ₪0.
4. הרשומה מוצגת כהערת "לא בוצע" עם תאריך, סוג עבודה, סיבה ופירוט אם קיים.
5. מילוי כתובת אוטומטי נשאר פעיל גם לפי רשומות שלא בוצעו.
===============================================================================
*/
(function(){
  // v5.70: override סופי חייב להופיע בסוף הקובץ כי קיימת עטיפת v4.16 מאוחרת שדרסה את תיקון v5.69.
  function qV570(id){ try{return document.getElementById(id);}catch(e){return null;} }
  function valV570(id){ var el=qV570(id); return el ? String(el.value||'').trim() : ''; }
  function escV570(s){ try{ if(typeof esc==='function') return esc(s); }catch(e){} return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];}); }
  function moneyV570(n){ try{ if(typeof money==='function') return money(n); }catch(e){} return '₪'+Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0}); }
  function dateV570(s){ try{ if(typeof heDate==='function') return heDate(s); }catch(e){} return escV570(s||''); }
  function todayV570(){ try{ if(typeof todayStr==='function') return todayStr(); }catch(e){} try{ if(typeof formatDate==='function') return formatDate(new Date()); }catch(e){} var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function fmtDateV570(d){ try{ if(typeof formatDate==='function') return formatDate(d); }catch(e){} return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function statusV570(e){ return String((e && (e.entryStatus || e.status)) || 'done'); }
  function isPlannedV570(e){ var st=statusV570(e); if(st==='planned') return true; try{ if(window.isPlannedV49 && window.isPlannedV49(e)) return true; }catch(_e){} return false; }
  function isNotDoneV570(e){ return statusV570(e)==='not_done'; }
  function safeWorkerIdV570(){ try{ return viewedWorker && viewedWorker.id ? viewedWorker.id : ''; }catch(e){ return ''; } }

  window.checkRecentCustomer = async function(inputId, resultId){
    var num=valV570(inputId);
    var box=qV570(resultId);
    if(!box) return;
    box.innerHTML='';
    if(!num) return;
    if(!/^\d+$/.test(num)){ box.innerHTML='<div class="danger">מספר לקוח חייב להיות ספרות בלבד</div>'; return; }
    var workerId=safeWorkerIdV570();
    if(!workerId){ box.innerHTML='<div class="danger">לא זוהה עובד פעיל לבדיקה.</div>'; return; }
    box.innerHTML='<div class="muted">בודק עבודות שבוצעו, מתוזמנות ופק״עות שלא בוצעו אצל העובד הנוכחי...</div>';
    try{
      var from=new Date(Date.now()-30*24*60*60*1000);
      var fromStr=fmtDateV570(from);
      var today=todayV570();
      var snap=await db.collection('workEntries').where('workerId','==',workerId).where('customerNumber','==',num).get();
      var all=snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }).filter(function(e){ return e && e.workerId===workerId && String(e.customerNumber||'')===num; });
      all.sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });

      // v5.70: הפרדה מחייבת — not_done יוצא גם מ"בוצע" וגם מ"מתוזמן" כדי שלא יוצג כעבודה רגילה עם ₪0.
      var notDoneMatches=all.filter(isNotDoneV570).sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
      var doneMatches=all.filter(function(e){ return !isNotDoneV570(e) && !isPlannedV570(e) && String(e.date||'')>=fromStr; }).sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
      var plannedMatches=all.filter(function(e){ return !isNotDoneV570(e) && isPlannedV570(e) && String(e.date||'')>=today; }).sort(function(a,b){ return String(a.date||'').localeCompare(String(b.date||'')); });

      var addressTargetId = inputId === 'sCustomer' ? 'sAddress' : (inputId === 'iCustomer' ? 'iAddress' : '');
      var addressTarget = addressTargetId ? qV570(addressTargetId) : null;
      var addressSource = doneMatches.find(function(e){return String(e.address||'').trim();}) || plannedMatches.find(function(e){return String(e.address||'').trim();}) || notDoneMatches.find(function(e){return String(e.address||'').trim();}) || all.find(function(e){return String(e.address||'').trim();});
      if(addressTarget && !String(addressTarget.value||'').trim() && addressSource && String(addressSource.address||'').trim()){
        addressTarget.value=String(addressSource.address||'').trim();
        try{ addressTarget.dispatchEvent(new Event('input',{bubbles:true})); }catch(_e){}
        try{ addressTarget.dispatchEvent(new Event('change',{bubbles:true})); }catch(_e){}
      }

      if(!doneMatches.length && !plannedMatches.length && !notDoneMatches.length){
        box.innerHTML='<div class="recent-ok">לא נמצאה עבודה שבוצעה ב־30 הימים האחרונים, אין סידור מתוזמן ואין פק״ע שלא בוצעה ללקוח הזה ✅</div>';
        return;
      }
      var parts=[];
      if(doneMatches.length){
        var last=doneMatches[0];
        parts.push('✅ היית אצל לקוח זה ב־30 הימים האחרונים.<br>פעם אחרונה: '+dateV570(last.date)+' · '+escV570(last.description||'עבודה')+' · '+moneyV570(last.amount||0)+'<br>כתובת: '+escV570(last.address||''));
      }
      if(plannedMatches.length){
        var next=plannedMatches[0];
        parts.push('📋 קיימת קריאה/התקנה מתוזמנת ללקוח זה.<br>מועד קרוב: '+dateV570(next.date)+' · '+escV570(next.description||'סידור מתוזמן')+' · צפי '+moneyV570(next.amount||0)+'<br>כתובת: '+escV570(next.address||''));
      }
      if(notDoneMatches.length){
        var nd=notDoneMatches[0];
        var ndReason=nd.notDoneReason || nd.cancelReason || nd.reason || 'לא צוינה סיבה';
        var ndNote=nd.notDoneNote || '';
        parts.push('🚫 פק״ע מתוזמנת שלא בוצעה ללקוח זה.<br>תאריך: '+dateV570(nd.date)+' · '+escV570(nd.description||'פק״ע מתוזמנת')+'<br>סיבה: '+escV570(ndReason)+'<br>כתובת: '+escV570(nd.address||'')+(ndNote?'<br>פירוט: '+escV570(ndNote):''));
      }
      box.innerHTML='<div class="recent-box">'+parts.join('<br><br>')+'</div>';
    }catch(e){
      var msg=(e && (e.code==='permission-denied' || String(e.message||'').indexOf('permissions')>-1)) ? 'אין הרשאה לבדוק היסטוריית לקוח. השאילתה כבר מוגבלת לעובד הנוכחי, לכן אם זה חוזר צריך לעדכן Rules שיאפשרו לעובד לקרוא workEntries שלו לפי workerId.' : 'שגיאה בבדיקת לקוח: '+(e && e.message ? e.message : e);
      box.innerHTML='<div class="danger">'+escV570(msg)+'</div>';
    }
  };

  // v5.70: עדכון מה חדש דרך אותו מנגנון קיים בלי לשנות HTML/CSS.
  try{
    var oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRows==='function' && !oldRows.__v570Wrapped){
      var wrappedRows=function(){
        var rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.70'; });
        if(!exists){ rows.unshift({version:'5.70', title:'תיקון סופי להצגת פק״ע שלא בוצעה בבדיקת לקוח', createdAt:'2026-06-24', items:[
          'בדיקת לקוח חוזר הועברה ל-override סופי בסוף הקובץ כדי שלא תידרס על ידי עטיפות ישנות.',
          'פק״ע שלא בוצעה מוצגת כהערה עם תאריך, סוג עבודה, סיבה ופירוט ולא כעבודה רגילה עם ₪0.',
          'רשומות לא בוצע לא נספרות כעבודה שבוצעה או כסידור מתוזמן בבדיקת הלקוח.',
          'מילוי כתובת אוטומטי נשאר פעיל גם לפי פק״עות שלא בוצעו.'
        ]}); }
        return rows;
      };
      wrappedRows.__v570Wrapped=true;
      window.requiredChangelogRows=wrappedRows;
      try{ requiredChangelogRows=wrappedRows; }catch(e){}
    }
  }catch(e){}
  try{ if(typeof setAppVersionUI==='function') setAppVersionUI(); }catch(e){}
})();


(function(){
  'use strict';
  var APP_VERSION_V574 = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : (window.APP_VERSION || '5.75'));

  function byId(id){ return document.getElementById(id); }
  function safe(v){ try{ if(typeof esc==='function') return esc(v); }catch(e){} return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function moneySafe(v){ try{ if(typeof money==='function') return money(v); }catch(e){} return '₪'+Number(v||0).toLocaleString('he-IL'); }
  function dateSafe(v){ try{ if(typeof heDate==='function') return heDate(v); }catch(e){} return String(v||''); }
  function statusOf(e){ return String((e && (e.entryStatus || e.status)) || 'done'); }
  function labelOf(e){
    try{ if(typeof entryTypeLabelV529==='function') return entryTypeLabelV529(e); }catch(err){}
    if(!e) return '';
    if(e.workType==='install') return 'התקנה';
    if(e.isReturnCall) return 'קריאה חוזרת';
    return 'קריאת שירות';
  }
  function updateVersionUiV574(){
    try{ window.APP_VERSION=APP_VERSION_V574; }catch(e){}
    try{ document.title='מעקב עבודה - גרסה '+APP_VERSION_V574; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=APP_VERSION_V574; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+APP_VERSION_V574; }); }catch(e){}
  }

  function isCompletedFromPlannedV574(e){
    // v5.75: לא ממציאים סימון חדש. משתמשים בסימון הקיים convertedFromPlanned=true שנשמר כאשר מתוזמנת סומנה כבוצעה.
    return !!(e && e.convertedFromPlanned === true && statusOf(e)!=='planned' && statusOf(e)!=='not_done' && statusOf(e)!=='cancelled');
  }

  // v5.96: ניווט לפק״ע בחודש אחר חייב קודם לטעון את חודש היעד ורק אחר כך לצייר, לגלול ולהדגיש.
  window.openSmartEntryV584=async function(entryId,entryDate){
    try{
      if(!entryId || !entryDate) return;
      var parts=String(entryDate).split('-').map(Number);
      if(parts.length!==3 || !parts[0] || !parts[1] || !parts[2]) return;

      var targetMonth=new Date(parts[0],parts[1]-1,1);
      var monthChanged=!(calendarDate instanceof Date)
        || calendarDate.getFullYear()!==targetMonth.getFullYear()
        || calendarDate.getMonth()!==targetMonth.getMonth();

      // קודם מעדכנים את חודש התצוגה ואת היום הנבחר. loadMonth ישאיר את selectedDate ולא יחזיר להיום.
      calendarDate=targetMonth;
      selectedDate=entryDate;
      selectedType=null;

      // גם באותו חודש מבצעים ציור; בחודש אחר ממתינים לטעינה מלאה של הנתונים מ-Firestore.
      if(monthChanged && typeof loadMonth==='function') await loadMonth();
      else{
        try{ if(typeof renderCalendar==='function') renderCalendar(); }catch(e){}
        try{ if(typeof renderDay==='function') renderDay(); }catch(e){}
        try{ if(typeof renderStats==='function') renderStats(); }catch(e){}
        try{ if(typeof renderSmartDashboard==='function') renderSmartDashboard(); }catch(e){}
      }

      try{ show('dayPanel'); hide('selectDayHint'); }catch(e){}

      var attempts=0;
      var focusExactEntry=function(){
        attempts++;
        var target=null;
        try{
          document.querySelectorAll('#dayEntries [data-entry-id]').forEach(function(el){
            if(!target && String(el.dataset.entryId||'')===String(entryId)) target=el;
          });
        }catch(e){}
        if(target){
          try{ target.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){ try{ target.scrollIntoView(); }catch(_e){} }
          target.classList.remove('smart-entry-highlight-v584');
          void target.offsetWidth;
          target.classList.add('smart-entry-highlight-v584');
          setTimeout(function(){ try{ target.classList.remove('smart-entry-highlight-v584'); }catch(e){} },3200);
          return;
        }
        if(attempts<12) setTimeout(focusExactEntry,140);
        else{
          var panel=document.getElementById('dayPanel');
          if(panel){ try{ panel.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} }
        }
      };
      setTimeout(focusExactEntry,100);
    }catch(e){ console.warn('openSmartEntryV584 failed',e); }
  };

  function appendCompletedPlannedSmartDashboardV574(){
    try{
      var host=byId('smartDashboard'); if(!host) return;
      var old=byId('plannedDoneSmartPanelV574'); if(old) old.remove();
      var entries=(Array.isArray(window.monthEntries)?window.monthEntries:(typeof monthEntries!=='undefined'&&Array.isArray(monthEntries)?monthEntries:[])).filter(isCompletedFromPlannedV574);
      entries=entries.slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
      var total=entries.reduce(function(s,e){ return s+Number(e.amount||0); },0);
      var listHtml=entries.length ? entries.map(function(e){
        var entryId=String(e.id||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        var entryDate=String(e.date||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return '<div class="item planned-done-card-v574 smart-entry-link-v584" role="button" tabindex="0" onclick="openSmartEntryV584(\''+entryId+'\',\''+entryDate+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openSmartEntryV584(\''+entryId+'\',\''+entryDate+'\')}"><div><div class="item-title">'+dateSafe(e.date)+' · '+safe(labelOf(e))+' · לקוח '+safe(e.customerNumber||'')+'</div><div class="item-sub">כתובת: '+safe(e.address||'')+(e.notes?'<br>הערה: '+safe(e.notes):'')+'</div></div><div><div class="planned-done-badge-v574">בוצע</div><div class="money">'+moneySafe(e.amount||0)+'</div></div></div>';
      }).join('') : '<p class="muted">אין החודש מתוזמנות שסומנו כבוצעו.</p>';
      var panel=document.createElement('div');
      panel.id='plannedDoneSmartPanelV574';
      panel.className='planned-done-panel-v574';
      panel.innerHTML='<h3>✅ מתוזמנות שבוצעו</h3><p class="muted">סה״כ מתוזמנות שבוצעו החודש: <b>'+entries.length+'</b> · סכום: <b>'+moneySafe(total)+'</b></p><div class="planned-done-list-v574">'+listHtml+'</div>';
      var notDonePanel=byId('notDoneSmartPanelV529');
      if(notDonePanel && notDonePanel.parentNode===host) notDonePanel.insertAdjacentElement('afterend', panel);
      else host.appendChild(panel);
    }catch(e){ console.warn('appendCompletedPlannedSmartDashboardV574 failed', e); }
  }
  window.appendCompletedPlannedSmartDashboardV574=appendCompletedPlannedSmartDashboardV574;

  function wrapDashboardV574(){
    try{
      if(window.__plannedDoneDashboardWrappedV574 || typeof window.renderSmartDashboard!=='function') return;
      var oldSmart=window.renderSmartDashboard;
      window.renderSmartDashboard=function(){
        var r=oldSmart.apply(this,arguments);
        try{ appendCompletedPlannedSmartDashboardV574(); }catch(e){}
        return r;
      };
      window.__plannedDoneDashboardWrappedV574=true;
    }catch(e){}
  }

  function bootV574(){
    updateVersionUiV574();
    wrapDashboardV574();
    try{ appendCompletedPlannedSmartDashboardV574(); }catch(e){}
  }

  // v5.75: עדכון מקור ה"מה חדש" הקיים בלי לשנות מנגנון Changelog אחר.
  try{
    var oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function' ? requiredChangelogRows : null);
    if(typeof oldRows==='function' && !oldRows.__v574Wrapped){
      var wrappedRows=function(){
        var rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){ rows=[]; }
        var exists=rows.some(function(r){ return String(r.version||r.id||'')==='5.75'; });
        if(!exists){ rows.unshift({version:'5.75', title:'מתוזמנות שבוצעו בדשבורד החכם', createdAt:'2026-07-06', items:[
          'נוסף אזור מתחת למתוזמנות שלא בוצעו שמציג מתוזמנות שבוצעו בהצלחה.',
          'החישוב משתמש בסימון הקיים convertedFromPlanned=true ולא יוצר שדה חדש.',
          'מוצגים כמות, סכום ורשימה בגלילה של תאריך, לקוח, סוג עבודה, כתובת וסכום.',
          'לא שונו שמירה, סימון בוצע, סימון לא בוצע, גיבוי, שחזור, אקסל או PDF.'
        ]}); }
        return rows;
      };
      wrappedRows.__v574Wrapped=true;
      window.requiredChangelogRows=wrappedRows;
      try{ requiredChangelogRows=wrappedRows; }catch(e){}
    }
  }catch(e){}

  document.addEventListener('DOMContentLoaded',function(){ setTimeout(bootV574,350); setTimeout(bootV574,1400); });
  window.addEventListener('load',function(){ setTimeout(bootV574,450); setTimeout(bootV574,1700); });
})();


/*
===============================================================================
CHANGE 5.77 - WORKER TAB COLLAPSIBLE AREAS ONLY
-------------------------------------------------------------------------------
מתקן את כיווץ 5.76 כך שהוא לא יופיע בלוח השנה או ברשימת פק״עות.
הכיווץ נשאר רק בכרטיסיות העליונות של העובד, ושומר מצב מקומי לכל מכשיר.
===============================================================================
*/
(function initWorkerTabCollapsibleV577(){
  const STORAGE_PREFIX = "wm_worker_tab_collapsed_v577_";
  const TARGET_PANES = new Set(["overview","tools","settings","dashboard","client","search"]);

  function getPaneKey(pane){
    return (pane && pane.getAttribute("data-worker-pane")) || "unknown";
  }

  function getPaneTitle(key){
    const tab = document.querySelector('.worker-tab-btn-v420[data-worker-tab="' + key + '"]');
    const raw = tab ? (tab.textContent || "").trim() : "";
    return raw || "כרטיסייה";
  }

  function isTargetPane(pane){
    if(!pane || pane.dataset.wmCollapseReadyV577 === "1") return false;
    const key = getPaneKey(pane);
    return TARGET_PANES.has(key);
  }

  function findHeader(pane){
    return pane.querySelector(":scope > .cal-head, :scope > .wm-tab-collapse-header-v577, :scope > h1, :scope > h2, :scope > h3");
  }

  function ensureHeader(pane){
    const key = getPaneKey(pane);
    let header = findHeader(pane);
    if(header && header.classList && header.classList.contains("cal-head")){
      header.classList.add("wm-collapse-header-v576","wm-tab-collapse-header-v577");
      return header;
    }
    if(header && header.classList && header.classList.contains("wm-tab-collapse-header-v577")) return header;

    const wrap = document.createElement("div");
    wrap.className = "wm-collapse-header-v576 wm-tab-collapse-header-v577";

    if(header){
      pane.insertBefore(wrap, header);
      wrap.appendChild(header);
    }else{
      const title = document.createElement("h2");
      title.textContent = getPaneTitle(key);
      wrap.appendChild(title);
      pane.insertBefore(wrap, pane.firstChild);
    }
    return wrap;
  }

  function ensureBody(pane, header){
    let body = pane.querySelector(":scope > .wm-collapse-body-v576");
    if(body) return body;
    body = document.createElement("div");
    body.className = "wm-collapse-body-v576";
    let node = header.nextSibling;
    const move=[];
    while(node){
      const next=node.nextSibling;
      if(!(node.nodeType === 1 && node.classList.contains("wm-collapse-btn-v576"))) move.push(node);
      node=next;
    }
    pane.appendChild(body);
    move.forEach(n=>body.appendChild(n));
    return body;
  }

  function setCollapsed(pane, collapsed){
    const key = getPaneKey(pane);
    pane.classList.toggle("wm-card-collapsed-v576", !!collapsed);
    pane.classList.toggle("wm-tab-collapsed-v577", !!collapsed);
    const btn = pane.querySelector(":scope > .wm-collapse-header-v576 .wm-collapse-btn-v576, :scope > .cal-head .wm-collapse-btn-v576");
    if(btn){
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.title = collapsed ? "פתח כרטיסייה" : "כווץ כרטיסייה";
      btn.textContent = collapsed ? "▾" : "▴";
    }
    try{ localStorage.setItem(STORAGE_PREFIX + key, collapsed ? "1" : "0"); }catch(e){}
  }

  function makeCollapsible(pane){
    if(!isTargetPane(pane)) return;
    const key = getPaneKey(pane);
    const header = ensureHeader(pane);
    if(!header) return;
    const body = ensureBody(pane, header);
    if(!body) return;
    pane.dataset.wmCollapseReadyV577 = "1";

    const btn = document.createElement("span");
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.className = "wm-collapse-btn-v576 wm-collapse-link-v581";
    btn.setAttribute("aria-label", "פתח או כווץ כרטיסייה");
    btn.onclick = function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      setCollapsed(pane, !pane.classList.contains("wm-card-collapsed-v576"));
    };
    // v5.81: נשאר לחיץ גם במקלדת אחרי המעבר מ-button ל-span נקי, בלי לשנות את לוגיקת הכיווץ.
    btn.onkeydown = function(ev){
      if(ev.key === "Enter" || ev.key === " "){
        ev.preventDefault();
        ev.stopPropagation();
        setCollapsed(pane, !pane.classList.contains("wm-card-collapsed-v576"));
      }
    };
    header.appendChild(btn);

    let saved = "0";
    try{ saved = localStorage.getItem(STORAGE_PREFIX + key) || "0"; }catch(e){}
    setCollapsed(pane, saved === "1");
  }

  function removeOldCardCollapseFromNonTargets(){
    // מנקה רק את סימון הכיווץ הרחב של 5.76 מכרטיסים שלא אמורים להתכווץ, כדי שהלוח ופק״עות לא יושפעו.
    document.querySelectorAll(".card[data-wm-collapse-ready='1']").forEach(function(card){
      if(card.classList.contains("worker-tabs-shell-v420")) return;
      card.classList.remove("wm-card-collapsed-v576");
      const btn = card.querySelector(":scope > .wm-collapse-header-v576 .wm-collapse-btn-v576, :scope > .cal-head .wm-collapse-btn-v576");
      if(btn) btn.remove();
    });
  }

  function scan(){
    try{
      removeOldCardCollapseFromNonTargets();
      document.querySelectorAll(".worker-tab-pane-v420[data-worker-pane]").forEach(makeCollapsible);
    }catch(e){ console.warn("worker tab collapsible init failed", e); }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  window.addEventListener("load", scan);
  try{
    const mo = new MutationObserver(function(){ window.clearTimeout(window.__wmCollapseScanTimerV577); window.__wmCollapseScanTimerV577 = window.setTimeout(scan, 120); });
    mo.observe(document.body, {childList:true, subtree:true});
  }catch(e){}
  window.initWorkerTabCollapsibleV577 = scan;
})();


/*
CHANGE 5.78 - QUICK SEARCH ICONS IN WORK CARDS
מטרה: להוסיף קיצור דרך קטן ליד מספר לקוח וליד כתובת בכל כרטיס עבודה/פק״ע.
הקיצור משתמש במנגנון החיפוש הקיים: פותח את כרטיסיית החיפוש, מנקה תאריכים, ממלא מספר לקוח או כתובת ומריץ חיפוש גלובלי בכל ההיסטוריה.
לא נוספו שדות Firestore חדשים ולא שונתה לוגיקת שמירת עבודות.
*/
(function(){
  'use strict';
  // v5.80: אין כאן גרסה מקומית. משתמשים רק ב-APP_VERSION כדי למנוע קפיצה בין גרסאות בממשק.

  function byId(id){ return document.getElementById(id); }
  function escText(v){ return String(v==null?'':v); }
  function cssEscapeSafe(v){
    try{ if(window.CSS && typeof CSS.escape==='function') return CSS.escape(String(v)); }catch(e){}
    return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  }
  function setInputValue(id,value){
    var el=byId(id); if(!el) return;
    el.value=String(value||'');
    try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
    try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
  }
  function clearDateScopesForGlobalSearch(){
    ['searchDate','searchDateFromV507','searchDateToV507','searchMonth'].forEach(function(id){ setInputValue(id,''); });
  }
  // v5.83: חיפוש מהיר חייב גם לפתוח וגם להרחיב את כרטיסיית "חיפוש וסיכומים",
  // כדי שאם המשתמש כיווץ אותה קודם הוא עדיין יראה מיד את התוצאות.
  function expandSearchSummaryPaneV583(){
    try{
      var pane = document.querySelector('.worker-tab-pane-v420[data-worker-pane="search"]');
      if(!pane) return;
      pane.classList.remove('wm-card-collapsed-v576','wm-tab-collapsed-v577');
      var body = pane.querySelector(':scope > .wm-collapse-body-v576');
      if(body){
        body.hidden = false;
        body.style.display = '';
      }
      var btn = pane.querySelector('.wm-collapse-btn-v576');
      if(btn){
        btn.setAttribute('aria-expanded','true');
        btn.title = 'כווץ כרטיסייה';
        btn.textContent = '▴';
      }
      try{ localStorage.setItem('wm_worker_tab_collapsed_v577_search','0'); }catch(e){}
    }catch(e){}
  }
  function openSearchTabExisting(){
    try{ if(typeof window.openWorkerTabV420==='function'){ window.openWorkerTabV420('search'); } }catch(e){}
    try{ var panel=byId('searchPanel'); if(panel) panel.classList.remove('hidden'); }catch(e){}
    expandSearchSummaryPaneV583();
    setTimeout(expandSearchSummaryPaneV583, 80);
    setTimeout(expandSearchSummaryPaneV583, 250);
  }
  window.quickSearchFromEntryV578 = async function(kind,value){
    value=String(value||'').trim();
    if(!value) return;
    try{ openSearchTabExisting(); }catch(e){}
    try{ window.searchBaseEntriesV507=null; }catch(e){}
    try{ if(window.selectedWorkerPriceSearchItemsV38) window.selectedWorkerPriceSearchItemsV38=new Set(); }catch(e){}

    // v5.78: אין הגבלת זמן - מנקים כל תאריך/חודש כדי שהחיפוש הקיים יעבור לכל ההיסטוריה כשיש פילטר פעיל.
    clearDateScopesForGlobalSearch();
    setInputValue('searchType','');
    try{ var peka=byId('pekaSearchTypeV528'); if(peka){ peka.value=''; peka.dispatchEvent(new Event('change',{bubbles:true})); } }catch(e){}

    if(kind==='customer'){
      setInputValue('searchCustomer',value);
      setInputValue('searchAddress','');
    }else if(kind==='address'){
      setInputValue('searchCustomer','');
      setInputValue('searchAddress',value);
    }

    try{ if(typeof window.onWorkerSearchTypeChangeV22==='function') await window.onWorkerSearchTypeChangeV22(); }catch(e){}
    setTimeout(function(){
      try{ if(typeof window.runSearch==='function') window.runSearch(); else if(typeof runSearch==='function') runSearch(); }catch(err){ console.warn('quickSearchFromEntryV578 runSearch failed',err); }
      try{ var box=byId('summaryResults') || byId('searchResults'); if(box) box.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){}
    },120);
  };

  function iconHtml(kind,value,label){
    value=String(value||'').trim();
    if(!value) return '';
    var safe=value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    var arg=value.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');
    // v5.82: שומרים span נקי בלי מסגרת, אבל מוסיפים data attributes כדי שחיבור הלחיצה יהיה יציב ולא תלוי בכפתור.
    var dataValue=safe.replace(/&quot;/g,'&quot;');
    return '<span role="button" tabindex="0" class="quick-search-icon-v578 quick-search-link-v581" data-quick-search-click-v582="1" data-quick-kind-v582="'+kind+'" data-quick-value-v582="'+safe+'" title="חפש '+label+' בכל ההיסטוריה" onclick="quickSearchFromEntryV578(\''+kind+'\',\''+arg+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();quickSearchFromEntryV578(\''+kind+'\',\''+arg+'\');}">🔍</span>';
  }

  window.quickSearchLineV578=function(label,kind,value){
    value=String(value||'').trim();
    if(!value) return label+': ';
    var safe=value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    return label+': <span class="quick-search-value-v578">'+safe+'</span>'+iconHtml(kind,value,label);
  };

  function enhanceRenderedCards(root){
    root=root||document;
    try{
      root.querySelectorAll('.item-sub').forEach(function(el){
        if(el.getAttribute('data-quick-search-v578')==='1') return;
        var html=el.innerHTML;
        // v5.78: משדרגים שורות קיימות שנבנו לפני הפונקציה החדשה, בלי לשנות את מקור הנתונים.
        html=html.replace(/מספר לקוח:\s*([^<\n]+)(?:<br>|\\n|\n)/,function(m,val){
          val=String(val||'').replace(/<[^>]*>/g,'').trim();
          return window.quickSearchLineV578('מספר לקוח','customer',val)+'<br>';
        });
        html=html.replace(/כתובת:\s*([^<\n]+)(?:<br>|\\n|\n)/,function(m,val){
          val=String(val||'').replace(/<[^>]*>/g,'').trim();
          return window.quickSearchLineV578('כתובת','address',val)+'<br>';
        });
        el.innerHTML=html;
        el.setAttribute('data-quick-search-v578','1');
      });
    }catch(e){ console.warn('enhanceRenderedCards v5.78 failed',e); }
  }
  window.enhanceQuickSearchCardsV578=enhanceRenderedCards;


  // v5.82: חיבור לחיצה יציב לאייקון החיפוש הנקי.
  // הסיבה: אחרי שהחלפנו button ל-span כדי להסיר מסגרת, חלק מהדפדפנים/רינדורים לא הפעילו את ה-onclick בצורה עקבית.
  // הפתרון מפעיל את אותה פונקציית quickSearchFromEntryV578 הקיימת, בלי להוסיף חיפוש חדש ובלי לשנות נתונים.
  function handleQuickSearchIconV582(ev){
    try{
      var target = ev.target && ev.target.closest ? ev.target.closest('[data-quick-search-click-v582="1"], .quick-search-icon-v578, .quick-search-link-v581') : null;
      if(!target) return;
      var kind = target.getAttribute('data-quick-kind-v582');
      var value = target.getAttribute('data-quick-value-v582');
      if(!kind || !value){
        // fallback לרשומות ישנות שכבר נמצאות במסך ועדיין בנויות עם onclick בלבד.
        var on = target.getAttribute('onclick') || '';
        var m = on.match(/quickSearchFromEntryV578\('([^']+)'\s*,\s*'([^']*)'\)/);
        if(m){ kind = m[1]; value = m[2].replace(/\\'/g,"'").replace(/\\\\/g,'\\'); }
      }
      if(!kind || !value) return;
      ev.preventDefault();
      ev.stopPropagation();
      window.quickSearchFromEntryV578(kind, value);
    }catch(e){ console.warn('quick search click v5.82 failed', e); }
  }
  if(!window.__quickSearchClickV582Bound){
    document.addEventListener('click', handleQuickSearchIconV582, true);
    document.addEventListener('touchend', handleQuickSearchIconV582, true);
    window.__quickSearchClickV582Bound = true;
  }

  // v5.78: עוטפים את renderDay ואת renderSummary כדי שכל רינדור מחדש יקבל את האייקונים.
  try{
    if(typeof window.renderDay==='function' && !window.renderDay.__quickSearchV578){
      var oldRenderDay=window.renderDay;
      window.renderDay=function(){
        var res=oldRenderDay.apply(this,arguments);
        setTimeout(function(){ enhanceRenderedCards(byId('dayEntries')||document); },30);
        return res;
      };
      window.renderDay.__quickSearchV578=true;
    }
  }catch(e){}

  try{
    if(typeof window.renderSummary==='function' && !window.renderSummary.__quickSearchV578){
      var oldRenderSummary=window.renderSummary;
      window.renderSummary=function(){
        var res=oldRenderSummary.apply(this,arguments);
        setTimeout(function(){ enhanceRenderedCards(byId('searchResults')||document); },30);
        return res;
      };
      window.renderSummary.__quickSearchV578=true;
    }
  }catch(e){}

  function ensureCss(){
    if(byId('quickSearchCssV578')) return;
    var st=document.createElement('style');
    st.id='quickSearchCssV578';
    st.textContent='.quick-search-icon-v578,.quick-search-link-v581{display:inline!important;width:auto!important;height:auto!important;min-width:0!important;max-width:none!important;margin-inline-start:4px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;background-color:transparent!important;font-size:13px!important;line-height:1!important;cursor:pointer!important;vertical-align:baseline!important;box-shadow:none!important;transform:none!important;appearance:none!important;-webkit-appearance:none!important;color:inherit!important;pointer-events:auto!important;position:relative!important;z-index:2!important}.quick-search-icon-v578:hover,.quick-search-link-v581:hover{opacity:.75!important;box-shadow:none!important;transform:none!important;background:transparent!important}.quick-search-value-v578{font-weight:700}.wm-collapse-btn-v576,.wm-collapse-link-v581{display:inline!important;width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;background-color:transparent!important;box-shadow:none!important;outline:0!important;font-size:20px!important;line-height:1!important;cursor:pointer!important;color:inherit!important;appearance:none!important;-webkit-appearance:none!important}.wm-collapse-btn-v576:hover,.wm-collapse-link-v581:hover{opacity:.75!important;background:transparent!important;box-shadow:none!important}.wm-collapse-btn-v576:active,.wm-collapse-link-v581:active{transform:scale(.92)!important}';
    document.head.appendChild(st);
  }

  function updateVersionRows(){
    // v5.80: תיקון חשוב - לא מעדכנים יותר לגרסת 5.78 מקומית. כל תצוגת גרסה נלקחת רק מ-APP_VERSION.
    var currentVersion = String(window.APP_VERSION || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''));
    if(!currentVersion) return;
    try{ document.title='מעקב עבודה - גרסה '+currentVersion; }catch(e){}
    try{ document.querySelectorAll('[data-app-version],#appVersion,#versionLabel,.app-version-mini span,.app-version-footer span').forEach(function(el){ el.textContent=currentVersion; }); }catch(e){}
    try{ document.querySelectorAll('.secret,#secretTap').forEach(function(el){ el.textContent='גרסה '+currentVersion; }); }catch(e){}
  }

  function boot(){
    ensureCss();
    updateVersionRows();
    enhanceRenderedCards(document);
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,300); setTimeout(boot,1300); });
  window.addEventListener('load',function(){ setTimeout(boot,500); setTimeout(boot,1600); });
  setInterval(function(){ try{ ensureCss(); updateVersionRows(); enhanceRenderedCards(document); }catch(e){} },2500);
})();


/*
CHANGE 5.79 - CHROME-SAFE COLLAPSE + SMALLER QUICK SEARCH ICON
מטרה: לתקן מצב שבו בכרום אחרי העלאה ל-GitHub לחיצה על כיווץ כרטיסייה לא מגיבה,
ולהקטין את זכוכית המגדלת ליד מספר לקוח/כתובת בלי לשנות את מנגנון החיפוש.
*/
(function initChromeSafeCollapseAndIconV579(){
  'use strict';
  var STORAGE_PREFIX = 'wm_worker_tab_collapsed_v577_';
  var TARGET_PANES = {overview:1, tools:1, settings:1, dashboard:1, client:1, search:1};

  function paneKey(pane){ return pane && pane.getAttribute('data-worker-pane') || 'unknown'; }
  function findPaneFromButton(btn){
    var node = btn;
    while(node && node !== document){
      if(node.classList && node.classList.contains('worker-tab-pane-v420') && node.getAttribute('data-worker-pane')) return node;
      node = node.parentNode;
    }
    return null;
  }
  function applyCollapsed(pane, collapsed){
    if(!pane) return;
    var key = paneKey(pane);
    pane.classList.toggle('wm-card-collapsed-v576', !!collapsed);
    pane.classList.toggle('wm-tab-collapsed-v577', !!collapsed);
    var btn = pane.querySelector('.wm-collapse-btn-v576');
    if(btn){
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.title = collapsed ? 'פתח כרטיסייה' : 'כווץ כרטיסייה';
      btn.textContent = collapsed ? '▾' : '▴';
    }
    try{ localStorage.setItem(STORAGE_PREFIX + key, collapsed ? '1' : '0'); }catch(e){}
  }
  function makeSureBodyExists(pane){
    if(!pane || pane.querySelector(':scope > .wm-collapse-body-v576')) return;
    var header = pane.querySelector(':scope > .wm-tab-collapse-header-v577, :scope > .wm-collapse-header-v576');
    if(!header) return;
    var body = document.createElement('div');
    body.className = 'wm-collapse-body-v576';
    var node = header.nextSibling, move=[];
    while(node){ var next=node.nextSibling; move.push(node); node=next; }
    pane.appendChild(body);
    move.forEach(function(n){ body.appendChild(n); });
  }
  function refreshButtons(){
    document.querySelectorAll('.worker-tab-pane-v420[data-worker-pane]').forEach(function(pane){
      var key = paneKey(pane);
      if(!TARGET_PANES[key]) return;
      makeSureBodyExists(pane);
      var saved = '0';
      try{ saved = localStorage.getItem(STORAGE_PREFIX + key) || '0'; }catch(e){}
      applyCollapsed(pane, saved === '1');
    });
  }
  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('.wm-collapse-btn-v576') : null;
    if(!btn) return;
    var pane = findPaneFromButton(btn);
    if(!pane) return;
    var key = paneKey(pane);
    if(!TARGET_PANES[key]) return;
    ev.preventDefault();
    ev.stopPropagation();
    makeSureBodyExists(pane);
    applyCollapsed(pane, !pane.classList.contains('wm-card-collapsed-v576'));
  }, true);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(refreshButtons,150); setTimeout(refreshButtons,900); });
  else { setTimeout(refreshButtons,150); setTimeout(refreshButtons,900); }
  window.addEventListener('load', function(){ setTimeout(refreshButtons,250); setTimeout(refreshButtons,1200); });
  window.fixWorkerTabCollapseV579 = refreshButtons;
})();


/* ==========================================================================
CHANGELOG 5.85 - הצגת סיסמה ונעילת יום ב-Firestore
1. נוסף אייקון עין במסכי כניסת עובד ומנהל להצגה/הסתרה של הסיסמה בלי שינוי בלוגיקת ההתחברות.
2. נוסף מנעול ליד כלי היום; מצב locked נשמר במסמך היום הקיים ב-workerDaysOff, ללא Collection חדשה.
3. אם locked אינו קיים או אינו true, היום פתוח כברירת מחדל כדי לשמור תאימות מלאה לכל הנתונים הישנים.
4. יום נעול נשאר גלוי לקריאה, אך פעולות שמירה, עריכה, מחיקה, שינוי סטטוס, שינוי תאריך ויום חופש נחסמות גם בממשק וגם בפונקציות.
5. טעינת ימי חופש עודכנה להתעלם ממסמכי נעילה בלבד, וייצוא Excel מסווג בנפרד יום חופש ויום נעול.
=========================================================================== */
/* v5.90 DEBUG: חלון אבחון זמני לנעילת יום. הלוג נשמר גם לאחר רענון. */
(function initDayLockDebugV590(){
  'use strict';
  var KEY='wmDayLockDebugV590';
  function now(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }
  function safe(v){
    try{
      if(v instanceof Error) return {name:v.name,message:v.message,code:v.code||'',stack:v.stack||''};
      if(v && typeof v==='object') return JSON.parse(JSON.stringify(v,function(k,val){
        if(val && typeof val.toDate==='function'){try{return val.toDate().toISOString();}catch(e){return String(val);}}
        return val;
      }));
      return v;
    }catch(e){return String(v);}
  }
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){return [];} }
  function write(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-400)));}catch(e){} }
  function render(){
    var pre=document.getElementById('dayLockDebugLogV590'); if(!pre)return;
    var rows=read();
    pre.textContent=rows.map(function(r){return '['+r.time+'] '+r.event+(r.data!==undefined?'\n'+JSON.stringify(r.data,null,2):'');}).join('\n\n')||'אין עדיין נתוני דיבאג';
    pre.scrollTop=pre.scrollHeight;
  }
  window.dayLockDebugV590=function(event,data){
    var rows=read(); rows.push({time:now(),event:String(event||''),data:safe(data)}); write(rows); render();
    try{console.log('[DAY-LOCK DEBUG]',event,data);}catch(e){}
  };
  window.copyDayLockDebugV590=async function(){
    var text=(document.getElementById('dayLockDebugLogV590')||{}).textContent||'';
    try{await navigator.clipboard.writeText(text); alert('לוג הדיבאג הועתק.');}
    catch(e){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('לוג הדיבאג הועתק.');}
  };
  window.clearDayLockDebugV590=function(){try{localStorage.removeItem(KEY);}catch(e){} render();};
  window.showDayLockDebugV591=function(){
    try{localStorage.setItem('wmDayLockDebugVisibleV591','1');}catch(e){}
    var box=document.getElementById('dayLockDebugPanelV590'); if(box){box.hidden=false;box.style.removeProperty('display');box.classList.add('is-visible-v591');}
  };
  window.hideDayLockDebugV591=function(){
    try{localStorage.removeItem('wmDayLockDebugVisibleV591');}catch(e){}
    var box=document.getElementById('dayLockDebugPanelV590'); if(box){box.classList.remove('is-visible-v591');box.hidden=true;box.style.setProperty('display','none','important');}
  };
  function build(){
    if(document.getElementById('dayLockDebugPanelV590')){render();return;}
    var box=document.createElement('section'); box.id='dayLockDebugPanelV590'; box.className='day-lock-debug-v590';
    // v5.92: hide before insertion so Chrome/WebView cannot paint the panel for even one frame.
    box.hidden=true;
    box.style.setProperty('display','none','important');
    box.innerHTML='<div class="day-lock-debug-head-v590"><strong>🧪 דיבאג נעילת יום</strong><div><button type="button" onclick="copyDayLockDebugV590()">העתק</button><button type="button" onclick="clearDayLockDebugV590()">נקה</button><button type="button" onclick="this.closest(\'.day-lock-debug-v590\').classList.toggle(\'is-minimized\')">מזער</button><button type="button" onclick="hideDayLockDebugV591()">סגור</button></div></div><pre id="dayLockDebugLogV590"></pre>';
    document.body.appendChild(box);
    var enabled=false;
    try{
      // v5.92: old persisted visibility caused a flash on startup; debug is now explicit per URL only.
      localStorage.removeItem('wmDayLockDebugVisibleV591');
      enabled=new URLSearchParams(location.search).get('dayLockDebug')==='1';
    }catch(e){}
    if(enabled){
      box.hidden=false;
      box.style.removeProperty('display');
      box.classList.add('is-visible-v591');
    }
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
  window.addEventListener('load',function(){build();
    var authInfo={available:typeof auth!=='undefined'&&!!auth,currentUser:null};
    try{authInfo.currentUser=auth&&auth.currentUser?{uid:auth.currentUser.uid,email:auth.currentUser.email||'',isAnonymous:auth.currentUser.isAnonymous}:null;}catch(e){authInfo.error=safe(e);}
    window.dayLockDebugV590('PAGE_LOAD',{url:location.href,userAgent:navigator.userAgent,online:navigator.onLine,auth:authInfo});
    try{if(typeof auth!=='undefined'&&auth&&auth.onAuthStateChanged)auth.onAuthStateChanged(function(u){window.dayLockDebugV590('AUTH_STATE_CHANGED',u?{uid:u.uid,email:u.email||'',isAnonymous:u.isAnonymous}:null);});}catch(e){window.dayLockDebugV590('AUTH_LISTENER_ERROR',e);}
  });
})();

(function initPasswordAndDayLockV585(){
  'use strict';
  var VERSION=APP_VERSION;
  var lockedDays=new Set();
  var loadedWorkerId='';

  function byId(id){ return document.getElementById(id); }
  function currentWorkerId(){
    try{ if(typeof viewedWorker!=='undefined' && viewedWorker && viewedWorker.id) return String(viewedWorker.id); }catch(e){}
    try{ if(typeof session!=='undefined' && session && session.workerId) return String(session.workerId); }catch(e){}
    return '';
  }
  function currentWorkerNameV585(){
    try{ if(typeof viewedWorker!=='undefined' && viewedWorker && viewedWorker.name) return String(viewedWorker.name); }catch(e){}
    return '';
  }
  function safeDocId(workerId,date){
    return String(workerId||'worker').replace(/[^a-zA-Z0-9_\-א-ת]/g,'_')+'_'+String(date||'date').replace(/[^0-9]/g,'_');
  }
  function monthRange(){
    var d=(typeof calendarDate!=='undefined' && calendarDate) ? calendarDate : new Date();
    var y=d.getFullYear(),m=d.getMonth(),last=new Date(y,m+1,0).getDate();
    function p(n){return String(n).padStart(2,'0');}
    return {start:y+'-'+p(m+1)+'-01',end:y+'-'+p(m+1)+'-'+p(last)};
  }
  function isLocked(date){ return !!date && lockedDays.has(String(date)); }
  window.isDayLockedV585=isLocked;

  // v5.85: הצגת/הסתרת הסיסמה משנה רק type של שדה הקלט ולא נוגעת באימות.
  window.togglePasswordVisibilityV585=function(inputId,button){
    var input=byId(inputId); if(!input) return;
    var reveal=input.type==='password';
    input.type=reveal?'text':'password';
    if(button){
      // v5.89: SVG פנימי במקום אימוג׳י, כדי שהעין תוצג באופן זהה גם בכרום.
      button.innerHTML=reveal
        ? '<svg class="password-eye-svg-v589" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18" class="eye-slash-v589"></path><path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17.3 17.3 0 0 1-3.1 3.7"></path><path d="M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3-.5"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>'
        : '<svg class="password-eye-svg-v589" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle></svg>';
      button.setAttribute('aria-pressed',reveal?'true':'false');
      button.setAttribute('aria-label',reveal?'הסתר סיסמה':'הצג סיסמה');
      button.title=reveal?'הסתר סיסמה':'הצג סיסמה';
    }
    try{ input.focus({preventScroll:true}); }catch(e){ try{input.focus();}catch(_e){} }
  };

  function waitForLockAuthV588(timeoutMs){
    timeoutMs=Number(timeoutMs||5000);
    return new Promise(function(resolve){
      try{
        if(typeof auth==='undefined'||!auth||typeof auth.onAuthStateChanged!=='function') return resolve(null);
        if(auth.currentUser) return resolve(auth.currentUser);
        var finished=false,unsub=null;
        var timer=setTimeout(function(){
          if(finished)return; finished=true;
          try{if(unsub)unsub();}catch(e){}
          resolve(auth.currentUser||null);
        },timeoutMs);
        unsub=auth.onAuthStateChanged(function(user){
          if(finished||!user)return;
          finished=true; clearTimeout(timer);
          try{if(unsub)unsub();}catch(e){}
          resolve(user);
        });
      }catch(e){resolve(null);}
    });
  }

  async function loadLocks(){
    var workerId=currentWorkerId();
    window.dayLockDebugV590&&window.dayLockDebugV590('LOAD_LOCKS_START',{workerId:workerId,viewedWorker:(typeof viewedWorker!=='undefined'&&viewedWorker)?{id:viewedWorker.id||'',name:viewedWorker.name||''}:null,session:(typeof session!=='undefined'&&session)?{workerId:session.workerId||'',username:session.username||''}:null,calendarDate:(typeof calendarDate!=='undefined'&&calendarDate)?String(calendarDate):null});
    // v5.88: בזמן שחזור התחברות viewedWorker/session עשויים עדיין לא להיות מוכנים.
    // לא מוחקים את המטמון בגלל מצב זמני כזה, אלא ממתינים לקריאה הבאה לאחר טעינת העובד.
    if(!workerId){ window.dayLockDebugV590&&window.dayLockDebugV590('LOAD_LOCKS_ABORT_NO_WORKER',{cached:Array.from(lockedDays)}); return lockedDays; }
    var range=monthRange(), next=new Set();
    try{
      // v5.88: לאחר רענון Firebase Auth משחזר את המשתמש באופן אסינכרוני.
      // המתנה קצרה מונעת קריאת Firestore מוקדמת שנכשלת ואז מציגה בטעות יום פתוח.
      var authUser=await waitForLockAuthV588(5500);
      window.dayLockDebugV590&&window.dayLockDebugV590('LOAD_LOCKS_AUTH_READY',authUser?{uid:authUser.uid,email:authUser.email||''}:null);
      var snap=await db.collection('workerDaysOff').where('workerId','==',workerId).get();
      window.dayLockDebugV590&&window.dayLockDebugV590('LOAD_LOCKS_QUERY_RESULT',{workerId:workerId,size:snap.size,docs:snap.docs.map(function(d){var x=d.data()||{};return{id:d.id,date:x.date||'',locked:x.locked,active:x.active,type:x.type||'',workerId:x.workerId||'',authUid:x.authUid||''};})});
      snap.docs.forEach(function(doc){
        var data=doc.data()||{},date=String(data.date||'');
        if(data.locked===true && date>=range.start && date<=range.end) next.add(date);
      });
      lockedDays=next; loadedWorkerId=workerId;
      window.dayLockDebugV590&&window.dayLockDebugV590('LOAD_LOCKS_SUCCESS',{workerId:workerId,range:range,lockedDays:Array.from(lockedDays)});
    }catch(err){
      console.error('v5.88 day lock load failed',err);
      window.dayLockDebugV590&&window.dayLockDebugV590('LOAD_LOCKS_ERROR',err);
      // v5.88: אין לאפס נעילות שכבר נטענו בגלל כשל רשת/אימות זמני.
      // כך לא נוצר מצב מסוכן שבו יום נעול נראה פתוח רק בגלל רענון או Offline רגעי.
    }
    return lockedDays;
  }
  window.loadDayLocksV585=loadLocks;

  // v5.91: לאחר רענון Firebase Auth מוכן לפני viewedWorker/session.
  // ממתינים למזהה העובד האמיתי ורק אז טוענים את הנעילות ומרנדרים מחדש.
  var workerReadyLoadPromiseV591=null;
  async function loadLocksWhenWorkerReadyV591(timeoutMs){
    if(workerReadyLoadPromiseV591) return workerReadyLoadPromiseV591;
    workerReadyLoadPromiseV591=(async function(){
      var started=Date.now(),workerId='';
      timeoutMs=Number(timeoutMs||12000);
      while(!(workerId=currentWorkerId()) && Date.now()-started<timeoutMs){
        await new Promise(function(resolve){setTimeout(resolve,120);});
      }
      if(!workerId){
        window.dayLockDebugV590&&window.dayLockDebugV590('WORKER_READY_TIMEOUT',{timeoutMs:timeoutMs});
        return false;
      }
      window.dayLockDebugV590&&window.dayLockDebugV590('WORKER_READY',{workerId:workerId});
      await loadLocks();
      try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof renderDay==='function')renderDay();}catch(e){}
      return true;
    })();
    try{return await workerReadyLoadPromiseV591;}
    finally{workerReadyLoadPromiseV591=null;}
  }
  window.loadLocksWhenWorkerReadyV591=loadLocksWhenWorkerReadyV591;

  async function persistLock(date,locked){
    var workerId=currentWorkerId();
    window.dayLockDebugV590&&window.dayLockDebugV590('PERSIST_START',{date:date,locked:locked,workerId:workerId,docId:safeDocId(workerId,date)});
    if(!workerId||!date) throw new Error('לא זוהה עובד או תאריך');
    var persistAuthUser=await waitForLockAuthV588(5500);
    window.dayLockDebugV590&&window.dayLockDebugV590('PERSIST_AUTH_READY',persistAuthUser?{uid:persistAuthUser.uid,email:persistAuthUser.email||''}:null);
    var ref=db.collection('workerDaysOff').doc(safeDocId(workerId,date));
    var snap=await ref.get();
    var payload={
      workerId:workerId,
      workerName:currentWorkerNameV585(),
      authUid:(typeof auth!=='undefined'&&auth&&auth.currentUser)?auth.currentUser.uid:'',
      date:String(date),
      locked:locked===true,
      lockUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),
      appVersion:VERSION,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    // v5.85: במסמך חדש בלבד מסמנים שמדובר במצב נעילה, כדי שלא ייטען בטעות כיום חופש.
    if(!snap.exists){
      payload.type='dayLock';
      payload.active=false;
      payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    }
    window.dayLockDebugV590&&window.dayLockDebugV590('PERSIST_PAYLOAD',payload);
    await ref.set(payload,{merge:true});
    window.dayLockDebugV590&&window.dayLockDebugV590('PERSIST_SET_OK',{docId:safeDocId(workerId,date)});
    // v5.88: מאמתים שהערך אכן נשמר בשרת/מטמון Firestore לפני עדכון הממשק.
    var verify=await ref.get();
    window.dayLockDebugV590&&window.dayLockDebugV590('PERSIST_VERIFY',verify.exists?{id:verify.id,data:verify.data()}:{exists:false});
    if(!verify.exists || (verify.data()||{}).locked!==(locked===true)) throw new Error('מצב הנעילה לא אומת לאחר השמירה');
  }

  window.toggleDayLockV585=async function(date){
    date=String(date||''); if(!date) return;
    var next=!isLocked(date);
    // v5.86: נעילה/פתיחה מתבצעת מיד ללא Message Box מיותר.
    try{
      window.dayLockDebugV590&&window.dayLockDebugV590('TOGGLE_CLICK',{date:date,current:isLocked(date),next:next});
      await persistLock(date,next);
      if(next) lockedDays.add(date); else lockedDays.delete(date);
      window.dayLockDebugV590&&window.dayLockDebugV590('TOGGLE_UI_UPDATED',{date:date,lockedDays:Array.from(lockedDays)});
      if(typeof renderDay==='function') renderDay();
    }catch(err){
      window.dayLockDebugV590&&window.dayLockDebugV590('TOGGLE_ERROR',err);
      alert('לא הצלחתי לשמור את מצב נעילת היום ב-Firebase.\nשגיאה: '+((err&&err.message)||err));
    }
  };

  function lockButtonHtml(date,locked){
    var safe=String(date).replace(/'/g,"\\'");
    return '<button type="button" class="btn-light day-lock-btn-v585 '+(locked?'is-locked':'')+'" data-day-lock-control-v585="1" onclick="toggleDayLockV585(\''+safe+'\')" title="'+(locked?'בטל נעילת יום':'נעל את היום')+'">'+(locked?'🔒 יום נעול — פתח':'🔓 נעל יום')+'</button>';
  }
  function injectLockUi(){
    if(typeof selectedDate==='undefined'||!selectedDate) return;
    var title=byId('dateTitle'); if(!title) return;
    var holder=byId('dayLockToolsV585');
    if(!holder){
      holder=document.createElement('div'); holder.id='dayLockToolsV585'; holder.className='day-lock-tools-v585';
      if(title.parentNode) title.parentNode.insertBefore(holder,title.nextSibling);
    }
    var locked=isLocked(selectedDate);
    holder.innerHTML=lockButtonHtml(selectedDate,locked);
    var panel=byId('dayPanel'); if(panel) panel.classList.toggle('day-locked-v585',locked);
    var oldNotice=byId('dayLockNoticeV585'); if(oldNotice) oldNotice.remove();
    if(locked){
      var notice=document.createElement('div'); notice.id='dayLockNoticeV585'; notice.className='day-lock-notice-v585';
      notice.textContent='🔒 היום נעול. אפשר לצפות בכל המידע, אך כדי לבצע שינוי צריך לפתוח את הנעילה.';
      holder.insertAdjacentElement('afterend',notice);
      var edit=byId('editEntryPanel'); if(edit) edit.classList.add('hidden');
    }
    applyUiLock(locked);
  }

  function applyUiLock(locked){
    var panel=byId('dayPanel'); if(!panel) return;
    var controls=panel.querySelectorAll('#entryForm input,#entryForm select,#entryForm textarea,#entryForm button,#dayEntries button,#dayOffToolsV437 button');
    controls.forEach(function(el){
      if(el.hasAttribute('data-day-lock-control-v585')) return;
      if(locked){
        if(!el.hasAttribute('data-was-disabled-v585')) el.setAttribute('data-was-disabled-v585',el.disabled?'1':'0');
        el.disabled=true; el.setAttribute('aria-disabled','true');
      }else{
        var was=el.getAttribute('data-was-disabled-v585');
        if(was!==null){ el.disabled=was==='1'; el.removeAttribute('data-was-disabled-v585'); }
        el.removeAttribute('aria-disabled');
      }
    });
  }

  function lockedMessage(){
    var msg=byId('entryMsg');
    if(msg) msg.innerHTML='<p class="danger">🔒 היום נעול. פתח את הנעילה כדי לבצע שינוי.</p>';
    else alert('🔒 היום נעול. פתח את הנעילה כדי לבצע שינוי.');
  }
  function entryDateFromId(id){
    try{
      var list=(typeof monthEntries!=='undefined'&&Array.isArray(monthEntries))?monthEntries:[];
      var entry=list.find(function(e){return e&&String(e.id)===String(id);});
      return entry&&entry.date?String(entry.date):'';
    }catch(e){return '';}
  }
  function guardDate(date){ if(date&&isLocked(date)){lockedMessage();return true;} return false; }

  function wrap(name,dateResolver){
    var original=window[name];
    if(typeof original!=='function'||original.__dayLockV585) return;
    var wrapped=function(){
      var date=''; try{date=dateResolver?dateResolver.apply(this,arguments):(typeof selectedDate!=='undefined'?selectedDate:'');}catch(e){}
      if(guardDate(date)) return false;
      return original.apply(this,arguments);
    };
    wrapped.__dayLockV585=true; wrapped.__originalV585=original; window[name]=wrapped;
  }
  function installGuards(){
    ['addService','addInstall','addServicePlannedV49','addInstallPlannedV49','setVacationDayV437','setVacationDayV439','setVacationDayV46','setVacationDayV47','setVacationDayV473','setVacationDayV486','setVacationDayV487','setVacationDayV489'].forEach(function(n){wrap(n,function(){return typeof selectedDate!=='undefined'?selectedDate:'';});});
    ['deleteEntry','openEntryEdit','markEntryDoneV49','openNotDoneModalV529','restorePlannedV529','changeEntryDateV537'].forEach(function(n){wrap(n,function(id){return entryDateFromId(id);});});
    wrap('saveEntryEdit',function(){var id=byId('editEntryId');return entryDateFromId(id&&id.value);});
    // ביטול יום חופש הוא שינוי של אותו יום ולכן גם הוא דורש פתיחת נעילה.
    ['cancelVacationDayV437','cancelVacationDayV439','cancelVacationDayV487','cancelVacationDayV489'].forEach(function(n){wrap(n,function(date){return String(date||'');});});
  }

  var originalRenderDay=window.renderDay;
  if(typeof originalRenderDay==='function'&&!originalRenderDay.__dayLockV585){
    window.renderDay=function(){
      var result=originalRenderDay.apply(this,arguments);
      try{injectLockUi();}catch(e){console.warn('v5.85 lock UI failed',e);}
      return result;
    };
    window.renderDay.__dayLockV585=true;
  }

  var originalLoadMonth=window.loadMonth;
  if(typeof originalLoadMonth==='function'&&!originalLoadMonth.__dayLockV585){
    window.loadMonth=async function(){
      var result=await originalLoadMonth.apply(this,arguments);
      await loadLocks();
      try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof renderDay==='function')renderDay();}catch(e){}
      return result;
    };
    window.loadMonth.__dayLockV585=true;
  }

  function updateChangelog(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function'||old.__v585Wrapped) return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.85';})) rows.unshift({version:'5.85',title:'הצגת סיסמה ונעילת יום',createdAt:'2026-07-15',items:[
        'נוסף אייקון עין במסכי כניסת עובד ומנהל להצגה או הסתרה של הסיסמה.',
        'נוסף מנעול יום שנשמר ב-Firebase במסמך היום הקיים, ללא Collection חדשה.',
        'יום ללא locked:true נשאר פתוח כברירת מחדל ותואם לכל הנתונים הישנים.',
        'יום נעול נשאר גלוי לצפייה, אך פעולות שינוי נחסמות בממשק וברמת הפונקציות.',
        'טעינת ימי חופש וייצוא Excel עודכנו כך שמסמך נעילה בלבד אינו נספר כיום חופש.'
      ]});
      return rows;
    };
    wrapped.__v585Wrapped=true; window.requiredChangelogRows=wrapped;
  }

  function boot(){
    installGuards(); updateChangelog();
    loadLocksWhenWorkerReadyV591(15000);
  }
  // v5.91: כל שינוי במצב האימות מפעיל ניסיון טעינה נוסף; הפונקציה עצמה ממתינה ל-workerId.
  try{
    if(typeof auth!=='undefined'&&auth&&typeof auth.onAuthStateChanged==='function'){
      auth.onAuthStateChanged(function(user){if(user)setTimeout(function(){loadLocksWhenWorkerReadyV591(15000);},0);});
    }
  }catch(e){}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,450);});
  else setTimeout(boot,100);
  window.addEventListener('load',function(){setTimeout(boot,700);});
})();


/* ==========================================================================
CHANGELOG 5.86 - השלמת נעילת יום והקטנת אייקון העין
1. אייקון העין במסכי הכניסה הוקטן בלי לשנות את שדה הסיסמה או לוגיקת ההתחברות.
2. הוסר חלון האישור בעת נעילת יום; הלחיצה נועלת או פותחת מיד ושומרת ב-Firestore.
3. כרטיסי "קריאת שירות" ו"התקנה" נחסמים לחלוטין ביום נעול, גם משום שהם div עם onclick ולא כפתורי button רגילים.
4. נוספה חסימת אירוע מרכזית שמונעת פתיחת טפסי עבודה ביום נעול גם אם קוד אחר מנסה להפעיל את הכרטיסים.
5. נוסף אייקון מנעול קטן בתוך התא המתאים בלוח השנה לכל יום נעול.
=========================================================================== */
(function completeDayLockV586(){
  'use strict';

  function byIdV586(id){return document.getElementById(id);}
  function selectedDateV586(){
    try{return (typeof selectedDate!=='undefined'&&selectedDate)?String(selectedDate):'';}catch(e){return '';}
  }
  function isLockedV586(date){
    try{return typeof window.isDayLockedV585==='function' && window.isDayLockedV585(String(date||''));}catch(e){return false;}
  }

  function applyTypeCardsLockV586(){
    var panel=byIdV586('dayPanel');
    if(!panel) return;
    var locked=isLockedV586(selectedDateV586());
    panel.classList.toggle('day-locked-v586',locked);
    ['serviceBtn','installBtn'].forEach(function(id){
      var card=byIdV586(id); if(!card) return;
      card.setAttribute('aria-disabled',locked?'true':'false');
      card.setAttribute('tabindex',locked?'-1':'0');
      if(locked) card.setAttribute('data-day-lock-disabled-v586','1');
      else card.removeAttribute('data-day-lock-disabled-v586');
    });
  }

  function decorateCalendarLocksV586(){
    var cal=byIdV586('calendar');
    if(!cal) return;
    var d;
    try{d=(typeof calendarDate!=='undefined'&&calendarDate)?calendarDate:new Date();}catch(e){d=new Date();}
    var y=d.getFullYear(),m=d.getMonth()+1;
    Array.from(cal.querySelectorAll('.day:not(.empty)')).forEach(function(cell){
      var numEl=cell.querySelector('.day-num');
      var n=numEl?parseInt(numEl.textContent,10):NaN;
      if(!Number.isFinite(n)) return;
      var date=y+'-'+String(m).padStart(2,'0')+'-'+String(n).padStart(2,'0');
      var locked=isLockedV586(date);
      cell.classList.toggle('day-locked-calendar-v586',locked);
      var icon=cell.querySelector('.day-lock-calendar-icon-v586');
      if(locked&&!icon){
        icon=document.createElement('span');
        icon.className='day-lock-calendar-icon-v586';
        icon.textContent='🔒';
        icon.title='יום נעול';
        icon.setAttribute('aria-label','יום נעול');
        cell.appendChild(icon);
      }else if(!locked&&icon){icon.remove();}
    });
  }

  // חסימה אמיתית לפני onclick של כרטיסי סוג העבודה.
  document.addEventListener('click',function(ev){
    var card=ev.target&&ev.target.closest?ev.target.closest('#serviceBtn,#installBtn'):null;
    if(!card) return;
    if(!isLockedV586(selectedDateV586())) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
    applyTypeCardsLockV586();
  },true);

  var previousRenderDayV586=window.renderDay;
  if(typeof previousRenderDayV586==='function'&&!previousRenderDayV586.__v586){
    window.renderDay=function(){
      var out=previousRenderDayV586.apply(this,arguments);
      try{applyTypeCardsLockV586();}catch(e){}
      return out;
    };
    window.renderDay.__v586=true;
  }

  var previousRenderCalendarV586=window.renderCalendar;
  if(typeof previousRenderCalendarV586==='function'&&!previousRenderCalendarV586.__v586){
    window.renderCalendar=function(){
      var out=previousRenderCalendarV586.apply(this,arguments);
      try{decorateCalendarLocksV586();}catch(e){}
      return out;
    };
    window.renderCalendar.__v586=true;
  }

  var previousToggleV586=window.toggleDayLockV585;
  if(typeof previousToggleV586==='function'&&!previousToggleV586.__v586){
    window.toggleDayLockV585=async function(date){
      var out=await previousToggleV586.apply(this,arguments);
      try{applyTypeCardsLockV586();decorateCalendarLocksV586();}catch(e){}
      return out;
    };
    window.toggleDayLockV585.__v586=true;
  }

  function updateChangelogV586(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function'||old.__v586Wrapped) return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.92';})) rows.unshift({version:'5.92',title:'מניעת הבהוב חלון הדיבאג בזמן טעינה',createdAt:'2026-07-15',items:[
        'חלון דיבאג נעילת היום מוסתר לפני הכנסתו למסמך ולכן אינו מופיע לרגע בזמן טעינת האפליקציה.',
        'מצב תצוגה ישן שנשמר בדפדפן מנוקה אוטומטית.',
        'הדיבאג נפתח רק באמצעות ?dayLockDebug=1 ואינו נשאר פתוח לאחר רענון רגיל.',
        'לוגיקת נעילת היום והטעינה מ-Firestore נשארה ללא שינוי.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.91';})) rows.unshift({version:'5.91',title:'תיקון טעינת נעילת יום לאחר רענון',createdAt:'2026-07-15',items:[
        'המערכת ממתינה למזהה העובד לאחר שחזור ההתחברות ורק אז טוענת את הנעילות מ-Firestore.',
        'לאחר טעינת הנעילות מתבצע רינדור מחודש של לוח השנה ושל היום הנבחר.',
        'חלון הדיבאג נשאר זמין לשימוש עתידי אך מוסתר כברירת מחדל.',
        'ניתן להפעיל את הדיבאג בעת הצורך באמצעות הוספת ?dayLockDebug=1 לכתובת.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.88';})) rows.unshift({version:'5.88',title:'תיקון שמירת נעילת יום לאחר רענון',createdAt:'2026-07-15',items:[
        'טעינת נעילות היום ממתינה לשחזור Firebase Auth לאחר רענון לפני קריאת Firestore.',
        'כשל זמני באימות או ברשת אינו מאפס עוד את רשימת הימים הנעולים ומציג אותם כפתוחים.',
        'שמירת נעילה כוללת authUid ואימות קריאה חוזרת כדי לוודא שהמצב באמת נשמר.',
        'לוגיקת החסימה, מיקום המנעול ועיצוב אייקון העין נשארו ללא שינוי.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.87';})) rows.unshift({version:'5.87',title:'תיקון אייקון העין ומיקום המנעול בלוח השנה',createdAt:'2026-07-15',items:[
        'אייקון העין בכניסת עובד הוקטן והותאם לגודל של אייקון העין בכניסת מנהל.',
        'אייקון המנעול בלוח השנה הוקטן והועבר לפינה השמאלית העליונה כדי שלא יסתיר את מספר היום.',
        'לא בוצע שינוי בלוגיקת ההתחברות, נעילת היום או חסימת הפעולות.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.86';})) rows.unshift({version:'5.86',title:'השלמת נעילת יום והקטנת אייקון העין',createdAt:'2026-07-15',items:[
        'אייקון העין במסכי הכניסה הוקטן.',
        'חלון האישור בעת נעילת יום הוסר והפעולה מתבצעת מיד.',
        'כרטיסי קריאת שירות והתקנה אינם פעילים ביום נעול.',
        'נוספה חסימת לחיצה אמיתית לכרטיסי סוג העבודה.',
        'נוסף אייקון מנעול בתא של יום נעול בלוח השנה.'
      ]});
      return rows;
    };
    wrapped.__v586Wrapped=true;
    window.requiredChangelogRows=wrapped;
  }

  function bootV586(){
    updateChangelogV586();
    try{applyTypeCardsLockV586();decorateCalendarLocksV586();}catch(e){}
    try{if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
    try{if(typeof enforceAppVersionUI==='function')enforceAppVersionUI();}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bootV586,550);});
  else setTimeout(bootV586,120);
  window.addEventListener('load',function(){setTimeout(bootV586,850);});
})();


/* ===== v5.94: שבת אינה נבחרת; פתיחה בשבת עוברת ליום ראשון ===== */
function initialCalendarDateV594(){
  const d=new Date();
  d.setHours(12,0,0,0);
  if(d.getDay()===6) d.setDate(d.getDate()+1);
  return d;
}
function isSaturdayDateV594(value){
  try{
    if(!value) return false;
    const d=(typeof parseDate==='function')?parseDate(value):new Date(String(value)+'T12:00:00');
    return d instanceof Date && !Number.isNaN(d.getTime()) && d.getDay()===6;
  }catch(e){ return false; }
}
(function installSaturdayGuardsV594(){
  // הגנה על בחירת יום: גם קריאה עקיפה אינה יכולה לבחור שבת.
  const oldSelect=window.selectDay;
  if(typeof oldSelect==='function' && !oldSelect.__v594){
    window.selectDay=function(ds){
      if(isSaturdayDateV594(ds)) return false;
      return oldSelect.apply(this,arguments);
    };
    window.selectDay.__v594=true;
    try{ selectDay=window.selectDay; }catch(e){}
  }

  // חסימת כרטיסי יצירה לפני כל onclick אחר.
  document.addEventListener('click',function(ev){
    const card=ev.target&&ev.target.closest?ev.target.closest('#serviceBtn,#installBtn'):null;
    if(!card || !isSaturdayDateV594(selectedDate)) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
  },true);

  // שכבת הגנה אחרונה לפני כתיבה ל-Firestore.
  ['addService','addInstall'].forEach(function(name){
    const old=window[name];
    if(typeof old!=='function'||old.__v594) return;
    window[name]=async function(){
      if(isSaturdayDateV594(selectedDate)) return false;
      return old.apply(this,arguments);
    };
    window[name].__v594=true;
    try{ if(name==='addService') addService=window[name]; else addInstall=window[name]; }catch(e){}
  });

  // “מה חדש” 5.94 — הזרעה רק אם הרשומה חסרה.
  const oldRows=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v594){
    const wrapped=function(){
      let rows=[]; try{ rows=oldRows.apply(this,arguments)||[]; }catch(e){}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.94';})){
        rows.unshift({version:'5.94',title:'שבת לא לחיצה ופתיחה אוטומטית על יום ראשון',createdAt:'2026-07-18',items:[
          'כאשר האפליקציה נפתחת בשבת, היא עוברת אוטומטית ליום ראשון הקרוב.',
          'יום שבת בלוח השנה אינו לחיץ ואינו ניתן לבחירה.',
          'נוספה חסימה פנימית שמונעת פתיחת קריאת שירות, התקנה או שמירה בשבת גם דרך מסלול עקיף.',
          'לא שונתה לוגיקת נעילת היום או שאר המערכת.'
        ]});
      }
      return rows;
    };
    wrapped.__v594=true;
    window.requiredChangelogRows=wrapped;
    try{ requiredChangelogRows=wrapped; }catch(e){}
  }
})();


/* ==========================================================================
CHANGELOG 5.99 - תיקון ניווט דו-שלבי לפק״ע בתוך חלון הגלילה
1. הניווט גולל תחילה את הדף הראשי עד אזור "עבודות ביום הזה".
2. לאחר מכן הוא גולל בתוך חלון הפק״עות וממרכז את הכרטיס המדויק.
3. בסיום מתבצע יישור נוסף של הדף כדי שהפק״ע עצמה תהיה במרכז המסך.
4. התיקון חל על חיפוש, תוצאות קרובות, מתוזמנות, בוצעו ולא בוצעו דרך מנגנון הניווט האחיד.
=========================================================================== */
(function dayEntriesScrollAndUnifiedNavigationV599(){
  'use strict';

  function waitV599(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

  function parseDateV599(value){
    var p=String(value||'').split('-').map(Number);
    if(p.length!==3 || !p[0] || !p[1] || !p[2]) return null;
    return new Date(p[0],p[1]-1,1);
  }

  function findEntryCardV599(entryId){
    var target=null;
    try{
      document.querySelectorAll('#dayEntries [data-entry-id]').forEach(function(el){
        if(!target && String(el.getAttribute('data-entry-id')||'')===String(entryId)) target=el;
      });
    }catch(e){}
    return target;
  }

  async function scrollPageToEntriesV599(container){
    if(!container) return;
    try{
      container.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
      await waitV599(420);
    }catch(e){
      try{container.scrollIntoView({block:'center'});}catch(_e){}
      await waitV599(80);
    }
  }

  async function centerCardInsideContainerV599(container,target){
    if(!container || !target || !container.contains(target)) return false;
    if(container.scrollHeight>container.clientHeight+4){
      try{
        var cRect=container.getBoundingClientRect();
        var tRect=target.getBoundingClientRect();
        var next=container.scrollTop+(tRect.top-cRect.top)-(container.clientHeight/2)+(tRect.height/2);
        var max=Math.max(0,container.scrollHeight-container.clientHeight);
        container.scrollTo({top:Math.max(0,Math.min(max,next)),behavior:'smooth'});
        await waitV599(420);
        return true;
      }catch(e){}
    }
    return false;
  }

  async function centerTargetInViewportV599(target){
    if(!target) return;
    try{
      var rect=target.getBoundingClientRect();
      var viewportHeight=window.innerHeight||document.documentElement.clientHeight||0;
      var delta=(rect.top+(rect.height/2))-(viewportHeight/2);
      if(Math.abs(delta)>12){
        window.scrollBy({top:delta,behavior:'smooth'});
        await waitV599(380);
      }
    }catch(e){
      try{target.scrollIntoView({behavior:'smooth',block:'center'});}catch(_e){}
    }
  }

  async function focusEntryV599(target){
    if(!target) return false;
    var container=document.getElementById('dayEntries');

    // שלב 1: מביאים את אזור העבודות עצמו אל מרכז המסך הראשי.
    await scrollPageToEntriesV599(container||target);

    // שלב 2: גוללים בתוך הרשימה עד הכרטיס המדויק.
    var usedInner=await centerCardInsideContainerV599(container,target);
    if(!usedInner){
      try{target.scrollIntoView({behavior:'smooth',block:'center'});await waitV599(360);}catch(e){}
    }

    // שלב 3: לאחר שהגלילה הפנימית הסתיימה, מיישרים את הכרטיס עצמו למרכז המסך.
    await centerTargetInViewportV599(target);
    return true;
  }

  function highlightV599(target){
    if(!target) return;
    try{
      target.classList.remove('entry-target-highlight-v598','smart-entry-highlight-v584');
      void target.offsetWidth;
      target.classList.add('entry-target-highlight-v598');
      setTimeout(function(){try{target.classList.remove('entry-target-highlight-v598');}catch(e){}},3400);
    }catch(e){}
  }

  window.navigateToEntryV599=async function(entryId,entryDate){
    try{
      if(!entryId || !entryDate) return false;
      var targetMonth=parseDateV599(entryDate);
      if(!targetMonth) return false;
      var monthChanged=!(calendarDate instanceof Date)
        || calendarDate.getFullYear()!==targetMonth.getFullYear()
        || calendarDate.getMonth()!==targetMonth.getMonth();

      calendarDate=targetMonth;
      selectedDate=String(entryDate);
      selectedType=null;

      if(monthChanged && typeof loadMonth==='function'){
        await loadMonth();
      }else{
        try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
        try{if(typeof renderDay==='function')renderDay();}catch(e){}
        try{if(typeof renderStats==='function')renderStats();}catch(e){}
        try{if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(e){}
      }
      try{show('dayPanel');hide('selectDayHint');}catch(e){}

      return await new Promise(function(resolve){
        var attempts=0;
        async function focus(){
          attempts++;
          var target=findEntryCardV599(entryId);
          if(target){
            await focusEntryV599(target);
            highlightV599(target);
            resolve(true);
            return;
          }
          if(attempts<22){setTimeout(focus,120);return;}
          try{
            var container=document.getElementById('dayEntries');
            if(container)container.scrollIntoView({behavior:'smooth',block:'center'});
          }catch(e){}
          resolve(false);
        }
        setTimeout(focus,100);
      });
    }catch(e){console.warn('navigateToEntryV599 failed',e);return false;}
  };

  // כל מקורות הניווט הקיימים משתמשים באותה פונקציה: חיפוש, קרובות, מתוזמנות, בוצעו ולא בוצעו.
  window.openSmartEntryV584=function(entryId,entryDate){
    return window.navigateToEntryV599(entryId,entryDate);
  };
  window.navigateToEntryV598=window.navigateToEntryV599;
  window.navigateToEntry=window.navigateToEntryV599;

  function updateChangelogV599(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function' || old.__v599Wrapped) return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='5.99';})){
        rows.unshift({version:'5.99',title:'ניווט מדויק לפק״ע בתוך חלון הגלילה',createdAt:'2026-07-22',items:[
          'הניווט גולל תחילה את הדף הראשי עד אזור עבודות היום.',
          'לאחר מכן הוא גולל בתוך חלון הפק״עות וממרכז את הכרטיס המדויק.',
          'בסיום מתבצע יישור נוסף כדי שהפק״ע עצמה תופיע במרכז המסך ולא מתחת לאזור הגלילה.',
          'התיקון חל על חיפוש רגיל, חיפוש חכם, תוצאות קרובות, מתוזמנות, בוצעו ולא בוצעו.',
          'לא שונו נתונים, שמירה, נעילת יום, שבת או מבנה הכרטיסים.'
        ]});
      }
      return rows;
    };
    wrapped.__v599Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }

  function bootV599(){
    updateChangelogV599();
    try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bootV599,350);});
  else setTimeout(bootV599,80);
  window.addEventListener('load',function(){setTimeout(bootV599,650);});
})();


/* ===== v6.00: Smart nested scrolling for the daily entries container ===== */
(function(){
  'use strict';

  function installSmartEntryScrollV600(){
    var box=document.getElementById('dayEntries');
    if(!box || box.dataset.smartScrollV600==='1') return;
    box.dataset.smartScrollV600='1';

    // גלגלת / משטח מגע במחשב: כשהרשימה בגבול, מעבירים רק את התנועה העודפת לעמוד.
    box.addEventListener('wheel',function(event){
      var delta=Number(event.deltaY)||0;
      if(!delta) return;
      var atTop=box.scrollTop<=1;
      var atBottom=(box.scrollTop+box.clientHeight)>=box.scrollHeight-1;
      if((delta<0 && atTop) || (delta>0 && atBottom)){
        event.preventDefault();
        window.scrollBy({top:delta,left:0,behavior:'auto'});
      }
    },{passive:false});
  }

  function updateChangelogV600(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function' || old.__v600Wrapped) return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.00';})){
        rows.unshift({version:'6.00',title:'גלילה מקוננת חכמה באזור הפק״עות',createdAt:'2026-07-22',items:[
          'בהגעה לפק״עה הראשונה והמשך גלילה למעלה, העמוד הראשי ממשיך לגלול אוטומטית.',
          'בהגעה לפק״עה האחרונה והמשך גלילה למטה, הגלילה עוברת לעמוד הראשי.',
          'באמצע הרשימה הגלילה הפנימית ממשיכה לעבוד כרגיל.',
          'נשמרו כל הניווטים מחיפוש, מתוזמנות, בוצעו ולא בוצעו לפק״עה המדויקת.',
          'לא שונו נתונים, נעילת יום, שבת, עריכה או חיפוש.'
        ]});
      }
      return rows;
    };
    wrapped.__v600Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }

  function bootV600(){
    updateChangelogV600();
    installSmartEntryScrollV600();
    try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bootV600,380);});
  else setTimeout(bootV600,100);
  window.addEventListener('load',function(){setTimeout(bootV600,700);});
  document.addEventListener('click',function(){setTimeout(installSmartEntryScrollV600,80);},true);
})();


/* ===== v6.01: Split JavaScript into stable core + future extensions ===== */
(function(){
  'use strict';
  function updateChangelogV601(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function' || old.__v601Wrapped) return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.01';})){
        rows.unshift({version:'6.01',title:'פיצול קובץ הפונקציות לשני קבצי JavaScript',createdAt:'2026-07-22',items:[
          'קובץ functions.js פוצל ל-functions1.js ול-functions2.js בגבול בטוח בין פונקציות.',
          'functions1.js מכיל את הליבה היציבה ו-functions2.js מכיל את ההמשך וכל שינוי פונקציונלי עתידי.',
          'index.html עודכן לטעון את שני הקבצים בסדר הנכון.',
          'APP_VERSION נשאר מקור גרסה יחיד ב-functions1.js.',
          'לא שונתה לוגיקת האפליקציה או מבנה הנתונים.'
        ]});
      }
      return rows;
    };
    wrapped.__v601Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }
  function bootV601(){
    updateChangelogV601();
    try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bootV601,420);});
  else setTimeout(bootV601,120);
  window.addEventListener('load',function(){setTimeout(bootV601,760);});
})();


/* ===== v6.03: Direct month/year jump with optional valid day selector ===== */
(function(){
  'use strict';
  var MONTHS_V602=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  function elV602(id){return document.getElementById(id);}
  function closePickerV602(){var overlay=elV602('monthYearPickerOverlayV602');if(overlay)overlay.hidden=true;}

  // v6.03: The day list is optional and is rebuilt from the selected month/year,
  // so February and 30-day months never show invalid dates.
  function populateDaysV603(preserveValue){
    var monthSelect=elV602('monthPickerV602'),yearSelect=elV602('yearPickerV602'),daySelect=elV602('dayPickerV603');
    if(!monthSelect||!yearSelect||!daySelect)return;
    var month=Number(monthSelect.value),year=Number(yearSelect.value);
    var previous=preserveValue?String(daySelect.value||''):'';
    daySelect.innerHTML='';
    var empty=document.createElement('option');empty.value='';empty.textContent='ללא בחירת יום';daySelect.appendChild(empty);
    if(!Number.isInteger(month)||month<0||month>11||!Number.isInteger(year))return;
    var daysInMonth=new Date(year,month+1,0).getDate();
    for(var day=1;day<=daysInMonth;day++){
      var option=document.createElement('option');option.value=String(day);option.textContent=String(day);daySelect.appendChild(option);
    }
    if(previous&&Number(previous)<=daysInMonth)daySelect.value=previous;else daySelect.value='';
  }

  function populatePickerV602(){
    var monthSelect=elV602('monthPickerV602'),yearSelect=elV602('yearPickerV602');
    if(!monthSelect||!yearSelect)return;
    if(!monthSelect.options.length){
      MONTHS_V602.forEach(function(name,index){var op=document.createElement('option');op.value=String(index);op.textContent=name;monthSelect.appendChild(op);});
    }
    var currentYear=new Date().getFullYear();
    var activeYear=(calendarDate instanceof Date)?calendarDate.getFullYear():currentYear;
    var minYear=Math.min(2020,activeYear-10),maxYear=Math.max(currentYear+10,activeYear+10);
    yearSelect.innerHTML='';
    for(var y=maxYear;y>=minYear;y--){var yo=document.createElement('option');yo.value=String(y);yo.textContent=String(y);yearSelect.appendChild(yo);}
    monthSelect.value=String((calendarDate instanceof Date)?calendarDate.getMonth():new Date().getMonth());
    yearSelect.value=String(activeYear);
    populateDaysV603(false);
  }

  function openPickerV602(){
    populatePickerV602();
    var overlay=elV602('monthYearPickerOverlayV602');
    if(overlay){overlay.hidden=false;setTimeout(function(){try{elV602('monthPickerV602').focus();}catch(e){}},30);}
  }

  async function goToMonthV602(){
    var monthSelect=elV602('monthPickerV602'),yearSelect=elV602('yearPickerV602'),daySelect=elV602('dayPickerV603');
    if(!monthSelect||!yearSelect)return;
    var month=Number(monthSelect.value),year=Number(yearSelect.value);
    var dayValue=daySelect?String(daySelect.value||''):'';
    if(!Number.isInteger(month)||month<0||month>11||!Number.isInteger(year))return;

    var targetMonth=month,targetYear=year,targetDate=null;
    if(dayValue!==''){
      var day=Number(dayValue),maxDay=new Date(year,month+1,0).getDate();
      if(!Number.isInteger(day)||day<1||day>maxDay)return;
      targetDate=new Date(year,month,day);
      // v6.03: Keep the existing Saturday rule—when Saturday is selected,
      // continue automatically to the following Sunday, even across a month boundary.
      if(targetDate.getDay()===6)targetDate.setDate(targetDate.getDate()+1);
      targetMonth=targetDate.getMonth();
      targetYear=targetDate.getFullYear();
    }

    closePickerV602();
    calendarDate=new Date(targetYear,targetMonth,1);
    selectedDate=targetDate&&typeof formatDate==='function'?formatDate(targetDate):null;
    selectedType=null;
    if(typeof loadMonth==='function')await loadMonth();
    if(selectedDate){
      try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof renderDay==='function')renderDay();}catch(e){}
      try{if(typeof renderStats==='function')renderStats();}catch(e){}
    }
  }

  async function goTodayV602(){
    var target;
    try{target=(typeof initialCalendarDateV594==='function')?initialCalendarDateV594():new Date();}catch(e){target=new Date();}
    if(!(target instanceof Date)||isNaN(target.getTime()))target=new Date();
    closePickerV602();
    calendarDate=new Date(target.getFullYear(),target.getMonth(),1);
    selectedDate=(typeof formatDate==='function')?formatDate(target):null;
    selectedType=null;
    if(typeof loadMonth==='function')await loadMonth();
    if(selectedDate){
      try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof renderDay==='function')renderDay();}catch(e){}
      try{if(typeof renderStats==='function')renderStats();}catch(e){}
    }
  }

  function bindPickerV602(){
    var open=elV602('openMonthYearPickerV602'),close=elV602('closeMonthYearPickerV602'),go=elV602('goMonthYearV602'),today=elV602('goTodayV602'),overlay=elV602('monthYearPickerOverlayV602');
    if(!open||open.dataset.boundV602==='1')return;
    open.dataset.boundV602='1';
    open.addEventListener('click',openPickerV602);
    if(close)close.addEventListener('click',closePickerV602);
    if(go)go.addEventListener('click',goToMonthV602);
    if(today)today.addEventListener('click',goTodayV602);
    var monthSelect=elV602('monthPickerV602'),yearSelect=elV602('yearPickerV602');
    if(monthSelect)monthSelect.addEventListener('change',function(){populateDaysV603(false);});
    if(yearSelect)yearSelect.addEventListener('change',function(){populateDaysV603(false);});
    if(overlay)overlay.addEventListener('click',function(e){if(e.target===overlay)closePickerV602();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay&&!overlay.hidden)closePickerV602();});
  }

  function updateChangelogV602(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function'||old.__v602Wrapped)return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.03';})){
        rows.unshift({version:'6.03',title:'בחירת יום אופציונלית בקפיצה ללוח השנה',createdAt:'2026-07-24',items:[
          'נוסף שדה יום אופציונלי באותו חלון של בחירת חודש ושנה.',
          'רשימת הימים מתעדכנת אוטומטית לפי החודש והשנה ומציגה רק 28, 29, 30 או 31 ימים תקינים.',
          'ללא בחירת יום המערכת עוברת רק לחודש ולשנה; עם בחירת יום היא פותחת את היום המדויק.',
          'כאשר נבחר יום שבת מופעלת לוגיקת השבת הקיימת והמערכת עוברת ליום ראשון הקרוב.',
          'לא שונו טעינת נתונים, חיצי החודשים, עבודות, חיפוש, נעילות או Firestore.'
        ]});
      }
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.02';})){
        rows.unshift({version:'6.02',title:'קפיצה ישירה לחודש ושנה בלוח השנה',createdAt:'2026-07-24',items:[
          'נוסף אייקון לוח שנה קטן ליד כותרת החודש והשנה.',
          'האייקון פותח בחירה נוחה של חודש ושנה ומבצע טעינה אחת בלבד של חודש היעד.',
          'נוסף כפתור היום לחזרה מיידית לחודש וליום הנוכחיים; בשבת נשמרת לוגיקת המעבר ליום ראשון.',
          'חיצי המעבר הקיימים לחודש קודם ולחודש הבא נשארו ללא שינוי.',
          'לא שונו נתוני עבודות, חיפוש, נעילת יום או מבנה Firestore.'
        ]});
      }
      return rows;
    };
    wrapped.__v602Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }

  function bootV602(){bindPickerV602();updateChangelogV602();try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bootV602,460);});
  else setTimeout(bootV602,140);
  window.addEventListener('load',function(){setTimeout(bootV602,800);});
})();


/*
===============================================================================
VERSION 6.04 BETA - TWO-YEAR MEMORY DATA MANAGER
-------------------------------------------------------------------------------
1. Initial worker load subscribes once to the last 730 days only.
2. Month/day changes render from the in-memory cache without new full reads.
3. Firestore snapshot changes keep the cache synchronized after writes/edits/deletes.
4. Search remains full-history using the existing dedicated search query.
5. Opening a search result older than 730 days loads only its target month on demand.
6. Optional diagnostics: add ?cacheDebug=1 to the URL.
===============================================================================
*/
(function(){
  'use strict';
  var state=window.WM_DATA_CACHE_V604=window.WM_DATA_CACHE_V604||{
    workerId:'', cutoff:'', entries:[], unsubscribe:null, readyPromise:null,
    historicalMonths:Object.create(null), snapshotCount:0, historicalLoads:0,
    lastEvent:'not-started', initialDocs:0
  };

  function pad2(n){return String(n).padStart(2,'0');}
  function dateStr(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
  function cutoff730(){var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-730);return dateStr(d);}
  function monthKey(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1);}
  function activeWorkerId(){try{return viewedWorker&&viewedWorker.id?String(viewedWorker.id):'';}catch(e){return '';}}
  function isDebug(){try{return new URLSearchParams(location.search).get('cacheDebug')==='1';}catch(e){return false;}}
  function debug(msg,extra){
    state.lastEvent=msg;
    if(extra!==undefined) console.log('[WM 6.04 BETA CACHE]',msg,extra); else console.log('[WM 6.04 BETA CACHE]',msg);
    renderDebug();
  }
  function renderDebug(){
    if(!isDebug())return;
    var box=document.getElementById('wmCacheDebugV604');
    if(!box){
      box=document.createElement('div');box.id='wmCacheDebugV604';
      box.style.cssText='position:fixed;left:8px;bottom:8px;z-index:999999;background:#111;color:#d7ffd7;border:1px solid #55aa55;border-radius:10px;padding:9px 11px;direction:ltr;text-align:left;font:12px/1.45 monospace;max-width:92vw;box-shadow:0 4px 18px #0008;';
      document.body.appendChild(box);
    }
    var current='';try{current=calendarDate instanceof Date?monthKey(calendarDate):'';}catch(e){}
    box.textContent='WM CACHE 6.04 BETA\nworker: '+(state.workerId||'-')+'\ncutoff: '+(state.cutoff||'-')+'\n2y docs: '+state.entries.length+'\nsnapshots: '+state.snapshotCount+'\nhistory months: '+Object.keys(state.historicalMonths).length+'\nhistory loads: '+state.historicalLoads+'\ncurrent month: '+current+'\nlast: '+state.lastEvent;
  }
  function allLoadedEntries(){
    var merged=state.entries.slice();
    Object.keys(state.historicalMonths).forEach(function(k){
      (state.historicalMonths[k]||[]).forEach(function(e){if(!merged.some(function(x){return x.id===e.id;}))merged.push(e);});
    });
    return merged;
  }
  function renderCurrentMonth(){
    if(!state.workerId)return;
    var y=calendarDate.getFullYear(),m=calendarDate.getMonth(),last=new Date(y,m+1,0).getDate();
    var start=y+'-'+pad2(m+1)+'-01',end=y+'-'+pad2(m+1)+'-'+pad2(last),key=y+'-'+pad2(m+1);
    var source=String(end)<state.cutoff?(state.historicalMonths[key]||[]):state.entries;
    window.workerAllEntriesV511=allLoadedEntries();
    monthEntries=source.filter(function(e){return String(e.date||'')>=start&&String(e.date||'')<=end;});
    try{if(document.getElementById('calTitle'))text('calTitle',months[m]+' '+y);}catch(e){}
    try{if(document.getElementById('monthSub'))text('monthSub','חודש בתצוגה: '+months[m]+' '+y);}catch(e){}
    try{if(!selectedDate&&typeof selectTodayOnCurrentMonthV564==='function')selectTodayOnCurrentMonthV564();}catch(e){}
    try{renderCalendar();}catch(e){}
    try{renderDay();}catch(e){}
    try{renderStats();}catch(e){}
    try{renderSmartDashboard();}catch(e){}
    try{if(document.getElementById('searchPanel')&&!document.getElementById('searchPanel').classList.contains('hidden'))renderFullSummary();}catch(e){}
    renderDebug();
  }
  function stopListener(){if(state.unsubscribe){try{state.unsubscribe();}catch(e){}state.unsubscribe=null;}}
  function ensureCache(workerId){
    var cutoff=cutoff730();
    if(state.workerId===workerId&&state.cutoff===cutoff&&state.readyPromise)return state.readyPromise;
    stopListener();
    state.workerId=workerId;state.cutoff=cutoff;state.entries=[];state.historicalMonths=Object.create(null);state.snapshotCount=0;state.historicalLoads=0;
    state.readyPromise=new Promise(function(resolve,reject){
      var first=true;
      try{
        var q=db.collection('workEntries').where('workerId','==',workerId).where('date','>=',cutoff);
        state.unsubscribe=q.onSnapshot({includeMetadataChanges:true},function(snap){
          state.snapshotCount++;
          state.entries=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
          state.initialDocs=state.entries.length;
          window.workerAllEntriesV511=allLoadedEntries();
          debug(first?'initial-two-year-load':'cache-snapshot-update',{docs:state.entries.length,fromCache:!!(snap.metadata&&snap.metadata.fromCache),pending:!!(snap.metadata&&snap.metadata.hasPendingWrites)});
          renderCurrentMonth();
          if(first){first=false;resolve(state.entries);}
        },function(err){
          debug('two-year-query-error',err&&err.message?err.message:err);
          if(first){first=false;reject(err);}
        });
      }catch(err){first=false;reject(err);}
    });
    return state.readyPromise;
  }
  async function loadHistoricalMonth(dateValue){
    var d=dateValue instanceof Date?dateValue:new Date(String(dateValue||'')+'T12:00:00');
    if(!(d instanceof Date)||isNaN(d.getTime()))return [];
    var key=monthKey(d);if(state.historicalMonths[key])return state.historicalMonths[key];
    var workerId=activeWorkerId();if(!workerId)return [];
    var start=key+'-01',end=dateStr(new Date(d.getFullYear(),d.getMonth()+1,0));
    debug('loading-historical-month',{key:key});
    var snap=await db.collection('workEntries').where('workerId','==',workerId).where('date','>=',start).where('date','<=',end).get();
    state.historicalMonths[key]=snap.docs.map(function(doc){return Object.assign({id:doc.id},doc.data());});
    state.historicalLoads++;
    window.workerAllEntriesV511=allLoadedEntries();
    debug('historical-month-loaded',{key:key,docs:state.historicalMonths[key].length});
    return state.historicalMonths[key];
  }

  // v6.04 BETA: replaces the final loadMonth implementation. Price list/templates retain existing behavior;
  // work entries are loaded once and every later call only filters the memory cache.
  loadMonth=async function(token){
    token=token||(typeof currentNavTokenV180==='function'?currentNavTokenV180():null);
    if(!viewedWorker||!viewedWorker.id)return;
    try{if(typeof isStaleNavV180==='function'&&token&&isStaleNavV180(token))return;}catch(e){}
    try{await loadPriceList();}catch(e){console.warn('v6.04 price list load skipped',e);}
    try{await loadTemplates();}catch(e){console.warn('v6.04 templates load skipped',e);}
    var workerId=activeWorkerId();
    await ensureCache(workerId);
    renderCurrentMonth();
  };
  window.loadMonth=loadMonth;
  window.loadHistoricalMonthV604=loadHistoricalMonth;

  // Older search results remain fully functional: only the selected old month is fetched on demand.
  function wrapNavigation(){
    var original=window.navigateToEntryV599;
    if(typeof original!=='function'||original.__cacheV604)return;
    var wrapped=async function(entryId,entryDate){
      try{if(String(entryDate||'')<state.cutoff)await loadHistoricalMonth(entryDate);}catch(e){console.warn('v6.04 historical navigation load failed',e);}
      return original.apply(this,arguments);
    };
    wrapped.__cacheV604=true;
    window.navigateToEntryV599=wrapped;window.navigateToEntryV598=wrapped;window.navigateToEntry=wrapped;window.openSmartEntryV584=wrapped;
  }
  function boot(){wrapNavigation();renderDebug();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,900);});else setTimeout(boot,300);
  window.addEventListener('load',function(){setTimeout(boot,1300);});
})();


/*
===============================================================================
VERSION 6.05 BETA - CUSTOMER LOOKUP FROM TWO-YEAR MEMORY ONLY
-------------------------------------------------------------------------------
1. Customer-number blur lookup no longer performs a Firestore query.
2. It reads only WM_DATA_CACHE_V604.entries (the active 730-day window).
3. Address autofill and customer warnings therefore ignore records older than
   two years; full-history records remain available only in the Search panel.
4. This override lives in functions2.js as required for all new functionality.
===============================================================================
*/
(function(){
  'use strict';

  function byId(id){return document.getElementById(id);}
  function valueOf(id){var node=byId(id);return node?String(node.value||'').trim():'';}
  function safeEsc(value){
    try{if(typeof esc==='function')return esc(value);}catch(e){}
    return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function safeMoney(value){
    try{if(typeof money==='function')return money(value);}catch(e){}
    return '₪'+Number(value||0).toLocaleString('he-IL');
  }
  function safeHeDate(value){
    try{if(typeof heDate==='function')return heDate(value);}catch(e){}
    return String(value||'');
  }
  function todayValue(){
    try{if(typeof todayStr==='function')return todayStr();}catch(e){}
    var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function dateDaysAgo(days){
    var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-days);
    try{if(typeof formatDate==='function')return formatDate(d);}catch(e){}
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  window.checkRecentCustomer=async function(inputId,resultId){
    var num=valueOf(inputId),box=byId(resultId);
    if(!box)return;
    box.innerHTML='';
    if(!num)return;
    if(!/^\d+$/.test(num)){
      box.innerHTML="<div class='danger'>מספר לקוח חייב להיות ספרות בלבד</div>";
      return;
    }
    var workerId='';
    try{workerId=viewedWorker&&viewedWorker.id?String(viewedWorker.id):'';}catch(e){}
    if(!workerId){
      box.innerHTML="<div class='danger'>לא זוהה עובד פעיל לבדיקה.</div>";
      return;
    }

    // v6.05 BETA: intentionally use only the 730-day live cache. Do not use
    // workerAllEntriesV511 because it may also contain an old month loaded from Search.
    var cache=window.WM_DATA_CACHE_V604;
    var cachedEntries=cache&&Array.isArray(cache.entries)?cache.entries:[];
    if(cache&&cache.readyPromise){
      try{await cache.readyPromise;}catch(e){}
      cachedEntries=Array.isArray(cache.entries)?cache.entries:[];
    }

    var all=cachedEntries
      .filter(function(entry){
        return String(entry&&entry.workerId||'')===workerId && String(entry&&entry.customerNumber||'').trim()===num;
      })
      .sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});

    var fromStr=dateDaysAgo(30),today=todayValue();
    var notDoneMatches=all
      .filter(function(e){return String(e.entryStatus||e.status||'')==='not_done';})
      .sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    var doneMatches=all
      .filter(function(e){
        var status=String(e.entryStatus||e.status||'done');
        var planned=false;try{planned=!!(window.isPlannedV49&&window.isPlannedV49(e));}catch(err){}
        return status!=='not_done'&&!planned&&status!=='planned'&&String(e.date||'')>=fromStr;
      })
      .sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    var plannedMatches=all
      .filter(function(e){
        var status=String(e.entryStatus||e.status||'');
        var planned=false;try{planned=!!(window.isPlannedV49&&window.isPlannedV49(e));}catch(err){}
        return status!=='not_done'&&(planned||status==='planned')&&String(e.date||'')>=today;
      })
      .sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));});

    var addressTargetId=inputId==='sCustomer'?'sAddress':(inputId==='iCustomer'?'iAddress':'');
    var addressTarget=addressTargetId?byId(addressTargetId):null;
    var addressSource=doneMatches.find(function(e){return String(e.address||'').trim();})
      ||plannedMatches.find(function(e){return String(e.address||'').trim();})
      ||all.find(function(e){return String(e.address||'').trim();});
    if(addressTarget&&!String(addressTarget.value||'').trim()&&addressSource&&addressSource.address){
      addressTarget.value=addressSource.address;
    }

    if(!doneMatches.length&&!plannedMatches.length&&!notDoneMatches.length){
      box.innerHTML="<div class='recent-ok'>לא נמצאה עבודה שבוצעה ב־30 הימים האחרונים, אין סידור מתוזמן ואין פק״ע שלא בוצעה ללקוח הזה בשנתיים שנטענו ✅</div>";
      return;
    }

    var parts=[];
    if(doneMatches.length){
      var last=doneMatches[0];
      parts.push('✅ היית אצל לקוח זה ב־30 הימים האחרונים.<br>פעם אחרונה: '+safeHeDate(last.date)+' · '+safeEsc(last.description||'עבודה')+' · '+safeMoney(last.amount||0)+'<br>כתובת: '+safeEsc(last.address||''));
    }
    if(plannedMatches.length){
      var next=plannedMatches[0];
      parts.push('📋 קיימת קריאה/התקנה מתוזמנת ללקוח זה.<br>מועד קרוב: '+safeHeDate(next.date)+' · '+safeEsc(next.description||'סידור מתוזמן')+' · צפי '+safeMoney(next.amount||0)+'<br>כתובת: '+safeEsc(next.address||''));
    }
    if(notDoneMatches.length){
      var nd=notDoneMatches[0];
      var reason=nd.notDoneReason?' · סיבה: '+safeEsc(nd.notDoneReason):'';
      var note=nd.notDoneNote?'<br>פירוט: '+safeEsc(nd.notDoneNote):'';
      parts.push('🚫 קיימת פק״ע מתוזמנת שלא בוצעה ללקוח זה.<br>תאריך: '+safeHeDate(nd.date)+' · '+safeEsc(nd.description||'פק״ע מתוזמנת')+reason+'<br>כתובת: '+safeEsc(nd.address||'')+note);
    }
    box.innerHTML='<div class="'+((doneMatches.length||notDoneMatches.length)?'recent-box':'recent-ok')+'">'+parts.join('<br><br>')+'</div>';
  };
})();


/*
===============================================================================
VERSION 6.06 BETA - RELOAD DAY LOCKS WHEN CHANGING MONTH FROM MEMORY CACHE
-------------------------------------------------------------------------------
1. The 6.04 memory-cache loadMonth replacement had bypassed the older day-lock
   wrapper, so calendar month changes rendered before that month's locks loaded.
2. Every loadMonth call now loads the target month's locks after the cached work
   entries are rendered, then redraws the calendar and selected day.
3. Work entries still come from the two-year memory cache; only the small
   workerDaysOff/day-lock query is refreshed for the selected month.
4. Existing lock persistence, search behavior and customer lookup are unchanged.
===============================================================================
*/
(function(){
  'use strict';

  function installMonthLockReloadV606(){
    var base=window.loadMonth;
    if(typeof base!=='function' || base.__dayLocksMonthReloadV606) return;

    var wrapped=async function(){
      var result=await base.apply(this,arguments);
      try{
        if(typeof window.loadDayLocksV585==='function'){
          await window.loadDayLocksV585();
        }
      }catch(err){
        console.error('v6.06 month day-lock reload failed',err);
        try{
          window.dayLockDebugV590&&window.dayLockDebugV590('V606_MONTH_LOCK_RELOAD_ERROR',{
            message:(err&&err.message)||String(err||'')
          });
        }catch(_e){}
      }
      try{if(typeof window.renderCalendar==='function')window.renderCalendar();else if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof window.renderDay==='function')window.renderDay();else if(typeof renderDay==='function')renderDay();}catch(e){}
      try{
        window.dayLockDebugV590&&window.dayLockDebugV590('V606_MONTH_LOCK_RELOAD_SUCCESS',{
          calendarDate:(typeof calendarDate!=='undefined'&&calendarDate)?String(calendarDate):''
        });
      }catch(_e2){}
      return result;
    };
    wrapped.__dayLocksMonthReloadV606=true;
    wrapped.__baseV606=base;
    window.loadMonth=wrapped;
    try{loadMonth=wrapped;}catch(e){}
  }

  function updateChangelogV606(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function' || old.__v606Wrapped) return;
    var wrapped=function(){
      var rows=[];
      try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.06-beta';})){
        rows.unshift({
          version:'6.06-beta',
          title:'תיקון הצגת ימים נעולים במעבר בין חודשים בבטא',
          createdAt:'2026-07-25',
          items:[
            'תוקן מצב שבו מעבר לחודש אחר מתוך מטמון השנתיים הציג את כל הימים כפתוחים למרות שנשמרו כנעולים.',
            'לאחר כל מעבר חודש נטענות נעילות החודש הנבחר מ-workerDaysOff ולוח השנה והיום הנבחר מצוירים מחדש.',
            'עבודות החודש ממשיכות להיטען מהזיכרון בלבד ואינן נקראות מחדש מ-Firestore.',
            'לא שונו שמירת נעילה, חיפוש בכל ההיסטוריה או השלמת כתובת ממטמון השנתיים.'
          ]
        });
      }
      return rows;
    };
    wrapped.__v606Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }

  installMonthLockReloadV606();
  updateChangelogV606();
  try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
})();

/*
===============================================================================
VERSION 6.07 BETA - RELOAD VACATION DAYS WHEN CHANGING MONTH FROM MEMORY CACHE
-------------------------------------------------------------------------------
1. The two-year cache keeps work entries in memory, but every displayed month
   still needs its small workerDaysOff metadata query for vacation days/locks.
2. Every loadMonth call now reloads the selected month's vacation days, then
   reloads day locks, and redraws calendar/day/statistics/smart dashboard.
3. No workEntries collection is re-read during month/day navigation.
4. Full-history Search and two-year customer lookup behavior are unchanged.
===============================================================================
*/
(function(){
  'use strict';

  function installMonthVacationReloadV607(){
    var base=window.loadMonth;
    if(typeof base!=='function' || base.__vacationMonthReloadV607) return;

    var wrapped=async function(){
      var result=await base.apply(this,arguments);

      try{
        if(typeof window.loadVacationDaysV437==='function'){
          await window.loadVacationDaysV437();
        }else if(typeof window.loadVacationDaysV489==='function'){
          await window.loadVacationDaysV489();
        }else if(typeof window.loadVacationDaysV487==='function'){
          await window.loadVacationDaysV487();
        }else if(typeof loadVacationDaysV487==='function'){
          await loadVacationDaysV487();
        }
      }catch(err){
        console.error('v6.07 month vacation-days reload failed',err);
      }

      // Keep lock metadata synchronized as well. The v6.06 wrapper may already
      // have loaded it; this small query is intentional to guarantee final state
      // after vacation filtering in workerDaysOff.
      try{
        if(typeof window.loadDayLocksV585==='function'){
          await window.loadDayLocksV585();
        }
      }catch(lockErr){
        console.error('v6.07 month day-lock reload failed',lockErr);
      }

      try{if(typeof window.renderCalendar==='function')window.renderCalendar();else if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof window.renderDay==='function')window.renderDay();else if(typeof renderDay==='function')renderDay();}catch(e){}
      try{if(typeof window.renderStats==='function')window.renderStats();else if(typeof renderStats==='function')renderStats();}catch(e){}
      try{if(typeof window.renderSmartDashboard==='function')window.renderSmartDashboard();else if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(e){}
      return result;
    };

    wrapped.__vacationMonthReloadV607=true;
    wrapped.__baseV607=base;
    window.loadMonth=wrapped;
    try{loadMonth=wrapped;}catch(e){}
  }

  function updateChangelogV607(){
    var old=window.requiredChangelogRows || (typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function' || old.__v607Wrapped) return;
    var wrapped=function(){
      var rows=[];
      try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.07-beta';})){
        rows.unshift({
          version:'6.07-beta',
          title:'תיקון הצגת ימי חופש במעבר בין חודשים בבטא',
          createdAt:'2026-07-25',
          items:[
            'תוקן מצב שבו מעבר לחודש קודם או הבא מתוך מטמון השנתיים לא טען את ימי החופש של החודש הנבחר.',
            'לאחר כל מעבר חודש נטענים ימי החופש ונעילות הימים של חודש היעד לפני ציור הלוח והדשבורד.',
            'עבודות החודש ממשיכות להגיע מהזיכרון בלבד ואינן נקראות מחדש מ-Firestore.',
            'חישובי ימי החופש, ימי העבודה שנותרו והיעד היומי מתעדכנים לפי החודש שמוצג.'
          ]
        });
      }
      return rows;
    };
    wrapped.__v607Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }

  installMonthVacationReloadV607();
  updateChangelogV607();
  try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
})();



/*
===============================================================================
VERSION 6.08 BETA - IMMEDIATE CACHE UPDATE AFTER SAVING WORK
-------------------------------------------------------------------------------
1. Service/install saves create a known document id before writing.
2. The new entry is inserted optimistically into the two-year memory cache.
3. The selected day, calendar, statistics and dashboard refresh immediately.
4. A clear success message is shown and the form resets as before.
5. Firestore snapshot later replaces the optimistic copy by the same id,
   preventing duplicates and preserving offline behavior.
===============================================================================
*/
(function(){
  'use strict';

  function byIdV608(id){return document.getElementById(id);}
  function valueV608(id){var el=byIdV608(id);return el?String(el.value||'').trim():'';}
  function currentUidV608(){try{return typeof currentAuthUid==='function'?currentAuthUid():'';}catch(e){return '';}}
  function beginV608(){try{return typeof window.wmBeginEntrySaveV516==='function'?window.wmBeginEntrySaveV516():true;}catch(e){return true;}}
  function successTextV608(label,amount,status){
    try{return window.wmOfflineSaveNoticeV516(label,status==='planned'?null:amount,status,'היא לא נכנסה להתחשבנות עד שתלחץ בוצע.');}catch(e){}
    return '<div class="notice">'+label+' נשמרה בהצלחה ✅</div>';
  }
  function afterV608(message){
    try{if(typeof window.wmAfterLocalEntrySaveV516==='function'){window.wmAfterLocalEntrySaveV516(message);return;}}catch(e){}
    var box=byIdV608('entryMsg');if(box)box.innerHTML=message;
  }
  function errorV608(err){
    try{if(typeof window.wmHandleEntrySaveErrorV516==='function'){window.wmHandleEntrySaveErrorV516(err);return;}}catch(e){}
    var box=byIdV608('entryMsg');if(box)box.innerHTML='<p class="danger">שגיאה בשמירה: '+String((err&&(err.message||err.code))||err||'')+'</p>';
  }
  function showValidationV608(message,focusId){
    var box=byIdV608('entryMsg');if(box)box.innerHTML='<p class="danger">'+message+'</p>';
    var el=focusId?byIdV608(focusId):null;if(el){try{el.focus();}catch(e){}}
    return false;
  }
  function cacheStateV608(){return window.WM_DATA_CACHE_V604||null;}
  function upsertCacheV608(entry){
    var state=cacheStateV608();
    if(!state||!Array.isArray(state.entries))return;
    var idx=state.entries.findIndex(function(x){return x&&x.id===entry.id;});
    if(idx>=0)state.entries[idx]=Object.assign({},state.entries[idx],entry);
    else state.entries.push(entry);
    try{window.workerAllEntriesV511=state.entries.slice();}catch(e){}
  }
  function removeCacheV608(id){
    var state=cacheStateV608();if(!state||!Array.isArray(state.entries))return;
    state.entries=state.entries.filter(function(x){return !x||x.id!==id;});
    try{window.workerAllEntriesV511=state.entries.slice();}catch(e){}
  }
  function refreshUiV608(){
    var state=cacheStateV608();
    try{
      if(state&&Array.isArray(state.entries)&&calendarDate instanceof Date){
        var y=calendarDate.getFullYear(),m=calendarDate.getMonth();
        var start=y+'-'+String(m+1).padStart(2,'0')+'-01';
        var end=y+'-'+String(m+1).padStart(2,'0')+'-'+String(new Date(y,m+1,0).getDate()).padStart(2,'0');
        monthEntries=state.entries.filter(function(e){var d=String((e&&e.date)||'');return d>=start&&d<=end;});
      }
    }catch(e){}
    try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
    try{if(typeof renderDay==='function')renderDay();}catch(e){}
    try{if(typeof renderStats==='function')renderStats();}catch(e){}
    try{if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(e){}
    try{if(typeof renderFullSummary==='function'&&byIdV608('searchPanel')&&!byIdV608('searchPanel').classList.contains('hidden'))renderFullSummary();}catch(e){}
  }
  function selectedPekaV608(){var el=byIdV608('pekaTypeV527');var v=String((el&&el.value)||'').trim().toUpperCase();return v==='CN'||v==='CH'?v:'';}
  function selectedKindV608(){
    try{if(typeof selectedKindV411==='function')return selectedKindV411();}catch(e){}
    var rf=byIdV608('installKindRfV411');return rf&&rf.checked?'rf':'fiber';
  }
  function kindLabelV608(kind){return String(kind||'').toLowerCase()==='rf'?'RF':'סיב';}
  function servicePriceV608(){try{return Number(SERVICE_PRICE||0);}catch(e){return 65;}}

  function savePayloadV608(payload,label,amount,status){
    if(!beginV608())return false;
    var ref=db.collection('workEntries').doc();
    var optimistic=Object.assign({id:ref.id,createdAtLocal:new Date().toISOString(),_pendingV608:true},payload);
    upsertCacheV608(optimistic);
    refreshUiV608();
    afterV608(successTextV608(label,amount,status));

    ref.set(payload).then(function(){
      upsertCacheV608(Object.assign({},optimistic,{_pendingV608:false}));
      refreshUiV608();
    }).catch(function(err){
      removeCacheV608(ref.id);
      refreshUiV608();
      errorV608(err);
    });
    return true;
  }

  function addServiceV608(status){
    var customerNumber=valueV608('sCustomer'),address=valueV608('sAddress'),notes=valueV608('sNotes');
    var returnCb=byIdV608('sReturnCall'),isReturnCall=!!(returnCb&&returnCb.checked),amount=isReturnCall?0:servicePriceV608();
    if(!customerNumber||!/^[0-9]+$/.test(customerNumber))return showValidationV608('חובה למלא מספר לקוח בספרות בלבד.','sCustomer');
    if(!address)return showValidationV608('חובה למלא כתובת.','sAddress');
    if(!viewedWorker||!viewedWorker.id||!selectedDate)return showValidationV608('חסר עובד או יום נבחר. רענן את המסך ונסה שוב.','sCustomer');
    return savePayloadV608({
      workerId:viewedWorker.id,workerName:viewedWorker.name,authUid:viewedWorker.authUid||currentUidV608(),
      date:selectedDate,workType:'service',entryStatus:status,
      description:isReturnCall?'קריאת שירות חוזרת':'קריאת שירות',customerNumber:customerNumber,address:address,notes:notes,
      isReturnCall:isReturnCall,amount:amount,createdAt:firebase.firestore.FieldValue.serverTimestamp()
    },'קריאת השירות',amount,status);
  }

  function addInstallV608(status){
    var customerNumber=valueV608('iCustomer'),address=valueV608('iAddress'),notes=valueV608('iNotes');
    if(!customerNumber||!/^[0-9]+$/.test(customerNumber))return showValidationV608('חובה למלא מספר לקוח בספרות בלבד.','iCustomer');
    if(!address)return showValidationV608('חובה למלא כתובת.','iAddress');
    if(!viewedWorker||!viewedWorker.id||!selectedDate)return showValidationV608('חסר עובד או יום נבחר. רענן את המסך ונסה שוב.','iCustomer');
    var kind=selectedKindV608(),peka=selectedPekaV608(),items=[],total=0;
    if(!peka)return showValidationV608('חובה לבחור סוג פק״ע: CN או CH.','pekaTypeV527');
    try{(priceList||[]).forEach(function(p){
      var el=byIdV608('qty_'+p.id),q=0;
      if(el)q=(p.inputMode||'qty')==='check'?(el.checked?1:0):Number(el.value||0);
      if(q>0){var price=Number(p.price||0);items.push({id:p.id,name:p.name,price:price,quantity:q,inputMode:p.inputMode||'qty',priceType:kind,installKind:kind,pekaType:peka,total:q*price});total+=q*price;}
    });}catch(e){}
    if(!items.length)return showValidationV608('חובה לבחור לפחות פריט אחד.','iCustomer');
    var label='התקנת '+kindLabelV608(kind);
    return savePayloadV608({
      workerId:viewedWorker.id,workerName:viewedWorker.name,authUid:viewedWorker.authUid||currentUidV608(),
      date:selectedDate,workType:'install',installKind:kind,priceType:kind,pekaType:peka,entryStatus:status,
      description:label,customerNumber:customerNumber,address:address,notes:notes,items:items,amount:total,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    },label,total,status);
  }

  // v6.09: expose the exact cache-aware save implementations so the final
  // button binding cannot fall back to an older wrapped/global function.
  window.wmAddServiceCacheV608=addServiceV608;
  window.wmAddInstallCacheV608=addInstallV608;

  // v6.08: final overrides for all four create paths.
  window.addService=function(){return addServiceV608('done');};
  window.addInstall=function(){return addInstallV608('done');};
  window.addServicePlannedV49=function(){return addServiceV608('planned');};
  window.addInstallPlannedV49=function(){return addInstallV608('planned');};
  try{addService=window.addService;addInstall=window.addInstall;addServicePlannedV49=window.addServicePlannedV49;addInstallPlannedV49=window.addInstallPlannedV49;}catch(e){}

  function updateChangelogV608(){
    var old=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function'||old.__v608Wrapped)return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.08-beta';})){
        rows.unshift({version:'6.08-beta',title:'הצגה מיידית לאחר שמירת עבודה בבטא',createdAt:'2026-07-25',items:[
          'תוקן מצב שבו סידור עתידי נשמר ב-Firestore אך לא הופיע במסך עד פתיחת הגרסה הישנה או רענון מלא.',
          'לאחר שמירת קריאת שירות או התקנה, רגילה או מתוזמנת, הרשומה מתווספת מיד למטמון השנתיים וליום הנבחר.',
          'מוצגת הודעת אישור ברורה, הטופס מתאפס והלוח, היום, הסטטיסטיקות והדשבורד מתעדכנים ללא טעינה מחדש של workEntries.',
          'הכתיבה נשארת תואמת מצב אופליין; עדכון Firestore המאוחר מחליף את אותה רשומה לפי מזהה קבוע ואינו יוצר כפילות.'
        ]});
      }
      return rows;
    };
    wrapped.__v608Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
  updateChangelogV608();
  try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
})();


/*
===============================================================================
VERSION 6.09 BETA - FINAL SAVE BUTTON ROUTING
-------------------------------------------------------------------------------
1. Save buttons are intercepted by their actual DOM ids in capture phase.
2. Planned and regular saves are routed directly to the cache-aware v6.08
   implementations, bypassing old wrappers/closures that remained in the app.
3. Prevents a write from reaching Firestore while the visible cache/UI path is
   skipped, which caused scheduled work to appear only in the stable version.
4. Adds a small independent confirmation toast after an accepted save action.
===============================================================================
*/
(function(){
  'use strict';
  if(window.__wmSaveButtonRouterV609Installed)return;
  window.__wmSaveButtonRouterV609Installed=true;

  function toastV609(text){
    var box=document.getElementById('wmSaveToastV609');
    if(!box){
      box=document.createElement('div');
      box.id='wmSaveToastV609';
      box.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000000;background:#153d2b;color:#fff;border:1px solid #61c48a;border-radius:12px;padding:11px 16px;font-weight:700;box-shadow:0 8px 28px #0007;direction:rtl;text-align:center;display:none;max-width:90vw';
      document.body.appendChild(box);
    }
    box.textContent=text;
    box.style.display='block';
    clearTimeout(box.__hideTimerV609);
    box.__hideTimerV609=setTimeout(function(){box.style.display='none';},2600);
  }

  function routeV609(id){
    var result=false;
    if(id==='saveServicePlannedBtnV49'){
      result=window.wmAddServiceCacheV608&&window.wmAddServiceCacheV608('planned');
      if(result)toastV609('קריאת השירות נשמרה כסידור עתידי ✅');
      return true;
    }
    if(id==='saveInstallPlannedBtnV49'){
      result=window.wmAddInstallCacheV608&&window.wmAddInstallCacheV608('planned');
      if(result)toastV609('ההתקנה נשמרה כסידור עתידי ✅');
      return true;
    }
    if(id==='serviceSaveDoneBtnV411'){
      result=window.wmAddServiceCacheV608&&window.wmAddServiceCacheV608('done');
      if(result)toastV609('קריאת השירות נשמרה ✅');
      return true;
    }
    if(id==='installSaveDoneBtnV411'){
      result=window.wmAddInstallCacheV608&&window.wmAddInstallCacheV608('done');
      if(result)toastV609('ההתקנה נשמרה ✅');
      return true;
    }
    return false;
  }

  // Capture phase is intentional: older code created onclick closures that kept
  // references to legacy save functions. This handler runs first and blocks them.
  document.addEventListener('click',function(ev){
    var target=ev.target&&ev.target.closest?ev.target.closest('button'):null;
    if(!target||!routeV609(target.id))return;
    ev.preventDefault();
    ev.stopPropagation();
    if(typeof ev.stopImmediatePropagation==='function')ev.stopImmediatePropagation();
  },true);

  function updateChangelogV609(){
    var old=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function'||old.__v609Wrapped)return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.09-beta';})){
        rows.unshift({version:'6.09-beta',title:'תיקון סופי לניתוב כפתורי השמירה בבטא',createdAt:'2026-07-25',items:[
          'תוקן מצב שבו סידור עתידי נכתב ל-Firestore אך כפתור השמירה המשיך לעבור דרך פונקציה ישנה ולכן המטמון והמסך לא התעדכנו.',
          'ארבעת כפתורי השמירה מנותבים כעת ישירות למנגנון השמירה שמעדכן את מטמון השנתיים: קריאת שירות, התקנה, בוצע ומתוזמן.',
          'לאחר שמירה מתקבל חיווי אישור ברור והרשומה מוצגת מיד ביום הנבחר ללא טעינה מחדש של כל העבודות.',
          'החיפוש המלא, נעילות ימים, ימי חופש וטעינת השנתיים נשארו ללא שינוי.'
        ]});
      }
      return rows;
    };
    wrapped.__v609Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
  updateChangelogV609();
  try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
})();


/*
===============================================================================
VERSION 6.10 BETA - CENTRAL CACHE REFRESH + DELETE SYNC
-------------------------------------------------------------------------------
1. Adds one central refresh function that rebuilds the visible month and all
   dependent screens only from WM_DATA_CACHE_V604, without reading workEntries.
2. Scheduled and completed deletions remove the deleted id from every cache
   bucket immediately after Firestore accepts the delete.
3. Calendar, selected day, statistics, Smart Dashboard and open search summary
   refresh together, preventing future features from needing separate fixes.
4. Firestore remains the write destination; the browser cache is the sole source
   for the immediate visible refresh after create/update/delete actions.
===============================================================================
*/
(function(){
  'use strict';
  if(window.__wmCentralCacheRefreshV610Installed)return;
  window.__wmCentralCacheRefreshV610Installed=true;

  function cacheV610(){return window.WM_DATA_CACHE_V604||null;}
  function padV610(n){return String(n).padStart(2,'0');}
  function mergeAllV610(state){
    var map=Object.create(null),out=[];
    function add(e){if(!e||!e.id)return;if(map[e.id])return;map[e.id]=true;out.push(e);}
    (state&&Array.isArray(state.entries)?state.entries:[]).forEach(add);
    if(state&&state.historicalMonths){Object.keys(state.historicalMonths).forEach(function(k){(state.historicalMonths[k]||[]).forEach(add);});}
    return out;
  }
  function monthSourceV610(state,key,end){
    if(state&&state.cutoff&&String(end)<String(state.cutoff))return (state.historicalMonths&&state.historicalMonths[key])||[];
    return state&&Array.isArray(state.entries)?state.entries:[];
  }
  function renderNoticeV610(html){
    var box=document.getElementById('entryMsg');
    if(box&&html)box.innerHTML=html;
  }
  function toastV610(text){
    var box=document.getElementById('wmCacheActionToastV610');
    if(!box){
      box=document.createElement('div');box.id='wmCacheActionToastV610';
      box.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000000;background:#153d2b;color:#fff;border:1px solid #61c48a;border-radius:12px;padding:11px 16px;font-weight:700;box-shadow:0 8px 28px #0007;direction:rtl;text-align:center;display:none;max-width:90vw';
      document.body.appendChild(box);
    }
    box.textContent=text;box.style.display='block';clearTimeout(box.__timerV610);
    box.__timerV610=setTimeout(function(){box.style.display='none';},2600);
  }

  // One reusable refresh path for all future cache-aware actions.
  window.wmRefreshFromCacheV610=function(options){
    options=options||{};
    var state=cacheV610();
    if(!state||!Array.isArray(state.entries))return false;
    try{
      window.workerAllEntriesV511=mergeAllV610(state);
      if(calendarDate instanceof Date){
        var y=calendarDate.getFullYear(),m=calendarDate.getMonth(),key=y+'-'+padV610(m+1);
        var start=key+'-01',end=key+'-'+padV610(new Date(y,m+1,0).getDate());
        monthEntries=monthSourceV610(state,key,end).filter(function(e){var d=String((e&&e.date)||'');return d>=start&&d<=end;});
      }
      if(typeof renderCalendar==='function')renderCalendar();
      if(typeof renderDay==='function')renderDay();
      if(typeof renderStats==='function')renderStats();
      if(typeof renderSmartDashboard==='function')renderSmartDashboard();
      var search=document.getElementById('searchPanel');
      if(search&&!search.classList.contains('hidden')&&typeof renderFullSummary==='function')renderFullSummary();
      if(options.messageHtml)renderNoticeV610(options.messageHtml);
      if(options.toast)toastV610(options.toast);
      return true;
    }catch(err){console.error('v6.10 cache refresh failed',err);return false;}
  };

  window.wmRemoveEntryFromCacheV610=function(id){
    var state=cacheV610();if(!state||!id)return false;
    if(Array.isArray(state.entries))state.entries=state.entries.filter(function(e){return !e||e.id!==id;});
    if(state.historicalMonths){Object.keys(state.historicalMonths).forEach(function(k){state.historicalMonths[k]=(state.historicalMonths[k]||[]).filter(function(e){return !e||e.id!==id;});});}
    return true;
  };

  // Final delete override: write once to Firestore, then refresh solely from cache.
  window.deleteEntry=async function(id){
    if(!id)return;
    var all=[];try{all=Array.isArray(window.workerAllEntriesV511)?window.workerAllEntriesV511:[];}catch(e){}
    var entry=all.find(function(x){return x&&x.id===id;})||(Array.isArray(monthEntries)?monthEntries:[]).find(function(x){return x&&x.id===id;});
    var label=entry?((entry.workType==='install'?'התקנה':'קריאת שירות')+(entry.customerNumber?' ללקוח '+entry.customerNumber:'')):'העבודה';
    if(!confirm('למחוק את '+label+'?'))return;
    try{
      await db.collection('workEntries').doc(id).delete();
      window.wmRemoveEntryFromCacheV610(id);
      window.wmRefreshFromCacheV610({messageHtml:'<div class="notice">העבודה נמחקה בהצלחה ✅</div>',toast:'העבודה נמחקה והמסך עודכן ✅'});
    }catch(e){
      var code=e&&(e.code||e.message)?(e.code||e.message):String(e),hint='שגיאה במחיקה: '+code;
      if(String(code).includes('permission-denied')||String(code).includes('Missing or insufficient permissions'))hint='Firestore חסם את המחיקה. צריך לפרסם את כללי האבטחה המתאימים ואז לנסות שוב.';
      renderNoticeV610('<p class="danger">'+String(hint).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>');
      alert(hint);
      try{if(typeof writeAppLogV167==='function')await writeAppLogV167('deleteEntryFailedV610',{entryId:id,errorCode:e.code||'',errorMessage:e.message||String(e)});}catch(_e){}
    }
  };
  try{deleteEntry=window.deleteEntry;}catch(e){}

  function updateChangelogV610(){
    var old=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
    if(typeof old!=='function'||old.__v610Wrapped)return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.10-beta';}))rows.unshift({version:'6.10-beta',title:'רענון מרכזי מהמטמון ותיקון מחיקת סידור עתידי',createdAt:'2026-07-25',items:[
        'נוסף מנגנון רענון מרכזי שמצייר מחדש את החודש, היום, הלוח, הסטטיסטיקות והדשבורד ישירות ממטמון השנתיים ללא קריאה חוזרת של workEntries.',
        'מחיקת עבודה רגילה או מתוזמנת מסירה כעת את הרשומה מכל מאגרי המטמון ומעדכנת מיד את המסך לאחר אישור המחיקה ב-Firestore.',
        'נוסף חיווי הצלחה ברור לאחר מחיקה, בלי צורך ברענון הדפדפן או פתיחת הגרסה היציבה.',
        'המנגנון המרכזי זמין גם לפעולות שמירה, עריכה ומחיקה עתידיות כדי למנוע תיקון נפרד לכל מסלול.'
      ]});
      return rows;
    };
    wrapped.__v610Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
  updateChangelogV610();
  try{window.APP_VERSION=APP_VERSION;if(typeof setAppVersionUI==='function')setAppVersionUI();}catch(e){}
})();
