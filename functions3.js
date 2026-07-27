/*
Work Monitor app - JavaScript continuation file.
File version: 6.33 STABLE - reliable direct historical vacation and day-lock synchronization.
Loaded after functions1.js and functions2.js. New additive functionality belongs here.
APP_VERSION remains defined only in functions1.js.
*/

/*
===============================================================================
VERSION 6.32 STABLE - LIVE VACATION AND DAY-LOCK SYNC FOR HISTORICAL MONTHS
-------------------------------------------------------------------------------
1. While a historical/boundary month is displayed, a temporary workerDaysOff
   listener is opened for the active worker alongside the workEntries listener.
2. Its snapshot refreshes the shared day-off cache, vacation markers and day
   locks before repainting the calendar/day/dashboard.
3. Moving to another historical month reuses the same worker listener; returning
   inside the 730-day window closes it completely.
4. No composite workerDaysOff index is required: the listener filters by workerId
   and the displayed month is filtered locally by the existing loaders.
===============================================================================
*/
/*
===============================================================================
VERSION 6.31 STABLE - LIVE SYNC FOR THE DISPLAYED HISTORICAL MONTH
-------------------------------------------------------------------------------
1. A historical/boundary month uses one temporary Firestore onSnapshot listener
   scoped only to that worker and that exact calendar month.
2. Moving to another historical month closes the previous listener first.
3. Returning to the rolling 730-day window closes the temporary listener fully.
4. Closing/reloading the page naturally destroys all listeners; pagehide and
   beforeunload also explicitly unsubscribe.
5. The first listener snapshot is also the initial month load, avoiding a GET
   followed by a duplicate listener snapshot for calendar navigation.
===============================================================================
*/
(function(){
  'use strict';
  if(window.__wmHistoricalLiveV631Installed)return;
  window.__wmHistoricalLiveV631Installed=true;

  var state=window.WM_DATA_CACHE_V604=window.WM_DATA_CACHE_V604||{};
  var activeUnsubscribe=null;
  var activeKey='';
  var activeWorkerId='';
  var activeFirstPromise=null;
  var activeFirstResolved=false;
  var listenerGeneration=0;
  var activeDayOffUnsubscribe=null;
  var activeDayOffWorkerId='';
  var activeDayOffRange=null;
  var activeDayOffFirstPromise=null;
  var activeDayOffFirstResolved=false;
  var dayOffListenerGeneration=0;

  function padV631(n){return String(n).padStart(2,'0');}
  function dateStrV631(d){return d.getFullYear()+'-'+padV631(d.getMonth()+1)+'-'+padV631(d.getDate());}
  function cutoffV631(){
    if(state&&state.cutoff)return String(state.cutoff);
    var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-730);
    return dateStrV631(d);
  }
  function monthRangeV631(value){
    var d=value instanceof Date?new Date(value.getTime()):new Date(String(value||'')+'T12:00:00');
    if(!(d instanceof Date)||isNaN(d.getTime()))return null;
    var y=d.getFullYear(),m=d.getMonth(),key=y+'-'+padV631(m+1);
    return {key:key,start:key+'-01',end:key+'-'+padV631(new Date(y,m+1,0).getDate())};
  }
  function activeWorkerV631(){
    try{return viewedWorker&&viewedWorker.id?String(viewedWorker.id):'';}catch(e){return '';}
  }
  function isHistoricalOrBoundaryV631(range){
    return !!(range&&String(range.start)<cutoffV631());
  }
  function displayedMonthKeyV631(){
    try{var r=monthRangeV631(calendarDate);return r?r.key:'';}catch(e){return '';}
  }
  function mergeAllV631(){
    var seen=Object.create(null),out=[];
    function add(entry){
      if(!entry||!entry.id||seen[entry.id])return;
      seen[entry.id]=true;out.push(entry);
    }
    (Array.isArray(state.entries)?state.entries:[]).forEach(add);
    if(state.historicalMonths){
      Object.keys(state.historicalMonths).forEach(function(key){
        (state.historicalMonths[key]||[]).forEach(add);
      });
    }
    return out;
  }
  function refreshDisplayedMonthV631(reason){
    window.workerAllEntriesV511=mergeAllV631();
    if(typeof window.wmRefreshFromCacheV610==='function'){
      window.wmRefreshFromCacheV610({reason:reason||'historical-live-v6.31'});
      return;
    }
    try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
    try{if(typeof renderDay==='function')renderDay();}catch(e){}
    try{if(typeof renderStats==='function')renderStats();}catch(e){}
    try{if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(e){}
  }
  function refreshHistoricalDayMetadataV633(rows,range,reason){
    rows=Array.isArray(rows)?rows:[];
    range=range||activeDayOffRange||null;
    if(!range)return Promise.resolve();

    // v6.33: listener data is now the direct source of truth for the displayed
    // historical month. Do not call legacy vacation/lock loaders here: they own
    // additional private caches and could race in a stale GET after this snapshot.
    try{
      window.vacationDaysV437=Array.from(new Set(rows.filter(function(d){
        d=d||{}; var date=String(d.date||'');
        return (d.type==='vacation'||!d.type) && d.active!==false && date>=range.start && date<=range.end;
      }).map(function(d){return String(d.date||'');}))).sort();
      window.vacationDaysLoadedForV437=activeDayOffWorkerId+'_'+range.key;
    }catch(e){console.error('v6.33 direct vacation snapshot apply failed',e);}

    try{
      if(typeof window.wmApplyHistoricalDayLocksV633==='function'){
        window.wmApplyHistoricalDayLocksV633(rows,range.start,range.end,activeDayOffWorkerId);
      }
    }catch(e){console.error('v6.33 direct lock snapshot apply failed',e);}

    // Keep shared caches aligned for validators and any later non-live consumer,
    // but never reload from them while this historical listener is active.
    try{
      var shared=window.WM_DAYOFF_DOCS_CACHE_V624=window.WM_DAYOFF_DOCS_CACHE_V624||{};
      shared.workerId=activeDayOffWorkerId; shared.docs=rows.slice(); shared.promise=null;
    }catch(e){}

    refreshDisplayedMonthV631(reason||'historical-day-metadata-v6.33');
    return Promise.resolve();
  }

  function stopHistoricalDayOffListenerV632(reason){
    dayOffListenerGeneration++;
    if(typeof activeDayOffUnsubscribe==='function'){
      try{activeDayOffUnsubscribe();}catch(e){console.warn('v6.32 workerDaysOff listener unsubscribe failed',e);}
    }
    activeDayOffUnsubscribe=null;
    activeDayOffWorkerId='';
    activeDayOffRange=null;
    activeDayOffFirstPromise=null;
    activeDayOffFirstResolved=false;
    state.historicalDayOffLiveWorker='';
    state.historicalDayOffLiveReason=reason||'';
  }
  window.stopHistoricalDayOffListenerV632=stopHistoricalDayOffListenerV632;

  function attachHistoricalDayOffListenerV632(workerId,range){
    if(!workerId)return Promise.resolve([]);
    if(activeDayOffUnsubscribe&&activeDayOffWorkerId===workerId&&activeDayOffRange&&range&&activeDayOffRange.key===range.key){
      if(activeDayOffFirstResolved){
        var cached=window.WM_DAYOFF_DOCS_CACHE_V624;
        return Promise.resolve(cached&&Array.isArray(cached.docs)?cached.docs:[]);
      }
      return activeDayOffFirstPromise||Promise.resolve([]);
    }

    stopHistoricalDayOffListenerV632('switch-worker');
    var myGeneration=dayOffListenerGeneration;
    activeDayOffWorkerId=workerId;
    activeDayOffRange=range||null;
    state.historicalDayOffLiveWorker=workerId;

    activeDayOffFirstPromise=new Promise(function(resolve,reject){
      var settled=false;
      activeDayOffUnsubscribe=db.collection('workerDaysOff')
        .where('workerId','==',workerId)
        .onSnapshot({includeMetadataChanges:true},function(snapshot){
          if(myGeneration!==dayOffListenerGeneration)return;
          var rows=snapshot.docs.map(function(doc){return Object.assign({id:doc.id},doc.data()||{});});
          state.historicalDayOffLastSnapshotAt=Date.now();
          state.historicalDayOffLastCount=rows.length;
          refreshHistoricalDayMetadataV633(rows,activeDayOffRange,'historical-dayoff-snapshot-v6.33').then(function(){
            if(!settled){settled=true;activeDayOffFirstResolved=true;resolve(rows);}
          }).catch(function(error){
            if(!settled){settled=true;reject(error);}
          });
        },function(error){
          if(myGeneration!==dayOffListenerGeneration)return;
          console.error('v6.32 historical workerDaysOff listener failed',error);
          if(!settled){settled=true;reject(error);}
        });
    });
    return activeDayOffFirstPromise;
  }
  window.attachHistoricalDayOffListenerV632=attachHistoricalDayOffListenerV632;

  function stopHistoricalListenerV631(reason){
    listenerGeneration++;
    stopHistoricalDayOffListenerV632(reason||'historical-stop');
    if(typeof activeUnsubscribe==='function'){
      try{activeUnsubscribe();}catch(e){console.warn('v6.31 historical listener unsubscribe failed',e);}
    }
    activeUnsubscribe=null;
    activeKey='';
    activeWorkerId='';
    activeFirstPromise=null;
    activeFirstResolved=false;
    state.historicalLiveMonth='';
    state.historicalLiveWorker='';
    state.historicalLiveReason=reason||'';
  }
  window.stopHistoricalMonthListenerV631=stopHistoricalListenerV631;

  function attachHistoricalListenerV631(range,workerId){
    if(!range||!workerId)return Promise.resolve([]);
    if(activeUnsubscribe&&activeKey===range.key&&activeWorkerId===workerId){
      if(activeFirstResolved){
        return Promise.resolve((state.historicalMonths&&state.historicalMonths[range.key])||[]);
      }
      return activeFirstPromise||Promise.resolve([]);
    }

    stopHistoricalListenerV631('switch-month');
    var myGeneration=listenerGeneration;
    activeKey=range.key;
    activeWorkerId=workerId;
    state.historicalLiveMonth=range.key;
    state.historicalLiveWorker=workerId;

    activeFirstPromise=new Promise(function(resolve,reject){
      var settled=false;
      var query=db.collection('workEntries')
        .where('workerId','==',workerId)
        .where('date','>=',range.start)
        .where('date','<=',range.end);

      activeUnsubscribe=query.onSnapshot({includeMetadataChanges:true},function(snapshot){
        if(myGeneration!==listenerGeneration)return;
        var rows=snapshot.docs.map(function(doc){return Object.assign({id:doc.id},doc.data()||{});});
        if(!state.historicalMonths)state.historicalMonths=Object.create(null);
        state.historicalMonths[range.key]=rows.slice();
        state.historicalLiveLastSnapshotAt=Date.now();
        state.historicalLiveLastCount=rows.length;
        if(displayedMonthKeyV631()===range.key&&activeWorkerV631()===workerId){
          refreshDisplayedMonthV631('historical-live-snapshot-v6.31');
        }else{
          window.workerAllEntriesV511=mergeAllV631();
        }
        if(!settled){settled=true;activeFirstResolved=true;resolve(rows);}
      },function(error){
        if(myGeneration!==listenerGeneration)return;
        console.error('v6.31 historical month listener failed',error);
        if(!settled){settled=true;reject(error);}
      });
    });
    return activeFirstPromise;
  }
  window.attachHistoricalMonthListenerV631=attachHistoricalListenerV631;

  var installedLoadMonthV631=window.loadMonth;
  if(typeof installedLoadMonthV631==='function'&&!installedLoadMonthV631.__historicalLiveV631){
    // v6.28's wrapper performs a one-time GET for old months. Its __baseV628 is
    // the normal month loader before that GET. We call that base for historical
    // calendar navigation and let the listener's first snapshot be the load.
    var normalLoadMonthV631=installedLoadMonthV631.__baseV628||installedLoadMonthV631;
    var loadMonthV631=async function(){
      var range=null;try{range=monthRangeV631(calendarDate);}catch(e){}
      var workerId=activeWorkerV631();
      if(!range||!workerId||!isHistoricalOrBoundaryV631(range)){
        stopHistoricalListenerV631('inside-730-window');
        return installedLoadMonthV631.apply(this,arguments);
      }

      var result=await normalLoadMonthV631.apply(this,arguments);
      try{
        await Promise.all([
          attachHistoricalListenerV631(range,workerId),
          attachHistoricalDayOffListenerV632(workerId,range)
        ]);
      }catch(error){
        // Fallback to the established exact-month GET only if the live listener
        // could not start, so historical navigation still remains usable.
        if(typeof window.loadHistoricalMonthFreshV628==='function'){
          await window.loadHistoricalMonthFreshV628(calendarDate);
          refreshDisplayedMonthV631('historical-listener-fallback-v6.31');
        }else{
          throw error;
        }
      }
      return result;
    };
    loadMonthV631.__historicalLiveV631=true;
    loadMonthV631.__baseV631=installedLoadMonthV631;
    window.loadMonth=loadMonthV631;
    try{loadMonth=loadMonthV631;}catch(e){}
  }

  // Explicit cleanup when the browser/PWA page leaves. A full process close also
  // destroys Firestore listeners automatically, but this keeps lifecycle clear.
  window.addEventListener('pagehide',function(){stopHistoricalListenerV631('pagehide');});
  window.addEventListener('beforeunload',function(){stopHistoricalListenerV631('beforeunload');});

  // v6.33 release entry.
  var oldRowsV633=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRowsV633==='function'&&!oldRowsV633.__v633Wrapped){
    var rowsV633=function(){
      var rows=[];try{rows=oldRowsV633.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.33';})){
        rows.unshift({version:'6.33',title:'סנכרון יציב לחופש ולנעילות בחודשים שמעל שנתיים',createdAt:'2026-07-27',items:[
          'תמונת workerDaysOff של החודש ההיסטורי מוחלת ישירות על ימי החופש ועל מערך הנעילות.',
          'הוסרו טעינות חוזרות דרך שכבות מטמון ישנות שיכלו לדרוס שינוי חדש ממכשיר אחר.',
          'הוספה, ביטול חופש, נעילה ופתיחת יום בחודש שמעל שנתיים מתעדכנים בזמן אמת וביציבות.',
          'המאזין נשאר זמני ונסגר במעבר לחודש אחר, בחזרה לטווח 730 הימים או בסגירת האפליקציה.'
        ]});
      }
      return rows;
    };
    rowsV633.__v633Wrapped=true; window.requiredChangelogRows=rowsV633;
    try{requiredChangelogRows=rowsV633;}catch(e){}
  }

  // v6.32 release entry. Existing Firestore/admin edits remain authoritative;
  // this local row is only added when the version does not already exist.
  var oldRowsV632=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRowsV632==='function'&&!oldRowsV632.__v632Wrapped){
    var rowsV632=function(){
      var rows=[];try{rows=oldRowsV632.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.32';})){
        rows.unshift({
          version:'6.32',
          title:'סנכרון חי לימי חופש ולנעילות בחודשים היסטוריים',
          createdAt:'2026-07-27',
          items:[
            'בחודש היסטורי פתוח נוסף listener זמני ל-workerDaysOff עבור העובד המחובר, לצד listener העבודות.',
            'סימון או ביטול יום חופש ממכשיר אחד מופיעים מיד במכשיר השני ומרעננים את הלוח, היום והדשבורד.',
            'נעילה או פתיחה של יום בחודש היסטורי מסתנכרנות מיד בין המכשירים.',
            'תמונת ה-listener מוזרמת למטמון המשותף ולכן אין GET נוסף ל-workerDaysOff בכל שינוי.',
            'בחזרה לטווח 730 הימים או בסגירת האפליקציה המאזין ההיסטורי נסגר לחלוטין.'
          ]
        });
      }
      return rows;
    };
    rowsV632.__v632Wrapped=true;
    window.requiredChangelogRows=rowsV632;
    try{requiredChangelogRows=rowsV632;}catch(e){}
  }

  // Add the release entry without changing the existing changelog source file.
  var oldRowsV631=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRowsV631==='function'&&!oldRowsV631.__v631Wrapped){
    var rowsV631=function(){
      var rows=[];try{rows=oldRowsV631.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.31';})){
        rows.unshift({
          version:'6.31',
          title:'סנכרון חי לחודש היסטורי פתוח ופיצול functions3',
          createdAt:'2026-07-27',
          items:[
            'כאשר מוצג חודש שמתחיל לפני גבול 730 הימים נפתח listener זמני רק לאותו חודש ולעובד המחובר.',
            'הוספה, עריכה או מחיקה ממכשיר אחר מתעדכנות מיד בלוח ובתצוגת היום בלי לעבור חודש קדימה ואחורה.',
            'במעבר לחודש היסטורי אחר המאזין הקודם נסגר, ובחזרה לטווח 730 הימים הוא נסגר לחלוטין.',
            'התמונה הראשונה של ה-listener משמשת גם לטעינת החודש ומונעת GET נוסף לפני פתיחת המאזין.',
            'נוסף functions3.js וה-index עודכן לטעון אותו; פונקציות קיימות נשארו בקבצים המקוריים.'
          ]
        });
      }
      return rows;
    };
    rowsV631.__v631Wrapped=true;
    window.requiredChangelogRows=rowsV631;
    try{requiredChangelogRows=rowsV631;}catch(e){}
  }
})();
