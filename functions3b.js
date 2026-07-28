/*
Work Monitor app - JavaScript continuation file.
File version: 6.42 BETA - direct workEntries listener hook with explicit IndexedDB save audit traces; startup remains Firestore-first.
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

  // v6.34-beta release entry: isolated beta entry point and b-suffixed JavaScript files.
  try{
    var originalRequiredRowsV634B=window.WM_REQUIRED_CHANGELOG_ROWS_V620;
    if(Array.isArray(originalRequiredRowsV634B) && !originalRequiredRowsV634B.some(function(r){return String(r.version||r.id||'')==='6.34-beta';})){
      originalRequiredRowsV634B.unshift({version:'6.34-beta',title:'מסלול בדיקות בטא מקביל לגרסה היציבה',createdAt:'2026-07-27',items:[
        'נוסף beta.html שטוען רק את functions1b.js, functions2b.js ו-functions3b.js.',
        'קובצי 6.33 היציבים נשארו ללא שינוי ו-index.html ממשיך לטעון אותם בלבד.',
        'התשתית מאפשרת לבדוק שינויים עתידיים בבטא בלי להחליף את מסלול העבודה היציב.'
      ]});
    }
  }catch(e){console.warn('v6.34-beta changelog entry failed',e);}

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


/*
===============================================================================
VERSION 6.35 BETA - PERSISTENT INDEXEDDB CACHE FOUNDATION
-------------------------------------------------------------------------------
1. The active worker's rolling 730-day workEntries snapshot is persisted in
   IndexedDB after every confirmed listener snapshot.
2. On a later beta launch, the saved snapshot is restored and painted before
   the Firestore listener finishes its first network snapshot.
3. Firestore remains the source of truth in this foundation stage; the existing
   listener is intentionally preserved until incremental-sync correctness is
   proven on multiple devices.
4. A compact beta-only status badge exposes local document count, save time,
   source and Firestore snapshot count for testing.
5. Stable index.html/functions*.js files are untouched.
===============================================================================
*/
(function(){
  'use strict';
  if(window.__wmBetaPersistentCacheV635Installed)return;
  window.__wmBetaPersistentCacheV635Installed=true;

  var DB_NAME='work_monitor_beta_cache';
  var DB_VERSION=1;
  var STORE='workerSnapshots';
  var state=window.WM_DATA_CACHE_V604=window.WM_DATA_CACHE_V604||{};
  var dbPromise=null;
  var restoredWorker='';
  var lastObservedSnapshot=-1;
  var lastPersistSignature='';
  var persistTimer=null;
  var status={phase:'מאתחל מטמון מקומי',source:'-',localDocs:0,firestoreDocs:0,lastSavedAt:'',lastRestoredAt:'',error:''};

  function activeWorkerIdV635(){
    try{return viewedWorker&&viewedWorker.id?String(viewedWorker.id):'';}catch(e){return '';}
  }
  function padV635(n){return String(n).padStart(2,'0');}
  function cutoffV635(){
    var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-730);
    return d.getFullYear()+'-'+padV635(d.getMonth()+1)+'-'+padV635(d.getDate());
  }
  function formatTimeV635(value){
    if(!value)return '-';
    try{return new Date(value).toLocaleString('he-IL');}catch(e){return String(value);}
  }
  function traceV641(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function openDbV635(){
    if(dbPromise)return dbPromise;
    traceV641('BETA_641_IDB_OPEN_START',{database:DB_NAME,version:DB_VERSION});
    dbPromise=new Promise(function(resolve,reject){
      if(!window.indexedDB){
        var unsupported=new Error('IndexedDB אינו נתמך בדפדפן הזה');
        traceV641('BETA_641_IDB_OPEN_ERROR',{error:unsupported.message});
        reject(unsupported);return;
      }
      var request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=function(event){
        var database=event.target.result;
        if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE,{keyPath:'workerId'});
      };
      request.onsuccess=function(){traceV641('BETA_641_IDB_OPEN_SUCCESS',{database:DB_NAME,version:DB_VERSION});resolve(request.result);};
      request.onerror=function(){var error=request.error||new Error('פתיחת IndexedDB נכשלה');traceV641('BETA_641_IDB_OPEN_ERROR',{error:String(error&&error.message||error)});reject(error);};
    });
    return dbPromise;
  }
  async function readSnapshotV635(workerId){
    var database=await openDbV635();
    return new Promise(function(resolve,reject){
      var tx=database.transaction(STORE,'readonly');
      var req=tx.objectStore(STORE).get(workerId);
      req.onsuccess=function(){resolve(req.result||null);};
      req.onerror=function(){reject(req.error||new Error('קריאת המטמון המקומי נכשלה'));};
    });
  }
  async function writeSnapshotV635(workerId,entries){
    var safeEntries=Array.isArray(entries)?entries:[];
    traceV641('BETA_641_IDB_SAVE_START',{workerId:workerId,docs:safeEntries.length});
    var database=await openDbV635();
    var row={workerId:workerId,cutoff:String(state.cutoff||cutoffV635()),entries:safeEntries,savedAt:new Date().toISOString(),schemaVersion:1,appVersion:String(window.APP_VERSION||'6.42-beta')};
    await new Promise(function(resolve,reject){
      var tx=database.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(row);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(){reject(tx.error||new Error('שמירת המטמון המקומי נכשלה'));};
      tx.onabort=function(){reject(tx.error||new Error('שמירת המטמון המקומי בוטלה'));};
    });
    status.lastSavedAt=row.savedAt;status.localDocs=row.entries.length;status.phase='המטמון המקומי מעודכן';status.source='Firestore → IndexedDB';status.error='';
    renderStatusV635();
    traceV641('BETA_641_IDB_SAVE_SUCCESS',{workerId:workerId,docs:row.entries.length,savedAt:row.savedAt});
    return row;
  }
  async function deleteSnapshotV635(workerId){
    var database=await openDbV635();
    await new Promise(function(resolve,reject){
      var tx=database.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(workerId);
      tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};
    });
  }
  function paintFromLocalV635(){
    try{
      if(typeof window.renderCurrentHistoricalMonthV631==='function')window.renderCurrentHistoricalMonthV631('indexeddb-restore-v6.35');
      else{
        window.workerAllEntriesV511=Array.isArray(state.entries)?state.entries.slice():[];
        if(typeof loadMonth==='function'){
          // Do not recursively call wrapped loadMonth here. Existing render functions
          // are enough for the current month after monthEntries is filtered below.
          var d=calendarDate,y=d.getFullYear(),m=d.getMonth();
          var start=y+'-'+padV635(m+1)+'-01',end=y+'-'+padV635(m+1)+'-'+padV635(new Date(y,m+1,0).getDate());
          monthEntries=(state.entries||[]).filter(function(e){return String(e.date||'')>=start&&String(e.date||'')<=end;});
          try{renderCalendar();}catch(e){} try{renderDay();}catch(e){} try{renderStats();}catch(e){} try{renderSmartDashboard();}catch(e){}
        }
      }
    }catch(e){console.warn('[WM 6.35 BETA] local paint failed',e);}
  }
  async function restoreWorkerV635(workerId){
    if(!workerId||restoredWorker===workerId)return null;
    restoredWorker=workerId;status.phase='קורא נתונים מקומיים';status.source='IndexedDB';renderStatusV635();
    try{
      var row=await readSnapshotV635(workerId);
      if(!row||!Array.isArray(row.entries)){
        status.phase='אין עדיין מטמון במכשיר';status.source='Firestore בהפעלה הראשונה';status.localDocs=0;renderStatusV635();return null;
      }
      var currentCutoff=cutoffV635();
      var rows=row.entries.filter(function(e){return String(e&&e.date||'')>=currentCutoff;});
      // Seed only before the first Firestore snapshot of this launch. Never replace
      // fresher live data with an older persisted snapshot.
      if(!state.snapshotCount||!Array.isArray(state.entries)||state.entries.length===0){
        state.workerId=workerId;state.cutoff=currentCutoff;state.entries=rows;
        window.workerAllEntriesV511=rows.slice();
        status.phase='הוצג מיד מהמטמון המקומי';status.source='IndexedDB';status.localDocs=rows.length;status.lastSavedAt=row.savedAt||'';status.lastRestoredAt=new Date().toISOString();status.error='';
        paintFromLocalV635();
      }
      renderStatusV635();
      return row;
    }catch(error){
      status.phase='שגיאת מטמון מקומי';status.error=error&&error.message?error.message:String(error);renderStatusV635();console.warn('[WM 6.35 BETA] restore failed',error);return null;
    }
  }
  function schedulePersistV635(){
    clearTimeout(persistTimer);
    persistTimer=setTimeout(async function(){
      var workerId=activeWorkerIdV635();
      if(!workerId||state.workerId!==workerId||!Array.isArray(state.entries))return;
      var signature=workerId+'|'+String(state.snapshotCount||0)+'|'+state.entries.length+'|'+String(state.cutoff||'');
      if(signature===lastPersistSignature)return;
      try{await writeSnapshotV635(workerId,state.entries);lastPersistSignature=signature;}catch(error){status.phase='שמירת המטמון נכשלה';status.error=error&&error.message?error.message:String(error);renderStatusV635();traceV641('BETA_641_IDB_SAVE_ERROR',{workerId:workerId,error:String(error&&error.message||error)});console.warn('[WM 6.41 BETA] persist failed',error);}
    },350);
  }
  function renderStatusV635(){
    if(!document.body)return;
    var box=document.getElementById('wmBetaPersistentCacheV635');
    if(!box){
      box=document.createElement('button');box.type='button';box.id='wmBetaPersistentCacheV635';
      box.setAttribute('aria-label','מצב המטמון המקומי של גרסת הבטא');
      box.style.cssText='position:fixed;left:10px;bottom:10px;z-index:999998;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(20,24,33,.94);color:#fff;padding:7px 10px;direction:rtl;text-align:right;font:12px/1.35 Arial,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.28);max-width:260px;cursor:pointer;';
      box.addEventListener('click',function(){
        var details='גרסת בטא '+String(window.APP_VERSION||'')+'\n\nמצב: '+status.phase+'\nמקור: '+status.source+'\nמסמכים מקומיים: '+status.localDocs+'\nמסמכים מהמאזין: '+status.firestoreDocs+'\nשמירה אחרונה: '+formatTimeV635(status.lastSavedAt)+'\nשחזור אחרון: '+formatTimeV635(status.lastRestoredAt)+(status.error?'\nשגיאה: '+status.error:'');
        alert(details);
      });
      document.body.appendChild(box);
    }
    box.innerHTML='<strong>בטא · מטמון מקומי</strong><br>'+status.phase+'<br><span style="opacity:.8">מקומי: '+Number(status.localDocs||0).toLocaleString('he-IL')+' · Firestore: '+Number(status.firestoreDocs||0).toLocaleString('he-IL')+'</span>';
  }
  function wrapLoadMonthV635(){
    var original=window.loadMonth||(typeof loadMonth==='function'?loadMonth:null);
    if(typeof original!=='function'||original.__indexedDbV635)return;
    var wrapped=async function(){
      // v6.41 BETA: save-only verification. Startup never waits for or paints
      // IndexedDB data. Firestore remains the only startup source in this test.
      try{return await original.apply(this,arguments);}catch(error){
        try{window.wmTraceV617&&window.wmTraceV617('BETA_LOAD_MONTH_ERROR',{error:String(error&&error.stack||error)});}catch(e){}
        throw error;
      }
    };
    wrapped.__indexedDbV635=true;wrapped.__baseV635=original;
    window.loadMonth=wrapped;try{loadMonth=wrapped;}catch(e){}
  }
  function installStartupWatchdogV640(){
    if(window.__wmStartupWatchdogV640)return;
    window.__wmStartupWatchdogV640=true;
    setTimeout(function(){
      var overlay=document.getElementById('workerLoadingOverlayV427');
      var bodyActive=!!(document.body&&document.body.classList.contains('worker-loading-active-v427'));
      var visible=false;
      try{visible=!!(overlay&&(bodyActive||getComputedStyle(overlay).display!=='none')&&getComputedStyle(overlay).visibility!=='hidden');}catch(e){}
      if(!visible)return;
      try{if(typeof hideWorkerLoading427==='function')hideWorkerLoading427();}catch(e){}
      try{document.body.classList.remove('worker-loading-active-v427','worker-main-loading-v428');}catch(e){}
      try{overlay.style.display='none';}catch(e){}
      try{window.wmTraceV617&&window.wmTraceV617('BETA_640_LOADING_WATCHDOG_RELEASED',{afterMs:8000});}catch(e){}
    },8000);
  }
  function observeSnapshotsV635(){
    setInterval(function(){
      var workerId=activeWorkerIdV635();
      // v6.41 save-only: do not restore or paint local data during startup.
      var count=Number(state.snapshotCount||0);
      status.firestoreDocs=Array.isArray(state.entries)?state.entries.length:0;
      if(count!==lastObservedSnapshot){
        lastObservedSnapshot=count;
        if(count>0){status.phase='התקבל עדכון חי מ-Firestore';status.source='Firestore listener';schedulePersistV635();}
        renderStatusV635();
      }
    },500);
  }
  async function resetCurrentWorkerV635(){
    var workerId=activeWorkerIdV635();if(!workerId)return false;
    await deleteSnapshotV635(workerId);restoredWorker='';lastPersistSignature='';status.localDocs=0;status.lastSavedAt='';status.phase='המטמון המקומי נמחק';status.source='Firestore';renderStatusV635();return true;
  }

  window.WM_BETA_LOCAL_CACHE_V635={
    restore:restoreWorkerV635,
    persist:function(){var id=activeWorkerIdV635();return id?writeSnapshotV635(id,state.entries||[]):Promise.resolve(null);},
    // v6.42 BETA: direct listener hook passes the exact snapshot rows here.
    persistRows:function(workerId,entries){return workerId&&Array.isArray(entries)&&entries.length?writeSnapshotV635(String(workerId),entries):Promise.resolve(null);},
    reset:resetCurrentWorkerV635,
    getStatus:function(){return Object.assign({},status);},
    databaseName:DB_NAME
  };

  function bootV635(){installStartupWatchdogV640();renderStatusV635();wrapLoadMonthV635();observeSnapshotsV635();traceV641('BETA_641_SAVE_ONLY_BOOT_READY',{indexedDB:!!window.indexedDB});}
  function traceV636(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  traceV636('BETA_636_SCRIPT_READY',{indexedDB:!!window.indexedDB,readyState:document.readyState});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){traceV636('BETA_636_DOM_READY',{});setTimeout(function(){try{bootV635();traceV636('BETA_636_CACHE_BOOT_CALLED',{});}catch(error){traceV636('BETA_636_CACHE_BOOT_ERROR',{error:String(error&&error.stack||error)});}},1100);});else setTimeout(function(){try{bootV635();traceV636('BETA_636_CACHE_BOOT_CALLED',{});}catch(error){traceV636('BETA_636_CACHE_BOOT_ERROR',{error:String(error&&error.stack||error)});}},400);
  window.addEventListener('load',function(){traceV636('BETA_636_WINDOW_LOAD',{});setTimeout(function(){try{wrapLoadMonthV635();}catch(error){traceV636('BETA_636_WRAP_ERROR',{error:String(error&&error.stack||error)});}},1500);});

  // Local beta changelog entry. Admin Firestore records remain authoritative.
  var oldRowsV635=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRowsV635==='function'&&!oldRowsV635.__v635Wrapped){
    var rowsV635=function(){
      var rows=[];try{rows=oldRowsV635.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.42-beta';}))rows.unshift({version:'6.42-beta',title:'חיבור ישיר של מאזין העבודות לשמירת IndexedDB',createdAt:'2026-07-28',items:[
        'נוסף hook ישיר ל-onSnapshot של workEntries, כך שכל snapshot לא-ריק מועבר מיד לשמירת IndexedDB.',
        'השמירה פועלת גם כאשר תמונת המצב הראשונה מגיעה מהמטמון הפנימי של Firestore עם fromCache=true.',
        'נוספו אירועי BETA_642_WORKENTRIES_CACHE_HOOK ו-BETA_642_IDB_SAVE_* לבדיקת החיבור והשמירה בפועל.',
        'בשלב זה ההפעלה נשארת Firestore-first ואינה קוראת מהמטמון החדש בזמן העלייה.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.41-beta';}))rows.unshift({version:'6.41-beta',title:'בדיקת שמירה בטוחה ל-IndexedDB',createdAt:'2026-07-27',items:[
        'הפעלת הבטא נשארת Firestore-first ואינה קוראת או מציגה נתונים מ-IndexedDB בזמן העלייה.',
        'לאחר snapshot מאומת של workEntries, הנתונים נשמרים ל-IndexedDB ברקע בלבד.',
        'נוספו אירועי דיבאג מפורשים לפתיחת בסיס הנתונים ולהתחלה, הצלחה או שגיאה בשמירה.',
        'הגרסה היציבה 6.33 והקבצים היציבים לא שונו.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.35-beta';}))rows.unshift({version:'6.35-beta',title:'תשתית מטמון קבוע ב-IndexedDB',createdAt:'2026-07-27',items:[
        'גרסת הבטא שומרת במכשיר את תמונת 730 הימים שמתקבלת מהמאזין הראשי.',
        'בפתיחה חוזרת הנתונים המקומיים מוצגים לפני סיום טעינת Firestore.',
        'נוסף מחוון בטא קטן המציג כמה מסמכים קיימים מקומית וכמה התקבלו מהמאזין.',
        'בשלב זה המאזין המלא נשאר כמקור האמת; ביטול הטעינה המלאה יבוצע רק לאחר בדיקות אמינות המטמון.'
      ]});
      return rows;
    };
    rowsV635.__v635Wrapped=true;window.requiredChangelogRows=rowsV635;try{requiredChangelogRows=rowsV635;}catch(e){}
  }
})();


