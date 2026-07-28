/* File version: 6.48 BETA - priceList IndexedDB cache and delta-only synchronization.
Work Monitor app - JavaScript continuation file.
File version: 6.48 BETA - priceList cache-first synchronization diagnostics and changelog support.
Loaded after functions1.js and functions2.js. New additive functionality belongs here.
APP_VERSION remains defined only in functions1.js.
*/
window.WM_LOADED_FILE_VERSIONS = window.WM_LOADED_FILE_VERSIONS || {};
window.WM_LOADED_FILE_VERSIONS.functions3b = "6.48-beta";


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
    traceV641('CACHE_IDB_OPEN_START',{database:DB_NAME,version:DB_VERSION});
    dbPromise=new Promise(function(resolve,reject){
      if(!window.indexedDB){
        var unsupported=new Error('IndexedDB אינו נתמך בדפדפן הזה');
        traceV641('CACHE_IDB_OPEN_ERROR',{error:unsupported.message});
        reject(unsupported);return;
      }
      var request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=function(event){
        var database=event.target.result;
        if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE,{keyPath:'workerId'});
      };
      request.onsuccess=function(){traceV641('CACHE_IDB_OPEN_SUCCESS',{database:DB_NAME,version:DB_VERSION});resolve(request.result);};
      request.onerror=function(){var error=request.error||new Error('פתיחת IndexedDB נכשלה');traceV641('CACHE_IDB_OPEN_ERROR',{error:String(error&&error.message||error)});reject(error);};
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
    traceV641('CACHE_IDB_SAVE_START',{workerId:workerId,docs:safeEntries.length});
    var database=await openDbV635();
    var row={workerId:workerId,cutoff:String(state.cutoff||cutoffV635()),entries:safeEntries,savedAt:new Date().toISOString(),schemaVersion:1,appVersion:String(window.APP_VERSION||'6.45-beta')};
    await new Promise(function(resolve,reject){
      var tx=database.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(row);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(){reject(tx.error||new Error('שמירת המטמון המקומי נכשלה'));};
      tx.onabort=function(){reject(tx.error||new Error('שמירת המטמון המקומי בוטלה'));};
    });
    status.lastSavedAt=row.savedAt;status.localDocs=row.entries.length;status.phase='המטמון המקומי מעודכן';status.source='Firestore → IndexedDB';status.error='';
    renderStatusV635();
    traceV641('CACHE_IDB_SAVE_SUCCESS',{workerId:workerId,docs:row.entries.length,savedAt:row.savedAt});
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
      try{await writeSnapshotV635(workerId,state.entries);lastPersistSignature=signature;}catch(error){status.phase='שמירת המטמון נכשלה';status.error=error&&error.message?error.message:String(error);renderStatusV635();traceV641('BETA_643_IDB_SAVE_ERROR',{workerId:workerId,error:String(error&&error.message||error)});console.warn('[WM 6.43 BETA] persist failed',error);}
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
    // v6.43 BETA: the original workEntries listener passes the exact snapshot rows here.
    persistRows:function(workerId,entries){return workerId&&Array.isArray(entries)&&entries.length?writeSnapshotV635(String(workerId),entries):Promise.resolve(null);},
    closeDatabase:async function(){
      try{var database=dbPromise?await dbPromise:null;if(database&&typeof database.close==='function')database.close();}catch(e){}
      dbPromise=null;
      return true;
    },
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
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.43-beta';}))rows.unshift({version:'6.43-beta',title:'שמירת IndexedDB מתוך המאזין המקורי',createdAt:'2026-07-28',items:[
        'קריאת השמירה הועברה ישירות לתוך callback המקורי של מאזין workEntries ב-functions2b.js.',
        'הוסר מנגנון העטיפה החיצוני של 6.42 שלא התחבר בפועל למאזין הקיים.',
        'כל snapshot לא-ריק נשמר ל-IndexedDB גם כאשר הוא מגיע מהמטמון הפנימי של Firestore.',
        'נוספו אירועי BETA_643 מפורשים לקריאה, פתיחה, שמירה, הצלחה ושגיאה.'
      ]});
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