/* VERSION 6.36 BETA - fail-open startup and permanent diagnostics */
(function(){
  var old=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof old!=='function'||old.__v636Wrapped)return;
  var wrapped=function(){
    var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
    if(!rows.some(function(r){return String(r.version||r.id||'')==='6.36-beta';}))rows.unshift({version:'6.36-beta',title:'תיקון תקיעת הבטא וחלון Debug קבוע',createdAt:'2026-07-27',items:[
      'IndexedDB אינו חוסם עוד את עליית האפליקציה; שחזור המטמון מתבצע במקביל ועם timeout בטוח.',
      'אם המטמון המקומי נכשל, האפליקציה ממשיכה אוטומטית למסלול Firestore הרגיל.',
      'חלון Firebase Debug נפתח אוטומטית ב-beta.html ללא פרמטר בכתובת.',
      'נוספו כפתורי העתקה, ניקוי ומזעור וכן רישום שגיאות JavaScript ו-Promise לא מטופלות.'
    ]});
    return rows;
  };
  wrapped.__v636Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
})();


/*
===============================================================================
VERSION 6.42 BETA - DIRECT WORKENTRIES LISTENER → INDEXEDDB SAVE HOOK
-------------------------------------------------------------------------------
1. Decorates Firestore workEntries query objects after the existing audit layer.
2. Wraps the real onSnapshot callback and sends every non-empty snapshot directly
   to the beta IndexedDB writer, including an initial fromCache=true snapshot.
3. Does not delay, replace or alter the original listener callback and therefore
   keeps startup Firestore-first and fail-open.
===============================================================================
*/
(function(){
  'use strict';
  if(window.__wmDirectWorkEntriesIdbHookV642Installed)return;
  window.__wmDirectWorkEntriesIdbHookV642Installed=true;

  var decorated=typeof WeakSet==='function'?new WeakSet():null;
  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function isWorkEntriesPath(path){return String(path||'').split('/')[0]==='workEntries';}
  function decorate(query,path){
    if(!query||!isWorkEntriesPath(path))return query;
    if(decorated&&decorated.has(query))return query;
    if(decorated)decorated.add(query);

    ['where','orderBy','limit','limitToLast','startAt','startAfter','endAt','endBefore'].forEach(function(name){
      if(typeof query[name]!=='function')return;
      var original=query[name];
      try{
        query[name]=function(){return decorate(original.apply(this,arguments),path);};
      }catch(e){trace('BETA_642_HOOK_WRAP_ERROR',{method:name,error:String(e&&e.message||e)});}
    });

    if(typeof query.onSnapshot==='function'){
      var originalListen=query.onSnapshot;
      try{
        query.onSnapshot=function(){
          var self=this,args=Array.prototype.slice.call(arguments),nextIndex=0;
          if(args[0]&&typeof args[0]==='object'&&typeof args[0]!=='function')nextIndex=1;
          var originalNext=args[nextIndex];
          if(typeof originalNext==='function'){
            args[nextIndex]=function(snapshot){
              try{
                var rows=(snapshot&&snapshot.docs?snapshot.docs:[]).map(function(doc){return Object.assign({id:doc.id},doc.data()||{});});
                var workerId='';
                try{workerId=viewedWorker&&viewedWorker.id?String(viewedWorker.id):String((window.WM_DATA_CACHE_V604&&window.WM_DATA_CACHE_V604.workerId)||'');}catch(e){}
                var meta={workerId:workerId,docs:rows.length,fromCache:!!(snapshot&&snapshot.metadata&&snapshot.metadata.fromCache),pending:!!(snapshot&&snapshot.metadata&&snapshot.metadata.hasPendingWrites)};
                trace('BETA_642_WORKENTRIES_CACHE_HOOK',meta);
                if(workerId&&rows.length&&window.WM_BETA_LOCAL_CACHE_V635&&typeof window.WM_BETA_LOCAL_CACHE_V635.persistRows==='function'){
                  window.WM_BETA_LOCAL_CACHE_V635.persistRows(workerId,rows).catch(function(error){
                    trace('BETA_642_IDB_SAVE_ERROR',{workerId:workerId,docs:rows.length,error:String(error&&error.message||error)});
                  });
                }else if(!rows.length){
                  trace('BETA_642_IDB_SAVE_SKIPPED',{reason:'empty-snapshot',workerId:workerId});
                }else{
                  trace('BETA_642_IDB_SAVE_SKIPPED',{reason:'writer-not-ready',workerId:workerId,docs:rows.length});
                }
              }catch(error){trace('BETA_642_HOOK_ERROR',{error:String(error&&error.stack||error)});}
              return originalNext.apply(this,arguments);
            };
          }
          return originalListen.apply(self,args);
        };
      }catch(e){trace('BETA_642_HOOK_WRAP_ERROR',{method:'onSnapshot',error:String(e&&e.message||e)});}
    }
    return query;
  }

  function install(){
    if(!window.db||typeof window.db.collection!=='function'){
      setTimeout(install,100);
      return;
    }
    if(window.db.collection.__wmV642Wrapped)return;
    var originalCollection=window.db.collection;
    var wrapped=function(){
      var q=originalCollection.apply(this,arguments);
      var path=q&&q.path?q.path:String(arguments[0]||'');
      return decorate(q,path);
    };
    wrapped.__wmV642Wrapped=true;
    try{window.db.collection=wrapped;trace('BETA_642_DIRECT_HOOK_INSTALLED',{collection:'workEntries'});}catch(error){trace('BETA_642_HOOK_INSTALL_ERROR',{error:String(error&&error.message||error)});}
  }
  install();
})();