/* ======================================================================
VERSION 6.45 BETA - FILE VERSION AUDIT + ADMIN LOCAL CACHE RESET TOOLS
1. Every beta file publishes its own runtime version marker.
2. The Firebase Audit log now receives a BOOT_FILE_VERSIONS row after all scripts load.
3. IndexedDB/cache events are copied into the same audit log for one-file diagnosis.
4. Admin-only buttons can clear app data caches or perform a full local reset.
====================================================================== */
(function installBetaDiagnosticsAndAdminResetV644(){
  'use strict';
  if(window.__wmBetaDiagnosticsV644)return;
  window.__wmBetaDiagnosticsV644=true;
  var EXPECTED='6.48-beta';

  function trace(event,data){
    try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}
  }
  function fileVersions(){
    var v=window.WM_LOADED_FILE_VERSIONS||{};
    return {
      html:String(v.html||'MISSING'),
      functions1b:String(v.functions1b||'MISSING'),
      functions2b:String(v.functions2b||'MISSING'),
      functions3b:String(v.functions3b||'MISSING'),
      appVersion:String(window.APP_VERSION||'MISSING')
    };
  }
  function emitFileAudit(){
    var v=fileVersions();
    v.expected=EXPECTED;
    v.allMatch=[v.html,v.functions1b,v.functions2b,v.functions3b,v.appVersion].every(function(x){return x===EXPECTED;});
    trace('BOOT_FILE_VERSIONS',v);
    if(!v.allMatch)trace('BOOT_FILE_VERSION_MISMATCH',v);
    window.WM_BETA_FILE_AUDIT_V644=v;
  }

  function deleteDatabase(name){
    return new Promise(function(resolve){
      try{
        var req=indexedDB.deleteDatabase(name);
        req.onsuccess=function(){resolve({name:name,deleted:true});};
        req.onerror=function(){resolve({name:name,deleted:false,error:String(req.error&&req.error.message||req.error||'delete error')});};
        req.onblocked=function(){resolve({name:name,deleted:false,blocked:true});};
      }catch(e){resolve({name:name,deleted:false,error:String(e&&e.message||e)});}
    });
  }
  async function indexedDbNames(){
    try{
      if(indexedDB.databases){
        var rows=await indexedDB.databases();
        return rows.map(function(x){return x&&x.name;}).filter(Boolean);
      }
    }catch(e){}
    var own=(window.WM_BETA_LOCAL_CACHE_V635&&window.WM_BETA_LOCAL_CACHE_V635.databaseName)||'work-monitor-beta-cache-v635';
    return [own];
  }
  async function clearIndexedDbV644(){
    trace('ADMIN_CACHE_INDEXEDDB_START',{});
    try{if(window.WM_BETA_LOCAL_CACHE_V635&&typeof window.WM_BETA_LOCAL_CACHE_V635.closeDatabase==='function')await window.WM_BETA_LOCAL_CACHE_V635.closeDatabase();}catch(e){trace('ADMIN_CACHE_INDEXEDDB_CLOSE_ERROR',{error:String(e&&e.message||e)});}
    var names=await indexedDbNames();
    var targets=names.filter(function(name){return /work.?monitor|firestore|firebase/i.test(String(name||''));});
    if(!targets.length)targets=names;
    var results=[];
    for(var i=0;i<targets.length;i++)results.push(await deleteDatabase(targets[i]));
    trace('ADMIN_CACHE_INDEXEDDB_DONE',{targets:targets,results:results});
    return results;
  }
  async function clearCacheStorageV644(){
    trace('ADMIN_CACHE_STORAGE_START',{});
    var deleted=[];
    try{
      if(window.caches){
        var keys=await caches.keys();
        for(var i=0;i<keys.length;i++)if(await caches.delete(keys[i]))deleted.push(keys[i]);
      }
      trace('ADMIN_CACHE_STORAGE_DONE',{deleted:deleted});
    }catch(e){trace('ADMIN_CACHE_STORAGE_ERROR',{error:String(e&&e.message||e)});}
    return deleted;
  }
  async function stopFirestoreV644(){
    trace('ADMIN_CACHE_FIRESTORE_STOP_START',{});
    try{if(window.db&&typeof db.disableNetwork==='function')await db.disableNetwork();}catch(e){trace('ADMIN_CACHE_FIRESTORE_DISABLE_ERROR',{error:String(e&&e.message||e)});}
    try{if(window.db&&typeof db.terminate==='function')await db.terminate();trace('ADMIN_CACHE_FIRESTORE_STOP_DONE',{});}catch(e){trace('ADMIN_CACHE_FIRESTORE_STOP_ERROR',{error:String(e&&e.message||e)});}
  }
  function confirmAction(text){return window.confirm(text);}
  function setMsg(text,isError){
    var el=document.getElementById('adminLocalCacheMsgV644');
    if(el){el.textContent=text;el.className=isError?'danger':'success';}
  }
  async function clearDataCacheV644(){
    if(!confirmAction('הפעולה תמחק מהמכשיר את IndexedDB, מטמון Firestore ו-Cache Storage ותטען את האפליקציה מחדש. הנתונים ב-Firebase לא יימחקו. להמשיך?'))return;
    setMsg('מנקה מטמון מקומי...');trace('ADMIN_CACHE_CLEAR_START',{mode:'data-cache'});
    try{
      await stopFirestoreV644();
      await clearIndexedDbV644();
      await clearCacheStorageV644();
      trace('ADMIN_CACHE_CLEAR_DONE',{mode:'data-cache'});
      setMsg('המטמון נמחק. האפליקציה נטענת מחדש...');
      setTimeout(function(){location.reload();},700);
    }catch(e){trace('ADMIN_CACHE_CLEAR_ERROR',{mode:'data-cache',error:String(e&&e.message||e)});setMsg('ניקוי המטמון נכשל: '+String(e&&e.message||e),true);}
  }
  async function fullLocalResetV644(){
    if(!confirmAction('איפוס מקומי מלא ידמה ככל האפשר מכשיר חדש: מטמונים, IndexedDB, localStorage ו-sessionStorage יימחקו. ייתכן שתנותק מהחשבון. הנתונים ב-Firebase לא יימחקו. להמשיך?'))return;
    setMsg('מבצע איפוס מקומי מלא...');trace('ADMIN_CACHE_CLEAR_START',{mode:'full-local-reset'});
    try{
      await stopFirestoreV644();
      await clearIndexedDbV644();
      await clearCacheStorageV644();
      try{localStorage.clear();trace('ADMIN_CACHE_LOCAL_STORAGE_CLEARED',{});}catch(e){trace('ADMIN_CACHE_LOCAL_STORAGE_ERROR',{error:String(e&&e.message||e)});}
      try{sessionStorage.clear();}catch(e){}
      trace('ADMIN_CACHE_CLEAR_DONE',{mode:'full-local-reset'});
      setTimeout(function(){location.href='beta.html?firebaseDebug=1&fresh='+Date.now();},500);
    }catch(e){trace('ADMIN_CACHE_CLEAR_ERROR',{mode:'full-local-reset',error:String(e&&e.message||e)});setMsg('האיפוס נכשל: '+String(e&&e.message||e),true);}
  }
  window.clearAdminDataCacheV644=clearDataCacheV644;
  window.fullAdminLocalResetV644=fullLocalResetV644;
  window.getBetaFileVersionsV644=fileVersions;

  function boot(){setTimeout(emitFileAudit,80);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v644Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.45-beta';}))rows.unshift({version:'6.45-beta',title:'שמירת IndexedDB מתוך המאזין הפעיל',createdAt:'2026-07-28',items:[
        'שמירת workEntries חוברה ישירות למאזין startListenerV613 שפועל בפועל בזמן הריצה.',
        'הוסר נתיב השמירה מהמאזין הישן כדי למנוע בדיקות מטעות ושמירה כפולה בעתיד.',
        'נוספו אירועי CACHE_IDB_ACTIVE_LISTENER_SAVE_CALL, DONE, SKIPPED ו-ERROR לחלון Firebase Audit.',
        'אירועי פתיחת ושמירת IndexedDB קיבלו שמות קבועים שאינם תלויים במספר גרסה.',
        'בדיקת גרסאות הקבצים וכפתורי ניקוי המטמון באדמין נשמרו ללא שינוי.'
      ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.44-beta';}))rows.unshift({version:'6.44-beta',title:'בדיקת גרסאות קבצים ואיפוס מטמון באדמין',createdAt:'2026-07-28',items:[
        'כל אחד מקובצי הבטא מפרסם בלוג את הגרסה המדויקת שנטענה בפועל מהשרת.',
        'חלון Firebase Audit מציג BOOT_FILE_VERSIONS ומזהה אוטומטית קובץ חסר או גרסה שאינה תואמת.',
        'אירועי IndexedDB והמטמון נכנסים כעת לאותו לוג שמועתק מחלון הבדיקה.',
        'נוספו באדמין כפתורי נקה מטמון נתונים ואיפוס מקומי מלא לצורך בדיקת פתיחה כמו במכשיר חדש.'
      ]});
      return rows;
    };
    wrapped.__v644Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.46 BETA - LOCAL-FIRST INDEXEDDB RESTORE TEST
1. Restores the active worker's two-year workEntries snapshot from IndexedDB before
   the existing Firestore startup route is allowed to continue.
2. Paints the worker UI from the restored rows immediately when a valid local
   snapshot exists.
3. Keeps the existing active Firestore listener as the authoritative verifier in
   this test version; read reduction is not claimed until delta-sync is proven.
4. Adds audit-visible restore timing, row count, savedAt and fallback/error events.
===============================================================================
*/
(function installDeltaModeAuditV647(){
  'use strict';
  if(window.__wmDeltaModeAuditV647)return;
  window.__wmDeltaModeAuditV647=true;
  try{window.wmTraceV617&&window.wmTraceV617('CACHE_DELTA_MODE_READY',{version:'6.47-beta'});}catch(e){}

  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v647Wrapped){
    var wrappedRows=function(){
      var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.47-beta';}))rows.unshift({
        version:'6.47-beta',
        title:'סנכרון workEntries דיפרנציאלי מהמטמון המקומי',
        createdAt:'2026-07-28',
        items:[
          'כאשר נמצא snapshot תקין ב-IndexedDB, האפליקציה מדלגת על מאזין השנתיים המלא של workEntries.',
          'במקום הורדה חוזרת של כל הרשומות, נפתחים מאזינים רק למסמכים שנוצרו או עודכנו אחרי זמן השמירה המקומי.',
          'נוספו אירועי CACHE_SKIP_FULL_WORKENTRIES_LOAD, CACHE_NO_FULL_DOWNLOAD, FIRESTORE_LISTENER_DELTA_MODE ו-FIRESTORE_DELTA_SNAPSHOT.',
          'כאשר אין מטמון תקין או שהפעלת מאזיני הדלתא נכשלת, נשמר fallback בטוח למסלול Firestore המלא.',
          'תוקן סימון גרסת beta.html כך שבדיקת BOOT_FILE_VERSIONS אמורה להחזיר allMatch:true.'
        ]
      });
      return rows;
    };
    wrappedRows.__v647Wrapped=true;
    window.requiredChangelogRows=wrappedRows;try{requiredChangelogRows=wrappedRows;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.48 BETA - PRICELIST INDEXEDDB CACHE + DELTA SYNC
-------------------------------------------------------------------------------
1. The worker price list is restored from a dedicated IndexedDB snapshot before
   the original full Firestore query runs.
2. When a valid snapshot exists, the 309-document startup download is skipped.
3. Two Firestore listeners receive only price documents created or updated after
   the local savedAt value and merge them into the local snapshot.
4. The existing full loader remains the safe first-launch/fallback path.
5. Stable 6.33 files are untouched.
===============================================================================
*/
(function installPriceListCacheV648(){
  'use strict';
  if(window.__wmPriceListCacheV648Installed)return;
  window.__wmPriceListCacheV648Installed=true;

  var DB_NAME='work_monitor_beta_static_cache';
  var DB_VERSION=1;
  var STORE='collectionSnapshots';
  var KEY='priceList';
  var dbPromise=null;
  var listenersStarted=false;
  var listenerUnsubs=[];
  var localRows=[];
  var currentSavedAt='';
  var loadPromise=null;
  var originalLoad=window.loadPriceList||(typeof loadPriceList==='function'?loadPriceList:null);

  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function openDb(){
    if(dbPromise)return dbPromise;
    trace('PRICE_LIST_IDB_OPEN_START',{database:DB_NAME,version:DB_VERSION});
    dbPromise=new Promise(function(resolve,reject){
      if(!window.indexedDB){reject(new Error('IndexedDB is unavailable'));return;}
      var req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=function(ev){var dbi=ev.target.result;if(!dbi.objectStoreNames.contains(STORE))dbi.createObjectStore(STORE,{keyPath:'key'});};
      req.onsuccess=function(){trace('PRICE_LIST_IDB_OPEN_SUCCESS',{database:DB_NAME,version:DB_VERSION});resolve(req.result);};
      req.onerror=function(){reject(req.error||new Error('priceList IndexedDB open failed'));};
    });
    return dbPromise;
  }
  async function readRow(){
    var dbi=await openDb();
    return new Promise(function(resolve,reject){var tx=dbi.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(KEY);req.onsuccess=function(){resolve(req.result||null);};req.onerror=function(){reject(req.error);};});
  }
  async function writeRow(rows){
    var dbi=await openDb();
    var row={key:KEY,rows:Array.isArray(rows)?rows:[],savedAt:new Date().toISOString(),appVersion:String(window.APP_VERSION||'6.48-beta'),schemaVersion:1};
    await new Promise(function(resolve,reject){var tx=dbi.transaction(STORE,'readwrite');tx.objectStore(STORE).put(row);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};tx.onabort=function(){reject(tx.error);};});
    currentSavedAt=row.savedAt;
    trace('PRICE_LIST_IDB_SAVE_SUCCESS',{docs:row.rows.length,savedAt:row.savedAt});
    return row;
  }
  function normalize(rows){
    var map={};
    (Array.isArray(rows)?rows:[]).forEach(function(item){
      if(!item||!item.id)return;
      var x=Object.assign({},item,{inputMode:item.inputMode||'qty'});
      map[String(x.id)]=x;
    });
    localRows=Object.keys(map).map(function(id){return map[id];});
    var unique={};
    localRows.filter(function(x){return x.active!==false;}).forEach(function(item){
      var key=String(item.name||'').trim()+'|'+Number(item.price||0)+'|'+String(item.inputMode||'qty');
      if(!unique[key])unique[key]=item;
    });
    priceList=Object.keys(unique).map(function(k){return unique[k];}).sort(function(a,b){return Number(a.order||0)-Number(b.order||0);});
    window.priceList=priceList;
    return priceList;
  }
  function firestoreValueToPlain(doc){return Object.assign({id:doc.id},doc.data()||{});}
  function mergeDocs(snapshot,source){
    var map={};localRows.forEach(function(r){if(r&&r.id)map[String(r.id)]=r;});
    snapshot.docChanges().forEach(function(ch){
      var id=String(ch.doc.id);
      if(ch.type==='removed')delete map[id];else map[id]=firestoreValueToPlain(ch.doc);
    });
    normalize(Object.keys(map).map(function(id){return map[id];}));
    trace('PRICE_LIST_DELTA_APPLIED',{source:source,changes:snapshot.docChanges().length,docs:localRows.length,fromCache:!!snapshot.metadata.fromCache});
    if(snapshot.metadata.fromCache===false){writeRow(localRows).catch(function(err){trace('PRICE_LIST_IDB_SAVE_ERROR',{error:String(err&&err.message||err)});});}
  }
  function startDeltaListeners(savedAt){
    if(listenersStarted||!savedAt||!window.db||!window.firebase||!firebase.firestore)return;
    listenersStarted=true;
    var ts=firebase.firestore.Timestamp.fromDate(new Date(savedAt));
    trace('PRICE_LIST_DELTA_LISTENER_MODE',{savedAt:savedAt,fields:['createdAt','updatedAt']});
    ['createdAt','updatedAt'].forEach(function(field){
      var unsub=db.collection('priceList').where(field,'>',ts).onSnapshot({includeMetadataChanges:true},function(snap){mergeDocs(snap,field);},function(err){
        trace('PRICE_LIST_DELTA_LISTENER_ERROR',{field:field,error:String(err&&err.message||err)});
      });
      listenerUnsubs.push(unsub);
    });
  }
  async function cachedLoadPriceListV648(force){
    if(loadPromise)return loadPromise;
    loadPromise=(async function(){
      if(force===true){
        trace('PRICE_LIST_CACHE_FORCE_FULL_LOAD',{});
        var forced=await originalLoad.apply(this,arguments);normalize(Array.isArray(priceList)?priceList:[]);await writeRow(localRows);startDeltaListeners(currentSavedAt);return forced||priceList;
      }
      try{
        trace('PRICE_LIST_IDB_RESTORE_START',{});
        var row=await readRow();
        if(row&&Array.isArray(row.rows)&&row.rows.length){
          currentSavedAt=String(row.savedAt||'');
          normalize(row.rows);
          trace('PRICE_LIST_IDB_RESTORE_SUCCESS',{docs:row.rows.length,savedAt:currentSavedAt});
          trace('PRICE_LIST_SKIP_FULL_DOWNLOAD',{docs:row.rows.length,savedAt:currentSavedAt});
          startDeltaListeners(currentSavedAt);
          return priceList;
        }
        trace('PRICE_LIST_IDB_CACHE_MISS',{});
      }catch(err){trace('PRICE_LIST_IDB_RESTORE_ERROR',{error:String(err&&err.message||err)});}
      var result=await originalLoad.apply(this,arguments);
      normalize(Array.isArray(priceList)?priceList:[]);
      try{await writeRow(localRows);}catch(err2){trace('PRICE_LIST_IDB_SAVE_ERROR',{error:String(err2&&err2.message||err2)});}
      startDeltaListeners(currentSavedAt);
      trace('PRICE_LIST_FULL_LOAD_SEEDED_CACHE',{docs:localRows.length});
      return result||priceList;
    }).call(this).finally(function(){loadPromise=null;});
    return loadPromise;
  }

  if(typeof originalLoad==='function'){
    window.loadPriceList=cachedLoadPriceListV648;
    try{loadPriceList=cachedLoadPriceListV648;}catch(e){}
  }
  trace('PRICE_LIST_CACHE_MODULE_READY',{version:'6.48-beta'});

  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v648Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.48-beta';}))rows.unshift({
        version:'6.48-beta',title:'מטמון מקומי וסנכרון שינויים למחירון',createdAt:'2026-07-28',items:[
          'המחירון נשמר במסד IndexedDB מקומי נפרד ומוצג ממנו בהפעלות הבאות.',
          'כאשר קיים snapshot תקין, האפליקציה מדלגת על הורדת כל מסמכי priceList בזמן העלייה.',
          'שינויים חדשים במחירון מתקבלים באמצעות מאזיני createdAt ו-updatedAt בלבד ונמזגים למטמון המקומי.',
          'בהפעלה הראשונה או במקרה של מטמון חסר נשמר fallback בטוח לטעינה המלאה הקיימת.',
          'נוספו אירועי Audit ייעודיים לבדיקת שחזור, דילוג על הורדה מלאה, דלתא ושמירה מקומית.'
        ]
      });
      return rows;
    };
    wrapped.__v648Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();
