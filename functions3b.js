/* File version: 6.82-beta - version verification and changelog alignment for active dashboard completion filtering. */
/* File version: 6.50 BETA - workerDaysOff/installTemplates IndexedDB delta sync and synchronized soft delete.
Work Monitor app - JavaScript continuation file.
File version: 6.50 BETA - priceList cache-first synchronization diagnostics and changelog support.
Loaded after functions1.js and functions2.js. New additive functionality belongs here.
APP_VERSION remains defined only in functions1.js.
*/
window.WM_LOADED_FILE_VERSIONS = window.WM_LOADED_FILE_VERSIONS || {};
window.WM_LOADED_FILE_VERSIONS.functions3b = "6.82-beta";


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

  // VERSION 6.72 BETA: this is the single authoritative schema version for work_monitor_beta_cache.
  // Version 2 contains both the original workerSnapshots store and the collections store used by templates.
  var DB_NAME='work_monitor_beta_cache';
  var DB_VERSION=2;
  var STORE='workerSnapshots';
  var SHARED_COLLECTIONS_STORE_V672='collections';
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
        if(!database.objectStoreNames.contains(SHARED_COLLECTIONS_STORE_V672))database.createObjectStore(SHARED_COLLECTIONS_STORE_V672,{keyPath:'key'});
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
  function betaDebugEnabledV651(){
    try{var p=new URLSearchParams(location.search);return window.WM_FIREBASE_AUDIT_DEBUG===true||p.get('firebaseDebug')==='1'||p.get('firestoreDebug')==='1'||p.get('cacheDebug')==='1';}catch(e){return window.WM_FIREBASE_AUDIT_DEBUG===true;}
  }
  function renderStatusV635(){
    if(!document.body)return;
    if(!betaDebugEnabledV651()){var old=document.getElementById('wmBetaPersistentCacheV635');if(old)old.remove();return;}
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
  var EXPECTED='6.82-beta';

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
      setTimeout(function(){location.href='beta.html?fresh='+Date.now();},500);
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
VERSION 6.50 BETA - PRICELIST INDEXEDDB CACHE + DELTA SYNC
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
    var row={key:KEY,rows:Array.isArray(rows)?rows:[],savedAt:new Date().toISOString(),appVersion:String(window.APP_VERSION||'6.51-beta'),schemaVersion:1};
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
  trace('PRICE_LIST_CACHE_MODULE_READY',{version:'6.51-beta'});

  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v648Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.51-beta';}))rows.unshift({
        version:'6.51-beta',title:'מטמון מקומי וסנכרון שינויים למחירון',createdAt:'2026-07-28',items:[
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

/*
===============================================================================
VERSION 6.50 BETA - LOCAL DAY-OFF/TEMPLATE CACHE + SYNCHRONIZED SOFT DELETE
-------------------------------------------------------------------------------
1. workerDaysOff and installTemplates are restored from IndexedDB and only
   createdAt/updatedAt deltas are synchronized after the first successful seed.
2. Physical deletes in synchronized business collections are converted to
   tombstones (isDeleted/deletedAt/updatedAt) so every device receives deletion.
3. Deleted records are removed from memory/UI caches and excluded from searches,
   summaries, templates, vacation days and day locks.
4. Stable 6.33 files remain untouched.
===============================================================================
*/
(function installLocalCollectionsAndSoftDeleteV649(){
  'use strict';
  if(window.__wmLocalCollectionsV649Installed)return;
  window.__wmLocalCollectionsV649Installed=true;

  var DB_NAME='work_monitor_beta_static_cache', DB_VERSION=1, STORE='collectionSnapshots';
  var dbPromise=null, states={};
  function trace(e,d){try{window.wmTraceV617&&window.wmTraceV617(e,d||{});}catch(_e){}}
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(function(resolve,reject){
      var r=indexedDB.open(DB_NAME,DB_VERSION);
      r.onupgradeneeded=function(ev){var x=ev.target.result;if(!x.objectStoreNames.contains(STORE))x.createObjectStore(STORE,{keyPath:'key'});};
      r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(r.error||new Error('IndexedDB open failed'));};
    });return dbPromise;
  }
  async function read(key){var x=await openDb();return new Promise(function(res,rej){var r=x.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=function(){res(r.result||null);};r.onerror=function(){rej(r.error);};});}
  async function write(key,rows){var x=await openDb(),row={key:key,rows:rows,savedAt:new Date().toISOString(),appVersion:'6.51-beta',schemaVersion:2};await new Promise(function(res,rej){var t=x.transaction(STORE,'readwrite');t.objectStore(STORE).put(row);t.oncomplete=res;t.onerror=function(){rej(t.error);};});return row;}
  function visible(rows){return (rows||[]).filter(function(x){return x&&x.isDeleted!==true;});}
  function merge(rows,snap){var m={};(rows||[]).forEach(function(x){if(x&&x.id)m[x.id]=x;});snap.docChanges().forEach(function(c){var d=Object.assign({id:c.doc.id},c.doc.data()||{});if(c.type==='removed'||d.isDeleted===true)delete m[c.doc.id];else m[c.doc.id]=d;});return Object.keys(m).map(function(k){return m[k];});}
  function workerId(){try{return viewedWorker&&viewedWorker.id?String(viewedWorker.id):'';}catch(e){return '';}}
  function applyDayoffUiV650(rows,id){
    rows=visible(rows); id=String(id||workerId());
    try{
      var d=(typeof calendarDate!=='undefined'&&calendarDate)?new Date(calendarDate):new Date();
      var y=d.getFullYear(),m=d.getMonth(),start=y+'-'+String(m+1).padStart(2,'0')+'-01',end=y+'-'+String(m+1).padStart(2,'0')+'-'+String(new Date(y,m+1,0).getDate()).padStart(2,'0');
      window.vacationDaysV437=Array.from(new Set(rows.filter(function(x){var dt=String(x.date||'');return x.isDeleted!==true&&x.active!==false&&(x.type==='vacation'||!x.type)&&dt>=start&&dt<=end;}).map(function(x){return String(x.date||'');}))).sort();
      window.vacationDaysLoadedForV437=id+'_'+y+'-'+String(m+1).padStart(2,'0');
      if(typeof window.wmApplyHistoricalDayLocksV633==='function')window.wmApplyHistoricalDayLocksV633(rows,start,end,id);
      try{if(typeof renderCalendar==='function')renderCalendar();}catch(e){}
      try{if(typeof renderDay==='function')renderDay();}catch(e){}
      try{if(typeof renderStats==='function')renderStats();}catch(e){}
      try{if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(e){}
      trace('DAYOFF_UI_REFRESH',{workerId:id,docs:rows.length,vacations:window.vacationDaysV437.length});
      trace('LOCK_UI_REFRESH',{workerId:id,locked:rows.filter(function(x){return x.locked===true&&x.isDeleted!==true;}).length});
    }catch(e){trace('DAYOFF_UI_REFRESH_ERROR',{error:String(e&&e.message||e)});}
  }

  async function startCollection(cfg){
    var key=typeof cfg.key==='function'?cfg.key():cfg.key;if(!key)return null;
    if(states[key]&&states[key].ready)return states[key];
    var st=states[key]=states[key]||{rows:[],ready:false,listeners:[]};
    var row=null;try{row=await read(key);}catch(e){trace(cfg.prefix+'_IDB_RESTORE_ERROR',{error:String(e&&e.message||e)});}
    if(row&&Array.isArray(row.rows)){
      st.rows=visible(row.rows);st.savedAt=row.savedAt||'';st.ready=true;cfg.apply(st.rows);
      trace(cfg.prefix+'_IDB_RESTORE_SUCCESS',{docs:st.rows.length,savedAt:st.savedAt});
      trace(cfg.prefix+'_SKIP_FULL_DOWNLOAD',{docs:st.rows.length});
    }else{
      trace(cfg.prefix+'_IDB_CACHE_MISS',{});
      var snap=await cfg.fullQuery();st.rows=visible(snap.docs.map(function(d){return Object.assign({id:d.id},d.data()||{});}));
      cfg.apply(st.rows);var saved=await write(key,st.rows);st.savedAt=saved.savedAt;st.ready=true;
      trace(cfg.prefix+'_FULL_LOAD_SEEDED_CACHE',{docs:st.rows.length});
    }
    if(st.savedAt&&!st.listeners.length){
      var ts=firebase.firestore.Timestamp.fromDate(new Date(st.savedAt));
      ['createdAt','updatedAt'].forEach(function(field){
        var q=cfg.deltaQuery(field,ts);var u=q.onSnapshot({includeMetadataChanges:true},function(s){
          var before=st.rows.length;st.rows=merge(st.rows,s);cfg.apply(st.rows);
          trace(cfg.prefix+'_DELTA_APPLIED',{field:field,changes:s.docChanges().length,docs:st.rows.length,removed:Math.max(0,before-st.rows.length),fromCache:!!s.metadata.fromCache});
          if(s.metadata.fromCache===false)write(key,st.rows).then(function(r){st.savedAt=r.savedAt;trace(cfg.prefix+'_IDB_SAVE_SUCCESS',{docs:st.rows.length,savedAt:r.savedAt});});
        },function(e){trace(cfg.prefix+'_DELTA_LISTENER_ERROR',{field:field,error:String(e&&e.message||e)});});st.listeners.push(u);
      });trace(cfg.prefix+'_DELTA_LISTENER_MODE',{savedAt:st.savedAt,fields:['createdAt','updatedAt']});
    }
    return st;
  }

  var originalDayOffGet=window.wmGetAllDayOffDocsV624;
  window.wmGetAllDayOffDocsV624=async function(id,force){
    id=String(id||workerId());var key='workerDaysOff:'+id;
    if(force===true&&states[key]){states[key].ready=false;}
    try{var st=await startCollection({key:function(){return key;},prefix:'DAYSOFF_CACHE',fullQuery:function(){return db.collection('workerDaysOff').where('workerId','==',id).get();},deltaQuery:function(f,t){return db.collection('workerDaysOff').where('workerId','==',id).where(f,'>',t);},apply:function(rows){var c=window.WM_DAYOFF_DOCS_CACHE_V624=window.WM_DAYOFF_DOCS_CACHE_V624||{};c.workerId=id;c.docs=visible(rows);c.promise=null;applyDayoffUiV650(c.docs,id);}});return visible(st.rows);}catch(e){trace('DAYSOFF_CACHE_FALLBACK',{error:String(e&&e.message||e)});return originalDayOffGet?originalDayOffGet(id,force):[];}
  };

  var originalLoadTemplates=window.loadTemplates||(typeof loadTemplates==='function'?loadTemplates:null);
  var templateLoadPromiseV650=null,activeTemplateStateKeyV673='';
  function stopOtherTemplateStatesV673(keepKey){
    Object.keys(states).forEach(function(k){
      if(k.indexOf('installTemplates:')!==0||k===keepKey)return;
      var st=states[k];
      (st&&Array.isArray(st.listeners)?st.listeners:[]).forEach(function(unsub){try{unsub&&unsub();}catch(e){}});
      if(st)st.listeners=[];
    });
  }
  async function loadTemplatesV649(force){
    var id=String(workerId()||''),key=id?'installTemplates:'+id:'';
    if(!id){templates=[];window.templates=[];try{renderTemplateSelect();}catch(e){}return [];}
    if(activeTemplateStateKeyV673!==key){stopOtherTemplateStatesV673(key);activeTemplateStateKeyV673=key;templateLoadPromiseV650=null;}
    if(force===true&&states[key]){(states[key].listeners||[]).forEach(function(u){try{u&&u();}catch(e){}});states[key].listeners=[];states[key].ready=false;}
    if(templateLoadPromiseV650)return templateLoadPromiseV650;
    templateLoadPromiseV650=(async function(){try{
      var requestedWorker=id;
      var st=await startCollection({
        key:key,
        prefix:'TEMPLATES_CACHE',
        fullQuery:function(){return db.collection('installTemplates').where('ownerWorkerId','==',requestedWorker).get();},
        deltaQuery:function(field,timestamp){return db.collection('installTemplates').where('ownerWorkerId','==',requestedWorker).where(field,'>',timestamp);},
        apply:function(rows){
          if(String(workerId()||'')!==requestedWorker){trace('TEMPLATES_CACHE_STALE_WORKER_V673',{requestedWorker:requestedWorker,currentWorker:String(workerId()||'')});return;}
          templates=visible(rows).filter(function(t){return t.active!==false&&!t.isDeleted&&String(t.ownerWorkerId||'')===requestedWorker;}).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'he');});
          window.templates=templates;
          try{renderTemplateSelect();}catch(e){}
          try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
        }
      });
      trace('TEMPLATES_WORKER_SCOPE_V673_READY',{workerId:requestedWorker,key:key,docs:visible(st.rows).length});
      return visible(st.rows);
    }catch(e){trace('TEMPLATES_CACHE_FALLBACK',{workerId:id,error:String(e&&e.message||e)});return originalLoadTemplates?originalLoadTemplates(force):[];}})();
    try{return await templateLoadPromiseV650;}finally{templateLoadPromiseV650=null;}
  }
  window.loadTemplates=loadTemplatesV649;try{loadTemplates=loadTemplatesV649;}catch(e){}

  function purgeDeletedEverywhere(){
    var tombstones={};
    function scan(a){(Array.isArray(a)?a:[]).forEach(function(x){if(x&&x.deletedEntryId)tombstones[String(x.deletedEntryId)]=true;});}
    try{scan(window.workerAllEntriesV511);scan(monthEntries);var st=window.WM_DATA_CACHE_V604;if(st){scan(st.entries);if(st.historicalMonths)Object.keys(st.historicalMonths).forEach(function(k){scan(st.historicalMonths[k]);});}}catch(e){}
    function clean(a){return visible(Array.isArray(a)?a:[]).filter(function(x){return !x||!tombstones[String(x.id||'')];});}
    try{window.workerAllEntriesV511=clean(window.workerAllEntriesV511);}catch(e){}
    try{monthEntries=clean(monthEntries);}catch(e){}try{templates=clean(templates);}catch(e){}try{priceList=clean(priceList);}catch(e){}
    try{var s=window.WM_DATA_CACHE_V604;if(s){s.entries=clean(s.entries);if(s.historicalMonths)Object.keys(s.historicalMonths).forEach(function(k){s.historicalMonths[k]=clean(s.historicalMonths[k]);});}}catch(e){}
    try{var c=window.WM_DAYOFF_DOCS_CACHE_V624;if(c&&Array.isArray(c.docs))c.docs=clean(c.docs);}catch(e){}
  }
  var oldRefresh=window.wmRefreshFromCacheV610;if(typeof oldRefresh==='function'){window.wmRefreshFromCacheV610=function(){purgeDeletedEverywhere();return oldRefresh.apply(this,arguments);};}

  function deleteDebugContextV658(collection,id,entry,data){
    var authUser=null;try{authUser=auth&&auth.currentUser;}catch(e){}
    var sessionObj=null;try{sessionObj=window.session||session||null;}catch(e){}
    var viewed=null;try{viewed=window.viewedWorker||viewedWorker||null;}catch(e){}
    var cache=null;try{cache=window.WM_DATA_CACHE_V604||null;}catch(e){}
    return {
      version:'6.59-beta',collection:collection,id:id,
      authUid:authUser&&authUser.uid||'',authEmail:authUser&&authUser.email||'',
      sessionRole:sessionObj&&sessionObj.role||'',sessionWorkerId:sessionObj&&sessionObj.workerId||'',
      viewedWorkerId:viewed&&viewed.id||'',cacheWorkerId:cache&&cache.workerId||'',
      entryFound:!!entry,entryWorkerId:entry&&entry.workerId||'',entryStatus:entry&&(entry.entryStatus||entry.status)||'',
      entryIsDeleted:entry&&entry.isDeleted===true,entryActive:entry&&entry.active,
      payloadFields:Object.keys(data||{}),online:navigator.onLine!==false
    };
  }
  async function softDelete(collection,id,extra,entry){
    var data=Object.assign({},extra||{},{isDeleted:true,active:false,deletedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    var ctx=deleteDebugContextV658(collection,id,entry,data);
    trace('SOFT_DELETE_V658_START',ctx);
    try{
      await db.collection(collection).doc(id).set(data,{merge:true});
      trace('SOFT_DELETE_V658_FIRESTORE_SUCCESS',Object.assign({},ctx,{result:'set-merge-success'}));
      return true;
    }catch(err){
      trace('SOFT_DELETE_V658_FIRESTORE_ERROR',Object.assign({},ctx,{errorCode:err&&err.code||'',errorMessage:String(err&&err.message||err)}));
      throw err;
    }
  }
  window.wmSoftDeleteV649=softDelete;

  window.wmDeleteEntryV659=async function(id){
    if(!id||!confirm('למחוק את העבודה?'))return;
    var entry=null;try{entry=(window.workerAllEntriesV511||[]).find(function(x){return x&&x.id===id;})||(monthEntries||[]).find(function(x){return x&&x.id===id;});}catch(e){}
    trace('DELETE_ENTRY_V658_REQUEST',deleteDebugContextV658('workEntries',id,entry,{}));
    try{
      await softDelete('workEntries',id,null,entry);
      trace('DELETE_ENTRY_V658_BEFORE_LOCAL_PURGE',deleteDebugContextV658('workEntries',id,entry,{}));
      try{
        window.wmRemoveEntryFromCacheV610&&window.wmRemoveEntryFromCacheV610(id);
        purgeDeletedEverywhere();
        trace('DELETE_ENTRY_V658_LOCAL_PURGE_SUCCESS',{id:id,monthEntriesCount:Array.isArray(monthEntries)?monthEntries.length:null,allEntriesCount:Array.isArray(window.workerAllEntriesV511)?window.workerAllEntriesV511.length:null});
        window.wmRefreshFromCacheV610&&window.wmRefreshFromCacheV610({messageHtml:'<div class="notice">העבודה נמחקה בהצלחה ✅</div>',toast:'העבודה נמחקה וסונכרנה ✅'});
        trace('DELETE_ENTRY_V658_UI_REFRESH_SUCCESS',{id:id});
      }catch(localErr){
        trace('DELETE_ENTRY_V658_LOCAL_PURGE_ERROR',{id:id,errorMessage:String(localErr&&localErr.message||localErr)});
      }
    }catch(err){
      trace('DELETE_ENTRY_V658_ABORTED_NO_HARD_DELETE',Object.assign(deleteDebugContextV658('workEntries',id,entry,{}),{errorCode:err&&err.code||'',errorMessage:String(err&&err.message||err)}));
      try{
        var msg=document.getElementById('entryMsg');
        if(msg)msg.innerHTML='<p class="danger">המחיקה הרכה נחסמה ולא בוצעה. העתק את לוג הבדיקה.</p>';
      }catch(_e){}
      alert('המחיקה הרכה נחסמה ולא בוצעה. לא בוצעה מחיקה פיזית. העתק את לוג הבדיקה ושלח אותו.');
    }
  };
  window.deleteEntry=window.wmDeleteEntryV659;
  try{deleteEntry=window.wmDeleteEntryV659;}catch(e){}
  window.deleteTemplate=async function(id){if(!id||!confirm('למחוק את התבנית?'))return;await softDelete('installTemplates',id);var st=states.installTemplates;if(st){st.rows=st.rows.filter(function(x){return x.id!==id;});await write('installTemplates',st.rows);};await loadTemplatesV649();try{loadTemplatesAdmin&&loadTemplatesAdmin();}catch(e){}};try{deleteTemplate=window.deleteTemplate;}catch(e){}

  // Catch legacy physical-delete buttons/functions for synchronized collections.
  try{
    var proto=firebase.firestore.DocumentReference.prototype,oldDelete=proto.delete;
    if(!proto.__wmSoftDeleteV649){proto.delete=function(){var p=String(this.path||''),col=p.split('/')[0];if(['workEntries','priceList','installTemplates','workerDaysOff'].indexOf(col)>=0)return this.set({isDeleted:true,active:false,deletedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});return oldDelete.apply(this,arguments);};proto.__wmSoftDeleteV649=true;}
  }catch(e){trace('SOFT_DELETE_WRAPPER_ERROR',{error:String(e&&e.message||e)});}

  // All existing search/render paths consume these arrays; sanitize before input/click searches.
  document.addEventListener('click',purgeDeletedEverywhere,true);document.addEventListener('input',purgeDeletedEverywhere,true);
  trace('LOCAL_COLLECTION_CACHE_V649_READY',{version:'6.51-beta'});

  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v649Wrapped){var wrapped=function(){var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){}if(!rows.some(function(r){return String(r.version||r.id||'')==='6.49-beta';}))rows.unshift({version:'6.49-beta',title:'ימי חופש ותבניות מקומיים עם מחיקה מסונכרנת',createdAt:'2026-07-28',items:['workerDaysOff ו-installTemplates נטענים מ-IndexedDB ובהפעלות הבאות מסתנכרנים רק מסמכים חדשים או מעודכנים.','כל מחיקה באוספי העבודה, המחירון, התבניות וימי החופש נכתבת כ-Soft Delete עם isDeleted, deletedAt ו-updatedAt כדי להגיע לכל המכשירים.','רשומות מחוקות מוסרות מהמטמון, מהמסך, מהחיפוש, מהסיכומים, מהתבניות, מימי החופש ומנעילות הימים.','נשמר fallback לטעינה המלאה אם המטמון חסר או נכשל, ונוספו אירועי Audit ייעודיים לכל שלב.']});return rows;};wrapped.__v649Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}}


  var oldRows650=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows650==='function'&&!oldRows650.__v650Wrapped){var wrapped650=function(){var rows=[];try{rows=oldRows650.apply(this,arguments)||[];}catch(e){}if(!rows.some(function(r){return String(r.version||r.id||'')==='6.51-beta';}))rows.unshift({version:'6.51-beta',title:'ייצוב סנכרון מחיקות, ימי חופש ונעילות',createdAt:'2026-07-28',items:['סימון יום חופש משתמש מעכשיו במחיקה רכה מסונכרנת ואינו מבצע batch.delete פיזי.','עבודות מחוקות אינן נספרות בבדיקת יום, ואינן מוצגות בחיפוש לקוח, היסטוריה, חיפוש וסיכומים.','דלתאות workerDaysOff מעדכנות מיד את ימי החופש, הנעילות, לוח השנה והיום הנבחר בכל מכשיר.','נמנעה טעינה כפולה מקבילה של installTemplates ונוספו אירועי Audit ייעודיים.']});return rows;};wrapped650.__v650Wrapped=true;window.requiredChangelogRows=wrapped650;try{requiredChangelogRows=wrapped650;}catch(e){}}
  trace('SYNC_STABILIZATION_V650_READY',{version:'6.51-beta'});
})();


/* ============================================================================
VERSION 6.51 BETA - QUIET BETA MODE + COMPLETE ADMIN CHANGELOG
- Firebase Audit and the local-cache badge are hidden by default.
- Diagnostics appear only with ?firebaseDebug=1 (legacy cacheDebug/firestoreDebug remain supported).
- Completes the in-app/admin changelog for 6.41-beta through 6.51-beta.
============================================================================ */
(function installQuietBetaAndCompleteChangelogV651(){
  'use strict';
  function add(rows,version,title,items){
    if(!rows.some(function(r){return String(r.version||r.id||'')===version;}))rows.unshift({version:version,title:title,createdAt:'2026-07-28',items:items});
  }
  var old=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof old==='function'&&!old.__v651Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      add(rows,'6.41-beta','בדיקת שמירה בטוחה ל-IndexedDB',['הפעלת הבטא נשארה Firestore-first ללא קריאה מהמטמון בזמן העלייה.','לאחר snapshot מאומת של workEntries הנתונים נשמרו ל-IndexedDB ברקע.','נוספו אירועי Audit לפתיחת בסיס הנתונים ולשמירה.']);
      add(rows,'6.42-beta','חיבור ישיר של מאזין העבודות לשמירת IndexedDB',['נוסף hook ישיר ל-onSnapshot של workEntries.','כל snapshot לא-ריק מועבר לשמירת IndexedDB.','נוספו אירועי Audit ייעודיים לחיבור ולשמירה.']);
      add(rows,'6.43-beta','שמירת IndexedDB מתוך המאזין המקורי',['השמירה הועברה ל-callback המקורי של מאזין workEntries.','הוסר נתיב עטיפה שלא התחבר למאזין הפעיל.','נוספו אירועי פתיחה, שמירה, הצלחה ושגיאה.']);
      add(rows,'6.44-beta','בדיקת גרסאות קבצים ואיפוס מטמון באדמין',['כל קובץ בטא מפרסם את גרסתו בזמן ריצה.','נוסף BOOT_FILE_VERSIONS לזיהוי חוסר התאמה בין קבצים.','נוספו לאדמין כלי ניקוי מטמון ואיפוס מקומי מלא.']);
      add(rows,'6.45-beta','שמירת IndexedDB מתוך המאזין הפעיל',['שמירת workEntries חוברה למאזין הפעיל בפועל.','נמנעה שמירה כפולה ונוספו אירועי CACHE_IDB_ACTIVE_LISTENER_SAVE.','אירועי IndexedDB אוחדו בחלון ה-Audit.']);
      add(rows,'6.46-beta','שחזור Local-First מ-IndexedDB',['בפתיחה חוזרת משוחזרת תמונת השנתיים של העובד מ-IndexedDB.','המסך יכול להציג נתונים מקומיים לפני סיום בדיקת Firestore.','נשמר fallback בטוח למסלול Firestore במקרה כשל.']);
      add(rows,'6.47-beta','סנכרון workEntries דיפרנציאלי',['כאשר קיים מטמון תקין מדלגים על הורדת כל workEntries.','נפתחים מאזינים רק למסמכים שנוצרו או עודכנו אחרי זמן השמירה.','נוספו סימוני CACHE_NO_FULL_DOWNLOAD ו-FIRESTORE_LISTENER_DELTA_MODE.']);
      add(rows,'6.48-beta','מטמון דיפרנציאלי לאוספים קבועים',['הוכנה שכבת IndexedDB משותפת לאוספים קבועים.','טעינה חוזרת משתמשת בנתונים המקומיים ומאזיני createdAt/updatedAt מביאים רק שינויים.','נשמר fallback לטעינה מלאה כאשר אין מטמון תקין.']);
      add(rows,'6.49-beta','ימי חופש ותבניות מקומיים עם מחיקה מסונכרנת',['workerDaysOff ו-installTemplates נטענים מ-IndexedDB ובהמשך מקבלים דלתאות בלבד.','מחיקות באוספים המסונכרנים נכתבות כ-Soft Delete.','רשומות מחוקות מוסרות מהמטמון, מהמסך ומהחיפושים.']);
      add(rows,'6.50-beta','ייצוב סנכרון מחיקות, ימי חופש ונעילות',['סימון וביטול יום חופש מסתנכרנים בין מכשירים.','עבודות מחוקות אינן מוצגות או נספרות.','דלתאות workerDaysOff מרעננות מיד ימי חופש, נעילות ולוח שנה.','נמנעה טעינה כפולה של תבניות התקנה.']);
      add(rows,'6.51-beta','מצב בטא שקט והשלמת מה חדש',['חלון Firebase Audit מוסתר כברירת מחדל ומופיע רק עם ?firebaseDebug=1.','מחוון המטמון הקטן בתחתית מוסתר גם הוא ללא פרמטר דיבאג.','הושלמו במסך מה חדש כל הרשומות מ-6.41-beta ועד 6.51-beta עבור האדמין והעובדים.','בדיקות המטמון, הדלתאות והסנכרון נשארו פעילות ברקע ללא שינוי.']);
      return rows;
    };
    wrapped.__v651Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
  try{window.wmTraceV617&&window.wmTraceV617('QUIET_BETA_V651_READY',{debug:(new URLSearchParams(location.search)).get('firebaseDebug')==='1'});}catch(e){}
})();


/* ============================================================================
VERSION 6.53 BETA - SAFE WORKER CONTEXT SWITCH + CACHE/DELTA COMPLETION
- Admin templates render from the existing installTemplates IndexedDB/delta state.
- Monthly settlement documents use a local IndexedDB cache and refresh only the
  single workers/{workerId}/monthlySettlements/{YYYY-MM} document.
- Missing changelog versions are written individually by admin and merged into
  the local changelog cache; no full appChangelog download is introduced here.
- Stable 6.33 remains untouched.
============================================================================ */
(function installCacheDeltaCompletionV652(){
  'use strict';
  var VERSION='6.59-beta';
  function trace(name,data){try{window.wmTraceV617&&window.wmTraceV617(name,Object.assign({version:VERSION},data||{}));}catch(e){}}
  function byId(id){return document.getElementById(id);}
  function escV652(v){try{return typeof window.esc==='function'?window.esc(v):String(v||'');}catch(e){return String(v||'');}}
  function currentWorkerId(){try{return String((window.viewedWorker&&viewedWorker.id)||'');}catch(e){return '';}}
  function currentMonth(){var el=byId('settlementMonthV547');return String((el&&el.value)||'').slice(0,7);}

  /* ---- tiny dedicated IndexedDB store for settlement documents ---- */
  var DB_NAME='workMonitorAuxCacheV652',STORE='settlements',DB_VERSION=1,dbPromise=null;
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(function(resolve,reject){
      try{
        var req=indexedDB.open(DB_NAME,DB_VERSION);
        req.onupgradeneeded=function(){var d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'key'});};
        req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error('IndexedDB open failed'));};
      }catch(e){reject(e);}
    });
    return dbPromise;
  }
  async function cacheGet(key){try{var d=await openDb();return await new Promise(function(resolve,reject){var tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=function(){resolve(r.result||null);};r.onerror=function(){reject(r.error);};});}catch(e){trace('SETTLEMENT_CACHE_READ_ERROR',{error:String(e&&e.message||e)});return null;}}
  async function cachePut(key,data){try{var d=await openDb();await new Promise(function(resolve,reject){var tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:key,data:data||{},savedAt:Date.now()});tx.oncomplete=function(){resolve();};tx.onerror=function(){reject(tx.error);};});trace('SETTLEMENT_CACHE_SAVE',{key:key});}catch(e){trace('SETTLEMENT_CACHE_SAVE_ERROR',{error:String(e&&e.message||e)});}}
  function settlementKey(workerId,month){return 'settlement:'+String(workerId||'')+':'+String(month||'');}
  function stampValue(v){if(!v)return 0;try{if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;return new Date(v).getTime()||0;}catch(e){return 0;}}
  function applySettlementToVisibleForm(data,month){
    try{
      if(currentMonth()!==String(month||''))return;
      data=data||{};
      if(typeof setSettlementIncomeBreakdownV549==='function')setSettlementIncomeBreakdownV549(data);
      var equipment=byId('settlementEquipmentV547'),fine=byId('settlementFineV547'),notes=byId('settlementNotesV547');
      if(equipment)equipment.value=data.equipmentDeduction||'';
      if(fine)fine.value=(data.fineDeduction!==undefined?data.fineDeduction:(data.fineAmount||''))||'';
      if(notes)notes.value=data.notes||'';
      if(typeof setSettlementDeductionsV547==='function')setSettlementDeductionsV547(data.deductions||[]);
      if(typeof renderSettlementReportV547==='function')renderSettlementReportV547();
      var msg=byId('settlementMsgV547');if(msg)msg.innerHTML="<div class='notice'>הדוח עודכן וסונכרן מהמכשיר השני ✅</div>";
    }catch(e){trace('SETTLEMENT_REMOTE_APPLY_ERROR',{error:String(e&&e.message||e)});}
  }

  var originalReadSettlement=window.readSavedSettlementV548||(typeof readSavedSettlementV548==='function'?readSavedSettlementV548:null);
  async function readSavedSettlementCachedV652(month){
    var workerId=currentWorkerId(),m=String(month||'').slice(0,7),key=settlementKey(workerId,m);
    if(!workerId||!m)return {exists:false,data:{},readError:null};
    var cached=await cacheGet(key);
    var cachedResult=cached?{exists:true,data:cached.data||{},readError:null,fromLocalCache:true}:{exists:false,data:{},readError:null};
    var refresh=(async function(){
      try{
        var ref=db.collection('workers').doc(workerId).collection('monthlySettlements').doc(m);
        var doc=await ref.get();
        if(!doc.exists)return {exists:false,data:{},readError:null};
        var remote=doc.data()||{},oldStamp=stampValue(cached&&cached.data&&cached.data.updatedAt),newStamp=stampValue(remote.updatedAt);
        await cachePut(key,remote);
        if(cached&&JSON.stringify(remote)!==JSON.stringify(cached.data||{})&&(newStamp>=oldStamp||!oldStamp))applySettlementToVisibleForm(remote,m);
        trace('SETTLEMENT_SINGLE_DOC_SYNC',{workerId:workerId,month:m,changed:!cached||JSON.stringify(remote)!==JSON.stringify(cached.data||{})});
        return {exists:true,data:remote,readError:null};
      }catch(e){trace('SETTLEMENT_SINGLE_DOC_SYNC_ERROR',{workerId:workerId,month:m,error:String(e&&e.message||e)});return {exists:!!cached,data:(cached&&cached.data)||{},readError:e};}
    })();
    if(cached){refresh.catch(function(){});trace('SETTLEMENT_CACHE_HIT',{workerId:workerId,month:m});return cachedResult;}
    trace('SETTLEMENT_CACHE_MISS',{workerId:workerId,month:m});return refresh;
  }
  window.readSavedSettlementV548=readSavedSettlementCachedV652;try{readSavedSettlementV548=readSavedSettlementCachedV652;}catch(e){}

  var originalSaveSettlement=window.saveMonthlySettlementV547||(typeof saveMonthlySettlementV547==='function'?saveMonthlySettlementV547:null);
  if(typeof originalSaveSettlement==='function'){
    var saveWrapped=async function(){
      var result=await originalSaveSettlement.apply(this,arguments),workerId=currentWorkerId(),m=currentMonth();
      if(workerId&&m){
        try{var doc=await db.collection('workers').doc(workerId).collection('monthlySettlements').doc(m).get();if(doc.exists)await cachePut(settlementKey(workerId,m),doc.data()||{});}catch(e){trace('SETTLEMENT_POST_SAVE_CACHE_ERROR',{error:String(e&&e.message||e)});}
      }
      return result;
    };
    window.saveMonthlySettlementV547=saveWrapped;try{saveMonthlySettlementV547=saveWrapped;}catch(e){}
  }

  /* ---- Admin templates: render from the already-active cache/delta loader ---- */
  function renderAdminTemplatesV652(){
    var rows=[];try{rows=(window.templates||templates||[]).filter(function(t){return t&&t.active!==false&&!t.isDeleted;});}catch(e){}
    ['templatesAdmin','templatesAdminTop'].forEach(function(id){
      var box=byId(id);if(!box)return;box.innerHTML=rows.length?'':"<p class='muted'>אין תבניות עדיין.</p>";
      rows.forEach(function(t){var div=document.createElement('div');div.className='item';div.innerHTML='<div><div class="item-title">⚡ '+escV652(t.name||'')+'</div><div class="item-sub">'+(t.items||[]).map(function(i){return escV652(i.name||'')+' × '+Number(i.quantity||0);}).join('<br>')+'</div></div><div class="actions"><button class="btn-red" onclick="deleteTemplate(\''+String(t.id||'').replace(/'/g,"\\'")+'\')">מחק</button></div>';box.appendChild(div);});
    });
    trace('ADMIN_TEMPLATES_RENDER_FROM_CACHE',{count:rows.length});
  }
  window.loadTemplatesAdmin=async function(){
    try{if(typeof window.loadTemplates==='function')await window.loadTemplates();else if(typeof loadTemplates==='function')await loadTemplates();}catch(e){trace('ADMIN_TEMPLATES_CACHE_LOAD_ERROR',{error:String(e&&e.message||e)});}
    renderAdminTemplatesV652();return (window.templates||[]);
  };
  try{loadTemplatesAdmin=window.loadTemplatesAdmin;}catch(e){}

  /* ---- Changelog: seed only missing documents and merge them into local cache ---- */
  function isAdmin(){try{return !!(window.session&&session.role==='admin');}catch(e){return false;}}
  function changelogId(v){return 'v_'+String(v||'').replace(/^v/i,'').replace(/[^0-9A-Za-z_\-.]/g,'_').replaceAll('.','_');}
  function readLocalRows(){try{var x=JSON.parse(localStorage.getItem('wm_changelog_cache_v627')||'[]');return Array.isArray(x)?x:[];}catch(e){return [];}}
  function writeLocalRows(rows){try{localStorage.setItem('wm_changelog_cache_v627',JSON.stringify(rows||[]));}catch(e){}}
  async function ensureMissingChangelogV652(){
    if(!isAdmin())return;
    var required=[];try{required=(window.requiredChangelogRows||requiredChangelogRows)()||[];}catch(e){}
    var local=readLocalRows(),map={};local.forEach(function(r){map[String(r.version||'')]=true;});
    var missing=required.filter(function(r){return r&&r.version&&!map[String(r.version)];});
    if(!missing.length){trace('CHANGELOG_DELTA_NO_MISSING',{localCount:local.length});return;}
    var batch=db.batch();
    missing.forEach(function(r,i){batch.set(db.collection('appChangelog').doc(changelogId(r.version)),{version:r.version,title:r.title||'',date:r.date||r.createdAt||'',items:r.items||[],active:r.active!==false,order:Number(r.order||((i+1)*10)),source:'admin-missing-delta-v6.53',seedVersion:VERSION,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:false});});
    await batch.commit();
    var merged=missing.concat(local).filter(function(r,index,arr){return arr.findIndex(function(x){return String(x.version||'')===String(r.version||'');})===index;});writeLocalRows(merged);
    try{await db.doc('settings/changelogStatus').set({latestVersion:VERSION,revision:firebase.firestore.FieldValue.increment(1),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}catch(e){}
    trace('CHANGELOG_MISSING_DELTA_SEEDED',{count:missing.length,versions:missing.map(function(r){return r.version;})});
  }
  window.ensureMissingChangelogV652=ensureMissingChangelogV652;
  var oldShowAdmin=window.showAdmin;
  if(typeof oldShowAdmin==='function'&&!oldShowAdmin.__v652Wrapped){var showAdminV652=async function(){var r=await oldShowAdmin.apply(this,arguments);try{await ensureMissingChangelogV652();}catch(e){trace('CHANGELOG_MISSING_DELTA_ERROR',{error:String(e&&e.message||e)});}try{await window.loadTemplatesAdmin();}catch(e){}return r;};showAdminV652.__v652Wrapped=true;window.showAdmin=showAdminV652;try{showAdmin=showAdminV652;}catch(e){}}

  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v652Wrapped){var wrapped=function(){var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){}if(!rows.some(function(r){return String(r.version||r.id||'')===VERSION;}))rows.unshift({version:VERSION,title:'מעבר בטוח בין עובדים וסנכרון Cache/Delta',createdAt:'2026-07-29',items:['במעבר בין משתמשים נעצרים מיד מאזיני העובד הקודם ונמחקים מהזיכרון לוח השנה, הסכומים והעבודות שלו לפני טעינת העובד החדש.','IndexedDB נשאר מופרד לפי workerId, ולכן כל עובד נטען מהמטמון האישי שלו וממשיך לקבל דלתאות בלבד.','מסך התבניות באדמין מציג את נתוני installTemplates מתוך IndexedDB ומקבל בהמשך רק דלתאות createdAt/updatedAt.','דוח ההתחשבנות נשמר במטמון IndexedDB מקומי ומסתנכרן בין מכשירים באמצעות קריאה ממוקדת למסמך החודשי היחיד בלבד.','גרסאות חסרות במה חדש נכתבות כמסמכים חסרים בלבד ומתמזגות למטמון המקומי.','היציבה 6.33 נשארה ללא שינוי.']});return rows;};wrapped.__v652Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){} }
  trace('CACHE_DELTA_COMPLETION_V652_READY');
})();


/* VERSION 6.54 BETA - PRE-EXECUTION MIXED-FILE GUARD
   The HTML verifies all three JavaScript source files before executing any app code.
   If one file is missing or has another version, the app remains blocked behind maintenance mode. */
(function addRequiredChangelogV654(){
  function install(){
    var old=window.requiredChangelogRows;
    if(typeof old!=='function'||old.__v654Wrapped)return;
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.58-beta';})) rows.unshift({
        version:'6.58-beta', title:'חסימת טעינה אמיתית כשקובצי הבטא אינם באותה גרסה', createdAt:'2026-07-29', items:[
          'כל שלושת קובצי JavaScript נבדקים לפני שקוד האפליקציה מתחיל לרוץ.',
          'כאשר HTML או אחד מקובצי JavaScript שייכים לגרסה אחרת, המערכת נשארת חסומה ומציגה הודעת תחזוקה.',
          'כפתור הרענון מנקה Cache Storage ו-Service Workers ומבקש מחדש את קובצי הגרסה העדכנית.'
        ]
      });
      return rows;
    };
    wrapped.__v654Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
  install();setTimeout(install,0);
})();


/* =====================================================================
VERSION 6.56 BETA - STRICT WORKER LOGIN CACHE ISOLATION
-----------------------------------------------------------------------
1. The old v4.28 worker loader captured an obsolete loadMonth function.
2. On logout/login it could therefore skip the current Cache/Delta route and
   leave the previous worker's workEntries visible in memory.
3. This final override resolves window.loadMonth dynamically on every login,
   resets the previous in-memory worker context first, and exposes workerView
   only after WM_DATA_CACHE_V604.workerId matches the newly logged-in worker.
4. IndexedDB remains separated by workerId and is not deleted.
===================================================================== */
(function installWorkerLoginIsolationV656(){
  'use strict';
  if(window.__wmWorkerLoginIsolationV656Installed)return;
  window.__wmWorkerLoginIsolationV656Installed=true;

  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function stale(token){try{return typeof isStaleNavV180==='function'&&isStaleNavV180(token);}catch(e){return false;}}
  function currentToken(){try{return typeof nextNavTokenV180==='function'?nextNavTokenV180():Date.now();}catch(e){return Date.now();}}
  function loading(message){
    try{
      document.body.classList.add('worker-main-loading-v428');
      if(typeof hideAll==='function')hideAll();
      if(typeof show==='function')show('startupView');
      if(typeof show==='function')show('logoutBtn');
      if(typeof text==='function')text('userLine','טוען נתונים');
      var title=document.querySelector('#startupView .big-title');if(title)title.textContent='טוען נתונים';
      var sub=document.querySelector('#startupView .startup-sub');if(sub)sub.textContent=message||'מכין את סביבת העבודה שלך...';
    }catch(e){}
  }
  function clearVisibleWorkerData(){
    try{monthEntries=[];}catch(e){}
    try{window.workerAllEntriesV511=[];}catch(e){}
    try{window.searchBaseEntriesV507=null;}catch(e){}
    try{selectedDate=null;selectedType=null;}catch(e){}
    try{
      ['monthTotal','dayTotal','goalTotal','leftTotal'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='—';});
      var day=document.getElementById('dayEntries');if(day)day.innerHTML='';
      var cal=document.getElementById('calendar');if(cal)cal.innerHTML='';
    }catch(e){}
  }
  function reveal(worker){
    document.body.classList.remove('worker-main-loading-v428','worker-loading-active-v427');
    try{if(typeof hideWorkerLoading427==='function')hideWorkerLoading427();}catch(e){}
    if(typeof hideAll==='function')hideAll();
    if(typeof show==='function')show('workerView');
    if(typeof show==='function')show('logoutBtn');
    if(typeof text==='function')text('userLine',(worker.name||'עובד')+' · '+((window.session&&session.role==='admin')?'צפייה כמנהל':'עובד'));
    try{if(typeof cleanVisibleSlashN==='function')cleanVisibleSlashN();}catch(e){}
  }

  window.showWorker=async function(worker,token){
    token=token||currentToken();
    window.__isLoggingOutV180=false;
    if(!worker||!worker.id)return;
    var workerId=String(worker.id);
    var previousId='';try{previousId=viewedWorker&&viewedWorker.id?String(viewedWorker.id):'';}catch(e){}

    loading('מחליף משתמש וטוען את הנתונים המתאימים...');
    try{
      // Always reset the previous runtime state before assigning the new worker.
      try{if(typeof prepareWorkerContextSwitchV653==='function')prepareWorkerContextSwitchV653(workerId);}catch(e){}
      clearVisibleWorkerData();
      if(stale(token))return;

      if(typeof assertWorkerCanViewV177==='function'){
        var gate=await assertWorkerCanViewV177(worker);
        if(stale(token)||!gate||!gate.ok)return;
        worker=gate.worker;workerId=String(worker.id);
      }

      viewedWorker=worker;window.viewedWorker=worker;
      calendarDate=typeof initialCalendarDateV594==='function'?initialCalendarDateV594():new Date();
      selectedDate=(typeof formatDate==='function'?formatDate(calendarDate):null);selectedType=null;monthEntries=[];window.workerAllEntriesV511=[];
      try{if($('helloTitle'))text('helloTitle','שלום '+(worker.name||''));}catch(e){}
      try{if($('selfGoalMonth'))$('selfGoalMonth').value=currentCalendarMonthKeyV556();}catch(e){}
      try{if($('selfMonthlyGoal'))$('selfMonthlyGoal').value=getWorkerGoalForMonthV556();}catch(e){}
      try{if($('selfNewPassword'))$('selfNewPassword').value='';}catch(e){}
      try{await loadSettings();}catch(e){console.warn('v6.56 loadSettings skipped',e);}
      if(stale(token))return;

      loading('טוען מטמון אישי ושינויים חדשים...');
      var liveLoader=window.loadMonth;
      if(typeof liveLoader!=='function')throw new Error('מנגנון טעינת הנתונים העדכני אינו זמין');
      await liveLoader.call(window,token);
      if(stale(token))return;

      var cache=window.WM_DATA_CACHE_V604||{};
      if(String(cache.workerId||'')!==workerId){
        trace('WORKER_CACHE_ID_MISMATCH_V656',{previousWorkerId:previousId,requestedWorkerId:workerId,cacheWorkerId:String(cache.workerId||'')});
        // One controlled retry through the current loader; never reveal stale rows.
        clearVisibleWorkerData();
        await liveLoader.call(window,token);
        if(stale(token))return;
        cache=window.WM_DATA_CACHE_V604||{};
      }
      if(String(cache.workerId||'')!==workerId){
        clearVisibleWorkerData();
        throw new Error('הנתונים של המשתמש החדש עדיין לא נטענו. יש לנסות להיכנס שוב.');
      }

      // Filter defensively even if a malformed cache ever contains mixed rows.
      if(Array.isArray(cache.entries))cache.entries=cache.entries.filter(function(row){return !row||!row.workerId||String(row.workerId)===workerId;});
      window.workerAllEntriesV511=Array.isArray(cache.entries)?cache.entries.slice():[];
      try{if(typeof window.wmRefreshFromCacheV610==='function')window.wmRefreshFromCacheV610({reason:'worker-login-isolation-v6.56'});}
      catch(e){try{renderCalendar();renderDay();renderStats();if(typeof renderSmartDashboard==='function')renderSmartDashboard();}catch(_e){}}

      trace('WORKER_LOGIN_CACHE_READY_V656',{previousWorkerId:previousId,workerId:workerId,cacheWorkerId:String(cache.workerId||''),docs:Array.isArray(cache.entries)?cache.entries.length:0});
      reveal(worker);
    }catch(error){
      clearVisibleWorkerData();
      document.body.classList.remove('worker-main-loading-v428','worker-loading-active-v427');
      try{if(typeof hideWorkerLoading427==='function')hideWorkerLoading427();}catch(e){}
      trace('WORKER_LOGIN_CACHE_ERROR_V656',{workerId:workerId,error:String(error&&error.message||error)});
      console.error('showWorker v6.56 failed',error);
      try{if(typeof hideAll==='function')hideAll();if(typeof show==='function')show('workerLoginView');if(typeof hide==='function')hide('logoutBtn');if(typeof text==='function')text('userLine','לא מחובר');}catch(e){}
      try{alert('שגיאה בטעינת נתוני העובד: '+String(error&&error.message||error));}catch(e){}
    }
  };
  try{showWorker=window.showWorker;}catch(e){}

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v656Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.58-beta';}))rows.unshift({
        version:'6.58-beta',title:'תיקון פתיחה שקטה, בחירת היום ומחיקת מתוזמנות',createdAt:'2026-07-29',items:[
          'תהליך הכניסה משתמש תמיד ב-loadMonth העדכני ולא בהפניה ישנה שנשמרה בזמן טעינת הקבצים.',
          'לפני טעינת עובד חדש נמחקים מהזיכרון בלבד העבודות, הסכומים, לוח השנה ותוצאות החיפוש של העובד הקודם.',
          'מסך העובד נחשף רק לאחר שמזהה המטמון הפעיל תואם ל-workerId של המשתמש המחובר.',
          'נוספה בדיקת הגנה שמסננת כל רשומה שאינה שייכת לעובד הפעיל, בלי למחוק את מטמוני IndexedDB של עובדים אחרים.',
          'הסנכרון נשאר Cache/Delta ואינו חוזר להורדה מלאה בכל כניסה.'
        ]
      });
      return rows;
    };
    wrapped.__v656Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/* v6.59-beta: route every legacy delete button through the diagnosed synchronized soft-delete handler. */
(function(){
  var previous=window.requiredChangelogRows;
  if(typeof previous==='function'&&!previous.__v659DeleteRoute){
    var wrapped=function(){
      var rows=previous.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.59-beta';})) rows.unshift({
        version:'6.59-beta',title:'איחוד מסלול המחיקה הרכה',createdAt:'2026-07-29',items:[
          'כל כפתורי המחיקה הישנים מנותבים לפונקציית המחיקה הרכה המאובחנת.',
          'בוטלה האפשרות שהפונקציה הישנה תבצע delete פיזי ישירות על workEntries.',
          'נוספו אירועי Audit שמציגים בעלות הרשומה, המשתמש המחובר ותוצאת הרשאות Firestore.'
        ]
      });
      return rows;
    };
    wrapped.__v659DeleteRoute=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.60 BETA - CACHE RESET RECOVERY AND GUARANTEED WORKER LOGIN
-------------------------------------------------------------------------------
1. Worker login is bound with a real DOM listener and no longer depends on an
   inline onclick global lookup that may silently fail after a cache reset.
2. Every login stage is written to Firebase Audit, including missing runtime
   dependencies and synchronous errors before the first Firebase operation.
3. Cache cleanup has bounded timeouts for database enumeration/deletion and
   continues safely when Chrome reports a blocked IndexedDB connection.
4. The interface is locked during cleanup so logout or a second cleanup cannot
   race against Firestore termination and IndexedDB deletion.
5. Data-cache cleanup preserves Firebase Auth; full local reset signs out.
===============================================================================
*/
(function installCacheResetAndLoginRecoveryV660(){
  'use strict';
  if(window.__wmCacheResetAndLoginRecoveryV660)return;
  window.__wmCacheResetAndLoginRecoveryV660=true;

  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function errText(e){return String(e&&((e.code?e.code+': ':'')+(e.message||''))||e||'unknown error');}
  function timeout(promise,ms,label,fallback){
    return Promise.race([
      Promise.resolve(promise),
      new Promise(function(resolve){setTimeout(function(){trace('ADMIN_CACHE_TIMEOUT_V660',{stage:label,timeoutMs:ms});resolve(fallback);},ms);})
    ]);
  }
  function setBusy(busy,message){
    window.__wmAdminCacheBusyV660=!!busy;
    document.documentElement.classList.toggle('wm-cache-reset-busy-v660',!!busy);
    var ids=['clearAdminDataCacheBtnV660','fullAdminLocalResetBtnV660','logoutBtn'];
    ids.forEach(function(id){var el=document.getElementById(id);if(el)el.disabled=!!busy;});
    var msg=document.getElementById('adminLocalCacheMsgV644');
    if(msg&&message)msg.textContent=message;
    var overlay=document.getElementById('wmCacheResetOverlayV660');
    if(busy&&!overlay){
      overlay=document.createElement('div');overlay.id='wmCacheResetOverlayV660';
      overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:24px;direction:rtl;font-family:Arial,sans-serif';
      overlay.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;max-width:420px;width:100%;text-align:center;box-shadow:0 16px 45px rgba(0,0,0,.35)"><div style="font-size:34px;margin-bottom:10px">🧹</div><strong style="font-size:19px">'+String(message||'מנקה מטמון מקומי...')+'</strong><p style="color:#64748b;margin:10px 0 0">אין לסגור את החלון או ללחוץ על כפתורים עד לטעינה מחדש.</p></div>';
      document.body.appendChild(overlay);
    }else if(!busy&&overlay){overlay.remove();}
  }
  async function closeKnownDatabases(){
    var closers=[];
    try{if(window.WM_BETA_LOCAL_CACHE_V635&&typeof window.WM_BETA_LOCAL_CACHE_V635.closeDatabase==='function')closers.push(window.WM_BETA_LOCAL_CACHE_V635.closeDatabase());}catch(e){trace('ADMIN_CACHE_INDEXEDDB_CLOSE_ERROR_V660',{error:errText(e)});}
    try{if(window.WM_LOCAL_COLLECTION_CACHE_V648&&typeof window.WM_LOCAL_COLLECTION_CACHE_V648.closeDatabase==='function')closers.push(window.WM_LOCAL_COLLECTION_CACHE_V648.closeDatabase());}catch(e){trace('ADMIN_CACHE_INDEXEDDB_CLOSE_ERROR_V660',{error:errText(e)});}
    await timeout(Promise.allSettled(closers),2500,'close-known-databases',[]);
  }
  async function databaseNames(){
    var rows=[];
    try{
      if(indexedDB&&typeof indexedDB.databases==='function')rows=await timeout(indexedDB.databases(),2500,'indexeddb-databases',[]);
    }catch(e){trace('ADMIN_CACHE_INDEXEDDB_ENUM_ERROR_V660',{error:errText(e)});}
    var names=(Array.isArray(rows)?rows:[]).map(function(x){return x&&x.name;}).filter(Boolean);
    ['work_monitor_beta_cache','work-monitor-beta-cache-v635','firebaseLocalStorageDb'].forEach(function(n){if(names.indexOf(n)<0)names.push(n);});
    return names.filter(function(n){return /work.?monitor|firestore|firebase/i.test(String(n||''));});
  }
  function deleteDb(name){
    return new Promise(function(resolve){
      var done=false;
      function finish(result){if(done)return;done=true;resolve(result);}
      try{
        var req=indexedDB.deleteDatabase(name);
        req.onsuccess=function(){finish({name:name,deleted:true});};
        req.onerror=function(){finish({name:name,deleted:false,error:errText(req.error)});};
        req.onblocked=function(){trace('ADMIN_CACHE_INDEXEDDB_BLOCKED_V660',{name:name});};
        setTimeout(function(){finish({name:name,deleted:false,timeout:true});},3500);
      }catch(e){finish({name:name,deleted:false,error:errText(e)});}
    });
  }
  async function clearIndexedDb(){
    trace('ADMIN_CACHE_INDEXEDDB_START_V660',{});
    await closeKnownDatabases();
    var names=await databaseNames(),results=[];
    for(var i=0;i<names.length;i++)results.push(await deleteDb(names[i]));
    trace('ADMIN_CACHE_INDEXEDDB_DONE_V660',{targets:names,results:results});
    return results;
  }
  async function clearCacheStorage(){
    var deleted=[];trace('ADMIN_CACHE_STORAGE_START_V660',{});
    try{var keys=window.caches?await timeout(caches.keys(),2500,'cache-storage-keys',[]):[];for(var i=0;i<keys.length;i++)if(await timeout(caches.delete(keys[i]),2000,'cache-delete-'+keys[i],false))deleted.push(keys[i]);}
    catch(e){trace('ADMIN_CACHE_STORAGE_ERROR_V660',{error:errText(e)});}
    trace('ADMIN_CACHE_STORAGE_DONE_V660',{deleted:deleted});return deleted;
  }
  async function stopFirestore(){
    trace('ADMIN_CACHE_FIRESTORE_STOP_START_V660',{});
    try{if(window.db&&typeof db.disableNetwork==='function')await timeout(db.disableNetwork(),2500,'firestore-disable-network',null);}catch(e){trace('ADMIN_CACHE_FIRESTORE_DISABLE_ERROR_V660',{error:errText(e)});}
    try{if(window.db&&typeof db.terminate==='function')await timeout(db.terminate(),3500,'firestore-terminate',null);}catch(e){trace('ADMIN_CACHE_FIRESTORE_STOP_ERROR_V660',{error:errText(e)});}
    trace('ADMIN_CACHE_FIRESTORE_STOP_DONE_V660',{});
  }
  function reloadFresh(mode){
    var u=new URL(location.href);u.searchParams.set('cacheReset',String(Date.now()));u.searchParams.set('resetMode',mode);location.replace(u.toString());
  }
  async function runReset(mode){
    if(window.__wmAdminCacheBusyV660)return;
    var full=mode==='full-local-reset';
    var question=full?'האיפוס ימחק את כל המטמון המקומי, localStorage ו-sessionStorage וינתק מהחשבון. הנתונים ב-Firebase לא יימחקו. להמשיך?':'הפעולה תמחק רק מטמוני נתונים מקומיים ותשמור את ההתחברות. הנתונים ב-Firebase לא יימחקו. להמשיך?';
    if(!window.confirm(question))return;
    setBusy(true,full?'מבצע איפוס מקומי מלא...':'מנקה מטמון נתונים...');
    trace('ADMIN_CACHE_CLEAR_START_V660',{mode:mode});
    try{
      if(full){try{if(window.auth&&typeof auth.signOut==='function')await timeout(auth.signOut(),3000,'auth-signout',null);}catch(e){trace('ADMIN_CACHE_AUTH_SIGNOUT_ERROR_V660',{error:errText(e)});}}
      await stopFirestore();
      await clearIndexedDb();
      await clearCacheStorage();
      if(full){try{localStorage.clear();}catch(e){}try{sessionStorage.clear();}catch(e){}}
      trace('ADMIN_CACHE_CLEAR_DONE_V660',{mode:mode});
      reloadFresh(mode);
    }catch(e){
      trace('ADMIN_CACHE_CLEAR_ERROR_V660',{mode:mode,error:errText(e)});
      setBusy(false,'ניקוי המטמון נכשל: '+errText(e));
    }
  }
  window.clearAdminDataCacheV660=function(){return runReset('data-cache');};
  window.fullAdminLocalResetV660=function(){return runReset('full-local-reset');};

  function bindWorkerLogin(){
    var btn=document.getElementById('workerLoginBtnV660')||document.querySelector('#workerLoginView button.btn-green');
    if(!btn){trace('WORKER_LOGIN_BIND_MISSING_V660',{});return;}
    if(btn.__wmBoundV660)return;
    btn.__wmBoundV660=true;btn.removeAttribute('onclick');
    btn.addEventListener('click',async function(ev){
      ev.preventDefault();ev.stopPropagation();
      var username=(document.getElementById('workerUsername')||{}).value||'';
      trace('WORKER_LOGIN_CLICK_V660',{usernamePresent:!!String(username).trim(),passwordPresent:!!((document.getElementById('workerPassword')||{}).value)});
      var fn=window.workerLogin;
      if(typeof fn!=='function'){
        trace('WORKER_LOGIN_FUNCTION_MISSING_V660',{type:typeof fn});
        var msg=document.getElementById('workerLoginMsg');if(msg)msg.textContent='מנגנון הכניסה לא נטען. יש לרענן את הדף.';return;
      }
      btn.disabled=true;
      try{
        trace('WORKER_LOGIN_FUNCTION_START_V660',{authAvailable:!!window.auth,dbAvailable:!!window.db,firebaseAvailable:!!window.firebase});
        await fn.call(window);
        trace('WORKER_LOGIN_FUNCTION_DONE_V660',{role:window.session&&window.session.role||'',workerId:window.session&&window.session.workerId||''});
      }catch(e){
        trace('WORKER_LOGIN_FUNCTION_ERROR_V660',{error:errText(e),stack:String(e&&e.stack||'').slice(0,1000)});
        var msg2=document.getElementById('workerLoginMsg');if(msg2)msg2.textContent='שגיאה בכניסה: '+errText(e);
      }finally{btn.disabled=false;}
    },true);
    ['workerUsername','workerPassword'].forEach(function(id){var el=document.getElementById(id);if(el&&!el.__wmEnterV660){el.__wmEnterV660=true;el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();btn.click();}});}});
    trace('WORKER_LOGIN_BOUND_V660',{buttonId:btn.id||''});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bindWorkerLogin,0);});else setTimeout(bindWorkerLogin,0);
  window.addEventListener('pageshow',function(){setTimeout(bindWorkerLogin,0);});

  var previous=window.requiredChangelogRows;
  if(typeof previous==='function'&&!previous.__v660CacheLogin){
    var wrapped=function(){
      var rows=previous.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.60-beta';}))rows.unshift({
        version:'6.60-beta',title:'תיקון כניסה אחרי ניקוי מטמון',createdAt:'2026-07-30',items:[
          'כפתור כניסת העובד מחובר כעת באמצעות מאזין DOM יציב ואינו תלוי ב-onclick הישן.',
          'נוספו אירועי Audit לכל שלב בלחיצה ובפונקציית הכניסה, עוד לפני הקריאה הראשונה ל-Firebase.',
          'ניקוי IndexedDB קיבל זמני קצוב, טיפול בחסימה וסגירת חיבורים ידועים כדי שלא ייתקע באמצע.',
          'הממשק ננעל בזמן ניקוי כדי למנוע התנתקות או לחיצה כפולה בזמן ש-Firestore נסגר.',
          'ניקוי מטמון נתונים שומר את Auth; איפוס מקומי מלא מנתק ומוחק גם localStorage ו-sessionStorage.'
        ]
      });return rows;
    };
    wrapped.__v660CacheLogin=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.61 BETA - SAFE CACHE RECOVERY + PER-WORKER TEMPLATE MANAGEMENT
-------------------------------------------------------------------------------
1. Replaces the dangerous v6.60 reset buttons with a safe cleanup flow that
   never terminates Firestore and never deletes Firebase/Auth IndexedDB.
2. Adds a startup health watchdog. If Firebase boot remains stuck, a recovery
   panel appears with retry, diagnostic-log copy and Chrome site-data guidance.
3. Adds a worker settings manager for that worker's own installation templates:
   rename, duplicate, delete one and delete all with explicit confirmations.
4. All template actions keep ownerWorkerId and refresh the existing cached list.
===============================================================================
*/
(function installSafeRecoveryAndWorkerTemplatesV661(){
  'use strict';
  if(window.__wmSafeRecoveryTemplatesV661)return;
  window.__wmSafeRecoveryTemplatesV661=true;

  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function errText(e){return String(e&&((e.code?e.code+': ':'')+(e.message||''))||e||'unknown error');}
  function currentWorkerId(){
    try{return String((window.viewedWorker&&viewedWorker.id)||(window.session&&session.workerId)||(window.session&&session.worker&&session.worker.id)||'');}catch(e){return '';}
  }
  function myTemplates(){
    var id=currentWorkerId(), rows=[];
    try{rows=(window.templates||templates||[]).filter(function(t){return t&&t.active!==false&&!t.isDeleted&&String(t.ownerWorkerId||'')===id;});}catch(e){}
    return rows.sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'he');});
  }
  function msg(text,bad){var el=document.getElementById('workerTemplateManagerMsgV661');if(el)el.innerHTML='<div class="'+(bad?'paywall':'notice')+'">'+String(text||'')+'</div>';}
  function escHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  // v6.76: the template editor uses the same rules as the active installation price list.
  function normalizeTemplateKindV676(v){return String(v||'fiber').toLowerCase()==='rf'?'rf':'fiber';}
  function priceItemKindV676(item){return normalizeTemplateKindV676(item&&(item.priceType||item.installKind||item.category||'fiber'));}
  function templateKindV676(t){
    return normalizeTemplateKindV676(t&&(t.installKind||t.priceType||t.templateKind||((t.items||[])[0]&&((t.items||[])[0].installKind||(t.items||[])[0].priceType||(t.items||[])[0].category))||'fiber'));
  }
  function priceSignatureV676(item,forcedKind){
    return String(item&&item.name||'').trim()+'|'+Number(item&&item.price||0)+'|'+String(item&&item.inputMode||'qty')+'|'+normalizeTemplateKindV676(forcedKind||priceItemKindV676(item));
  }
  function templatePriceRowsV662(t){
    var kind=templateKindV676(t),oldItems=Array.isArray(t.items)?t.items:[],byId={},bySignature={};
    oldItems.forEach(function(i){
      var id=String(i&&i.id||'');if(id)byId[id]=i;
      var sig=priceSignatureV676(i,kind);if(!bySignature[sig])bySignature[sig]=i;
    });
    var source=[];try{source=(window.priceList||priceList||[]);}catch(e){}
    var unique={};
    source.filter(function(p){return p&&p.active!==false&&!p.isDeleted&&priceItemKindV676(p)===kind;}).forEach(function(p){
      var sig=priceSignatureV676(p,kind);if(!unique[sig])unique[sig]=p;
    });
    var rows=Object.values(unique).sort(function(a,b){return Number(a.order||0)-Number(b.order||0);});
    // Keep selected legacy items visible once when the active price list no longer contains them.
    oldItems.forEach(function(i){var sig=priceSignatureV676(i,kind);if(!unique[sig]){unique[sig]=i;rows.push(i);}});
    return rows.map(function(p){
      var id=String(p&&p.id||''),sig=priceSignatureV676(p,kind),old=byId[id]||bySignature[sig]||{},mode=p.inputMode||old.inputMode||'qty',qty=Number(old.quantity||0);
      return {id:p.id||old.id||sig,name:p.name||old.name||'',price:Number(p.price!=null?p.price:old.price||0),inputMode:mode,quantity:qty,priceType:kind,installKind:kind};
    });
  }
  function renderTemplateEditorV662(t){
    var rows=templatePriceRowsV662(t);
    return '<div class="worker-template-editor-v662" id="templateEditor_'+escHtml(t.id)+'">'+
      '<label class="template-name-label-v662">שם התבנית<input id="templateName_'+escHtml(t.id)+'" value="'+escHtml(t.name||'')+'"></label>'+
      '<div class="template-items-scroll-v662">'+rows.map(function(p){var id=String(t.id)+'_'+String(p.id||p.name||'').replace(/[^a-zA-Z0-9_-]/g,'_');var checked=Number(p.quantity||0)>0;var ctl=(p.inputMode==='check')?'<input type="checkbox" id="tplQty_'+id+'" '+(checked?'checked':'')+'>':'<input type="number" min="0" step="1" id="tplQty_'+id+'" value="'+(Number(p.quantity||0)||'')+'" placeholder="0">';return '<div class="template-edit-item-v662" data-item-id="'+escHtml(p.id)+'" data-item-name="'+escHtml(p.name)+'" data-price="'+Number(p.price||0)+'" data-mode="'+escHtml(p.inputMode)+'"><div><b>'+escHtml(p.name)+'</b><small>'+Number(p.price||0).toLocaleString('he-IL')+' ₪</small></div>'+ctl+'</div>';}).join('')+'</div>'+
      '<div class="template-editor-actions-v662"><button type="button" class="btn-green" onclick="saveMyTemplateEditV662(\''+String(t.id).replace(/'/g,"\\'")+'\')">שמור שינויים</button><button type="button" class="btn-light" onclick="toggleMyTemplateEditorV662(\''+String(t.id).replace(/'/g,"\\'")+'\')">ביטול</button></div></div>';
  }

  window.refreshWorkerTemplateManagerV661=async function(force){
    var box=document.getElementById('workerTemplateManagerListV661');if(!box)return;
    box.innerHTML='<p class="muted">טוען תבניות...</p>';
    try{
      if(typeof window.loadTemplatesV649==='function')await window.loadTemplatesV649(force===true);
      else if(typeof window.loadTemplates==='function')await window.loadTemplates(force===true);
      var rows=myTemplates();
      if(!rows.length){box.innerHTML='<div class="hint-card">אין לך תבניות אישיות עדיין.</div>';return;}
      box.innerHTML=rows.map(function(t){
        var count=Array.isArray(t.items)?t.items.length:0,id=String(t.id).replace(/'/g,"\\'");
        return '<div class="worker-template-row-v661" data-template-id="'+escHtml(t.id)+'"><div class="worker-template-main-v662"><div><div class="item-title">'+escHtml(t.name||'ללא שם')+'</div><div class="item-sub">'+count+' פריטים</div></div><div class="worker-template-row-actions-v661"><button type="button" class="template-icon-btn-v662" onclick="toggleMyTemplateEditorV662(\''+id+'\')" title="עריכת התבנית" aria-label="עריכת התבנית">✎</button><button type="button" class="template-icon-btn-v662 template-delete-v662" onclick="deleteMyTemplateV661(\''+id+'\')" title="מחיקת התבנית" aria-label="מחיקת התבנית">🗑</button></div></div><div class="template-editor-host-v662" id="templateEditorHost_'+escHtml(t.id)+'"></div></div>';
      }).join('');
      trace('WORKER_TEMPLATE_MANAGER_RENDER_V662',{workerId:currentWorkerId(),count:rows.length});
    }catch(e){box.innerHTML='<div class="paywall">שגיאה בטעינת תבניות: '+escHtml(errText(e))+'</div>';trace('WORKER_TEMPLATE_MANAGER_ERROR_V662',{error:errText(e)});}
  };

  function findMine(id){return myTemplates().find(function(t){return String(t.id)===String(id);});}
  async function refreshAll(){
    try{if(typeof window.wmInvalidateStaticCacheV622==='function')window.wmInvalidateStaticCacheV622();}catch(e){}
    try{if(typeof window.loadTemplatesV649==='function')await window.loadTemplatesV649(true);else if(typeof window.loadTemplates==='function')await window.loadTemplates(true);}catch(e){}
    try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
    try{window.loadTemplatesAdmin&&window.loadTemplatesAdmin();}catch(e){}
    await window.refreshWorkerTemplateManagerV661(false);
  }
  window.toggleMyTemplateEditorV662=function(id){
    var host=document.getElementById('templateEditorHost_'+id);if(!host)return;var t=findMine(id);if(!t)return msg('התבנית לא נמצאה או שאינה שייכת לעובד המחובר.',true);
    var wasOpen=!!host.innerHTML;document.querySelectorAll('.template-editor-host-v662').forEach(function(x){x.innerHTML='';});
    if(!wasOpen){host.innerHTML=renderTemplateEditorV662(t);setTimeout(function(){var n=document.getElementById('templateName_'+id);if(n)n.focus();},0);}
  };
  window.saveMyTemplateEditV662=async function(id){
    var t=findMine(id);if(!t)return msg('התבנית לא נמצאה או שאינה שייכת לעובד המחובר.',true);
    var nameEl=document.getElementById('templateName_'+id),name=String(nameEl&&nameEl.value||'').trim();if(!name)return msg('שם התבנית לא יכול להיות ריק.',true);
    var host=document.getElementById('templateEditorHost_'+id),items=[];
    (host?host.querySelectorAll('.template-edit-item-v662'):[]).forEach(function(row){var input=row.querySelector('input'),mode=row.dataset.mode||'qty',q=mode==='check'?(input&&input.checked?1:0):Number(input&&input.value||0);if(q>0)items.push({id:row.dataset.itemId,name:row.dataset.itemName,price:Number(row.dataset.price||0),quantity:q,inputMode:mode,total:q*Number(row.dataset.price||0)});});
    if(!items.length)return msg('חובה להשאיר לפחות פריט אחד בתבנית.',true);
    try{await db.collection('installTemplates').doc(id).update({name:name,items:items,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});trace('WORKER_TEMPLATE_FULL_EDIT_V662',{id:id,workerId:currentWorkerId(),items:items.length});msg('התבנית עודכנה ✅');await refreshAll();}catch(e){msg('שגיאה בעדכון התבנית: '+errText(e),true);}
  };
  window.deleteMyTemplateV661=async function(id){
    var t=findMine(id);if(!t)return msg('התבנית לא נמצאה או שאינה שייכת לעובד המחובר.',true);
    if(!confirm('למחוק את התבנית "'+(t.name||'')+'"?'))return;
    try{if(typeof window.softDelete==='function')await window.softDelete('installTemplates',id);else await db.collection('installTemplates').doc(id).update({active:false,isDeleted:true,deletedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});trace('WORKER_TEMPLATE_DELETE_V662',{id:id,workerId:currentWorkerId()});msg('התבנית נמחקה ✅');await refreshAll();}catch(e){msg('שגיאה במחיקה: '+errText(e),true);}
  };

  // Safe replacement for v6.60 cleanup: never terminate Firestore or delete Firebase databases.
  async function clearSafeCustomCache(full){
    if(!confirm(full?'האיפוס הבטוח ימחק מטמוני אפליקציה, localStorage ו-sessionStorage וינתק מהחשבון. נתוני Firebase לא יימחקו. להמשיך?':'הניקוי הבטוח ימחק רק מטמוני Work Monitor ו-Cache Storage. הוא לא ימחק את מטמון Firebase הפעיל. להמשיך?'))return;
    trace('SAFE_CACHE_CLEAR_START_V661',{full:!!full});
    try{
      if(full&&window.auth&&typeof auth.signOut==='function')try{await auth.signOut();}catch(e){}
      var known=['work_monitor_beta_cache','work-monitor-beta-cache-v635','work_monitor_local_collection_cache_v648'];
      for(var i=0;i<known.length;i++)try{indexedDB.deleteDatabase(known[i]);}catch(e){}
      if(window.caches)try{var keys=await caches.keys();for(var j=0;j<keys.length;j++)await caches.delete(keys[j]);}catch(e){}
      if(full){try{localStorage.clear();}catch(e){}try{sessionStorage.clear();}catch(e){}}
      trace('SAFE_CACHE_CLEAR_DONE_V661',{full:!!full});
      location.replace(location.pathname+'?safeReset='+Date.now());
    }catch(e){trace('SAFE_CACHE_CLEAR_ERROR_V661',{error:errText(e)});alert('הניקוי נכשל: '+errText(e));}
  }
  window.clearAdminDataCacheV660=function(){return clearSafeCustomCache(false);};
  window.fullAdminLocalResetV660=function(){return clearSafeCustomCache(true);};

  function recoveryPanel(){
    if(document.getElementById('wmStartupRecoveryV661'))return;
    var el=document.createElement('div');el.id='wmStartupRecoveryV661';el.className='wm-startup-recovery-v661';
    el.innerHTML='<div class="wm-startup-recovery-card-v661"><h2>⚠️ החיבור מתעכב</h2><p>הנתונים בענן בטוחים. אפשר לנסות שוב או להעתיק לוג. אם Chrome ממשיך להיתקע, יש לנקות את נתוני האתר דרך הגדרות Chrome.</p><div class="actions"><button class="btn-green" onclick="location.reload()">נסה שוב</button><button class="btn-light" onclick="copyFirebaseAuditV661()">העתק לוג</button><button class="btn-yellow" onclick="this.closest(\'.wm-startup-recovery-v661\').remove()">המשך להמתין</button></div></div>';
    document.body.appendChild(el);trace('STARTUP_HEALTH_TIMEOUT_V661',{online:navigator.onLine,auth:!!window.auth,db:!!window.db});
  }
  window.copyFirebaseAuditV661=async function(){var text='';try{text=(window.WM_FIREBASE_AUDIT_LOG||window.wmFirebaseAuditLog||[]).map(function(x){return typeof x==='string'?x:JSON.stringify(x);}).join('\n');}catch(e){}if(!text)text='Work Monitor '+(window.APP_VERSION||'')+'\nURL: '+location.href+'\nOnline: '+navigator.onLine;try{await navigator.clipboard.writeText(text);alert('הלוג הועתק');}catch(e){prompt('העתק את הלוג',text);}};
  setTimeout(function(){
    try{
      var startup=document.getElementById('startupView');var worker=document.getElementById('workerView');var admin=document.getElementById('adminView');
      var stillBooting=startup&&!startup.classList.contains('hidden')&&(!worker||worker.classList.contains('hidden'))&&(!admin||admin.classList.contains('hidden'));
      if(stillBooting)recoveryPanel();
    }catch(e){}
  },15000);

  document.addEventListener('click',function(e){var btn=e.target&&e.target.closest&&e.target.closest('[data-worker-tab="settings"]');if(btn)setTimeout(function(){window.refreshWorkerTemplateManagerV661(false);},80);},true);
  setTimeout(function(){if(document.querySelector('[data-worker-pane="settings"].active'))window.refreshWorkerTemplateManagerV661(false);},2500);

  var previous=window.requiredChangelogRows;
  if(typeof previous==='function'&&!previous.__v661SafeRecoveryTemplates){
    var wrapped=function(){var rows=previous.apply(this,arguments)||[];if(!rows.some(function(r){return String(r.version||r.id||'')==='6.61-beta';}))rows.unshift({version:'6.61-beta',title:'התאוששות בטוחה וניהול תבניות לעובד',createdAt:'2026-07-30',items:['נוסף מסך ניהול תבניות אישי: שינוי שם, שכפול, מחיקה ומחיקת כל התבניות של העובד.','כפתורי ניקוי המטמון הוחלפו במסלול בטוח שאינו מסיים Firestore ואינו מוחק את מסדי Firebase/Auth בזמן פעילות.','נוסף Health Check באתחול שמציג מסך התאוששות ולוג אם החיבור נשאר תקוע.','בדיקת התאמת גרסאות הקבצים עודכנה ל-6.61-beta.']});return rows;};
    wrapped.__v661SafeRecoveryTemplates=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/* v6.64-beta: compact scrollable template manager and full inline editing. */
(function(){
  var old=window.requiredChangelogRows;
  if(typeof old==='function'&&!old.__v662Wrapped){
    var wrapped=function(){var rows=old.apply(this,arguments)||[];if(!rows.some(function(r){return String(r.version||r.id||'')==='6.64-beta';}))rows.unshift({version:'6.64-beta',title:'עריכת תבניות קומפקטית ומלאה',createdAt:'2026-07-30',items:['רשימת התבניות הוכנסה לאזור גלילה קבוע כדי שלא תאריך את עמוד ההגדרות.','הוסרו שכפול ומחיקת כל התבניות ונשארו אייקונים קטנים של עיפרון ופח.','לחיצה על עיפרון פותחת מתחת לתבנית עורך מלא עם שם התבנית, המחירון, הוספה והסרה של פריטים ושינוי כמויות.','שמירה מעדכנת את אותה תבנית ואינה יוצרת עותק חדש.']});return rows;};wrapped.__v662Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.63 BETA - TEMPLATE SAVE OWNER FIX + HTML AUDIT SWITCH
-------------------------------------------------------------------------------
1. Fixes "save as template" for a logged-in worker by resolving the active
   worker from viewedWorker/session instead of relying only on viewedWorker.
2. The saved document now always receives ownerWorkerId/ownerAuthUid and can
   therefore appear in the worker's filtered template list immediately.
3. Adds detailed Audit events around template save, reload and failures.
4. Firebase Audit can be enabled by WM_FIREBASE_AUDIT_DEBUG in beta.html while
   all existing URL parameters remain supported.
===============================================================================
*/
(function installTemplateSaveFixV663(){
  'use strict';
  if(window.__wmTemplateSaveFixV663)return;
  window.__wmTemplateSaveFixV663=true;

  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function activeWorker(){
    var w=null;
    try{
      if(window.viewedWorker&&viewedWorker.id)w=viewedWorker;
      else if(window.session&&session.worker&&session.worker.id)w=session.worker;
      else if(window.session&&(session.workerId||session.id))w={
        id:session.workerId||session.id,
        name:session.name||session.workerName||session.username||'',
        username:session.username||'',
        authUid:session.authUid||session.uid||''
      };
    }catch(e){}
    return w||{};
  }
  function currentAuthUidSafe(){
    try{if(window.auth&&auth.currentUser)return auth.currentUser.uid||'';}catch(e){}
    try{if(typeof currentAuthUid==='function')return currentAuthUid()||'';}catch(e){}
    return '';
  }
  function kindOf(entry){
    try{if(typeof kindFromEntryV412==='function')return kindFromEntryV412(entry);}catch(e){}
    return String(entry&&entry.installKind||entry&&entry.priceType||'fiber');
  }
  function kindLabel(kind){
    try{if(typeof kindLabelV412==='function')return kindLabelV412(kind);}catch(e){}
    return kind==='rf'?'RF':'סיב';
  }

  window.saveEntryAsTemplate=async function(id){
    var entry=null;
    try{entry=(window.monthEntries||monthEntries||[]).find(function(x){return String(x.id)===String(id);});}catch(e){}
    if(!entry||entry.workType!=='install'||!Array.isArray(entry.items)||!entry.items.length){alert('אפשר לשמור כתבנית רק התקנה עם פריטים.');return;}

    var worker=activeWorker();
    var ownerId=String(worker.id||'');
    var ownerName=String(worker.name||worker.username||'');
    var ownerUsername=String(worker.username||'');
    var ownerAuthUid=String(worker.authUid||currentAuthUidSafe()||'');
    var kind=kindOf(entry);
    trace('TEMPLATE_SAVE_V663_START',{entryId:id,ownerWorkerId:ownerId,ownerAuthUid:ownerAuthUid,kind:kind,itemCount:entry.items.length});

    if(!ownerId){
      trace('TEMPLATE_SAVE_V663_ABORT_NO_WORKER',{entryId:id,session:window.session?{workerId:session.workerId||'',role:session.role||'',username:session.username||''}:null});
      alert('לא ניתן לזהות את העובד המחובר. התבנית לא נשמרה. פתח את חלון ה-Audit ושלח את הלוג.');
      return;
    }

    var defaultName=('תבנית '+kindLabel(kind)+' מ-'+(typeof heDate==='function'?heDate(entry.date):entry.date)+' לקוח '+(entry.customerNumber||'')).trim();
    var name=prompt('שם לתבנית',defaultName);
    if(name===null)return;
    name=String(name).trim();
    if(!name){alert('חובה לתת שם לתבנית');return;}

    var payload={
      name:name,
      installKind:kind,
      priceType:kind,
      items:entry.items.map(function(i){return {id:i.id,name:i.name,price:Number(i.price||0),quantity:Number(i.quantity||0),inputMode:i.inputMode||'qty',installKind:kind,priceType:kind,total:Number(i.total||0)};}),
      active:true,
      isDeleted:false,
      ownerWorkerId:ownerId,
      ownerWorkerName:ownerName||'לא ידוע',
      ownerUsername:ownerUsername,
      ownerAuthUid:ownerAuthUid,
      createdByName:ownerName||'לא ידוע',
      createdByRole:(window.session&&session.role)||'worker',
      createdFromEntry:String(id),
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
      var ref=await db.collection('installTemplates').add(payload);
      trace('TEMPLATE_SAVE_V663_WRITE_OK',{templateId:ref&&ref.id||'',ownerWorkerId:ownerId,name:name});
      if(typeof window.wmInvalidateStaticCacheV622==='function')try{window.wmInvalidateStaticCacheV622();}catch(e){}
      if(typeof window.loadTemplates==='function')await window.loadTemplates(true);
      try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
      try{window.refreshWorkerTemplateManagerV661&&await window.refreshWorkerTemplateManagerV661(true);}catch(e){trace('TEMPLATE_SAVE_V663_MANAGER_REFRESH_ERROR',{error:String(e&&e.message||e)});}
      var visible=false;
      try{visible=(window.templates||templates||[]).some(function(t){return String(t.id)===String(ref.id);});}catch(e){}
      trace('TEMPLATE_SAVE_V663_COMPLETE',{templateId:ref&&ref.id||'',visibleAfterReload:visible,totalTemplates:(window.templates||[]).length||0});
      alert('התבנית נשמרה ✅ תחת '+kindLabel(kind));
    }catch(e){
      trace('TEMPLATE_SAVE_V663_ERROR',{entryId:id,ownerWorkerId:ownerId,error:String(e&&e.message||e),code:e&&e.code||''});
      alert('שגיאה בשמירת התבנית: '+String(e&&e.message||e));
    }
  };
  try{saveEntryAsTemplate=window.saveEntryAsTemplate;}catch(e){}

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v663Wrapped){
    var wrapped=function(){var rows=oldRows.apply(this,arguments)||[];if(!rows.some(function(r){return String(r.version||r.id||'')==='6.64-beta';}))rows.unshift({version:'6.64-beta',title:'תיקון שמירת תבניות ומתג Audit ב-HTML',createdAt:'2026-07-30',items:['תוקנה שמירת תבנית לעובד כאשר viewedWorker אינו מוגדר: העובד מזוהה גם מתוך session ונשמר ownerWorkerId תקין.','לא תוצג עוד הודעת הצלחה לפני שכתיבת התבנית ל-Firestore הסתיימה בפועל.','לאחר השמירה רשימת התבניות והמטמון מתרעננים מיד ונבדקת נראות התבנית החדשה.','נוסף בראש beta.html הקבוע WM_FIREBASE_AUDIT_DEBUG שניתן לשנות בין true ל-false, בלי לבטל את התמיכה ב-firebaseDebug=1 בכתובת.','נוספו אירועי Audit מפורטים לכל שלבי שמירת התבנית.']});return rows;};
    wrapped.__v663Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.64 BETA - TEMPLATE UI CACHE RECONCILIATION + DIRECT SAVE ROUTE
-------------------------------------------------------------------------------
1. Routes every visible "save as template" button through one direct handler,
   even when an older inline handler was captured before the v6.63 override.
2. Immediately upserts the new Firestore document into the local templates
   array and redraws both the install selector and the worker template manager.
3. A forced template-manager refresh now performs a real Firestore query and
   reconciles by document id, while filtering soft-deleted/inactive templates.
4. Edit and delete refreshes use the same reconciled source, preventing an old
   createdAt listener copy from reviving a stale/deleted template in the UI.
===============================================================================
*/
(function installTemplateReconciliationV664(){
  'use strict';
  if(window.__wmTemplateReconciliationV664)return;
  window.__wmTemplateReconciliationV664=true;

  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function workerId(){try{return String((window.viewedWorker&&viewedWorker.id)||(window.session&&session.workerId)||(window.session&&session.worker&&session.worker.id)||'');}catch(e){return '';}}
  function isVisible(t){return !!(t&&t.isDeleted!==true&&t.active!==false);}
  function belongs(t){var id=workerId();try{return !t.ownerWorkerId||String(t.ownerWorkerId)===id||(window.session&&session.role==='admin');}catch(e){return !t.ownerWorkerId||String(t.ownerWorkerId)===id;}}
  function sortRows(rows){return rows.sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'he');});}
  function setRuntimeTemplates(rows){
    var clean=sortRows((Array.isArray(rows)?rows:[]).filter(isVisible).filter(belongs));
    window.templates=clean;
    try{templates=clean;}catch(e){}
    try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
    return clean;
  }
  function upsertRuntimeTemplate(row){
    var all=[];try{all=(window.templates||templates||[]).slice();}catch(e){}
    all=all.filter(function(x){return String(x&&x.id||'')!==String(row&&row.id||'');});
    if(isVisible(row)&&belongs(row))all.push(row);
    return setRuntimeTemplates(all);
  }
  var templateQueryInflightV668=null,templateQueryWorkerV668='',templateQueryStartedV668=0;
  async function queryTemplatesFromServerV664(reason){
    var requestedWorker=workerId();
    if(!requestedWorker){trace('TEMPLATE_RECONCILE_V668_SKIP_NO_WORKER',{reason:reason||''});return [];}
    if(templateQueryInflightV668&&templateQueryWorkerV668===requestedWorker){
      trace('TEMPLATE_RECONCILE_V668_JOIN_INFLIGHT',{reason:reason||'',workerId:requestedWorker});
      return templateQueryInflightV668;
    }
    templateQueryWorkerV668=requestedWorker;templateQueryStartedV668=Date.now();
    templateQueryInflightV668=(async function(){
      trace('TEMPLATE_RECONCILE_V668_START',{reason:reason||'',workerId:requestedWorker});
      // v6.69: installTemplates now uses the same IndexedDB + createdAt/updatedAt
      // delta mechanism as days off and locks. Never perform a full collection get here.
      var rows=[];
      if(typeof window.loadTemplates==='function')rows=await window.loadTemplates(false);
      else if(typeof loadTemplates==='function')rows=await loadTemplates(false);
      var current=workerId();
      if(current!==requestedWorker){
        trace('TEMPLATE_DELTA_V669_STALE_IGNORED',{reason:reason||'',requestedWorker:requestedWorker,currentWorker:current,cachedDocs:(rows||[]).length});
        return [];
      }
      var clean=setRuntimeTemplates(rows||[]);
      trace('TEMPLATE_DELTA_V669_READY',{reason:reason||'',cachedDocs:(rows||[]).length,visibleDocs:clean.length,workerId:requestedWorker,durationMs:Date.now()-templateQueryStartedV668});
      return clean;
    })();
    try{return await templateQueryInflightV668;}
    finally{if(templateQueryWorkerV668===requestedWorker){templateQueryInflightV668=null;templateQueryWorkerV668='';}}
  }
  window.wmReloadTemplatesFromServerV664=queryTemplatesFromServerV664;

  var oldRefresh=window.refreshWorkerTemplateManagerV661;
  window.refreshWorkerTemplateManagerV661=async function(force){
    if(force===true){
      try{await queryTemplatesFromServerV664('manager-force-refresh');}
      catch(e){trace('TEMPLATE_RECONCILE_V664_ERROR',{reason:'manager-force-refresh',error:String(e&&e.message||e)});}
    }
    return oldRefresh?oldRefresh.call(this,false):undefined;
  };

  function activeWorker(){
    try{
      if(window.viewedWorker&&viewedWorker.id)return viewedWorker;
      if(window.session&&session.worker&&session.worker.id)return session.worker;
      if(window.session&&(session.workerId||session.id))return {id:session.workerId||session.id,name:session.name||session.workerName||session.username||'',username:session.username||'',authUid:session.authUid||session.uid||''};
    }catch(e){}
    return {};
  }
  function authUid(){try{return auth&&auth.currentUser&&auth.currentUser.uid||'';}catch(e){return '';}}
  function entryById(id){try{return (window.monthEntries||monthEntries||[]).find(function(x){return String(x.id)===String(id);});}catch(e){return null;}}
  function kindOf(e){try{return typeof kindFromEntryV412==='function'?kindFromEntryV412(e):String(e.installKind||e.priceType||'fiber');}catch(x){return String(e.installKind||e.priceType||'fiber');}}
  function kindLabel(k){try{return typeof kindLabelV412==='function'?kindLabelV412(k):(k==='rf'?'RF':'סיב');}catch(e){return k==='rf'?'RF':'סיב';}}

  window.saveEntryAsTemplateV664=async function(id){
    var entry=entryById(id);
    if(!entry||entry.workType!=='install'||!Array.isArray(entry.items)||!entry.items.length){alert('אפשר לשמור כתבנית רק התקנה עם פריטים.');return;}
    var w=activeWorker(),ownerId=String(w.id||'');
    if(!ownerId){trace('TEMPLATE_SAVE_V664_ABORT_NO_WORKER',{entryId:id});alert('לא ניתן לזהות את העובד המחובר.');return;}
    var kind=kindOf(entry);
    var defaultName=('תבנית '+kindLabel(kind)+' מ-'+(typeof heDate==='function'?heDate(entry.date):entry.date)+' לקוח '+(entry.customerNumber||'')).trim();
    var name=prompt('שם לתבנית',defaultName);if(name===null)return;name=String(name).trim();if(!name){alert('חובה לתת שם לתבנית');return;}
    var payload={name:name,installKind:kind,priceType:kind,items:entry.items.map(function(i){return {id:i.id,name:i.name,price:Number(i.price||0),quantity:Number(i.quantity||0),inputMode:i.inputMode||'qty',installKind:kind,priceType:kind,total:Number(i.total||0)};}),active:true,isDeleted:false,ownerWorkerId:ownerId,ownerWorkerName:String(w.name||w.username||'לא ידוע'),ownerUsername:String(w.username||''),ownerAuthUid:String(w.authUid||authUid()||''),createdByName:String(w.name||w.username||'לא ידוע'),createdByRole:(window.session&&session.role)||'worker',createdFromEntry:String(id),createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    trace('TEMPLATE_SAVE_V664_START',{entryId:id,ownerWorkerId:ownerId,itemCount:payload.items.length});
    try{
      var ref=await db.collection('installTemplates').add(payload);
      var local=Object.assign({id:ref.id},payload,{createdAt:new Date(),updatedAt:new Date()});
      try{if(typeof window.wmTemplateCacheUpsertV670==='function')await window.wmTemplateCacheUpsertV670(local,'save-v671');}catch(cacheErr){trace('TEMPLATE_CACHE_V670_SAVE_ERROR',{templateId:ref.id,error:String(cacheErr&&cacheErr.message||cacheErr)});}
      var before=0;try{before=(window.templates||[]).length;}catch(e){}
      var after=upsertRuntimeTemplate(local).length;
      try{await window.refreshWorkerTemplateManagerV661(false);}catch(e){}
      trace('TEMPLATE_SAVE_V664_LOCAL_UPSERT',{templateId:ref.id,before:before,after:after,ownerWorkerId:ownerId});
      setTimeout(function(){queryTemplatesFromServerV664('post-save-confirm').then(function(){try{window.refreshWorkerTemplateManagerV661(false);}catch(e){}}).catch(function(e){trace('TEMPLATE_SAVE_V664_CONFIRM_ERROR',{templateId:ref.id,error:String(e&&e.message||e)});});},450);
      trace('TEMPLATE_SAVE_V664_COMPLETE',{templateId:ref.id,name:name});
      alert('התבנית נשמרה ✅ תחת '+kindLabel(kind));
    }catch(e){trace('TEMPLATE_SAVE_V664_ERROR',{entryId:id,error:String(e&&e.message||e),code:e&&e.code||''});alert('שגיאה בשמירת התבנית: '+String(e&&e.message||e));}
  };
  window.saveEntryAsTemplate=window.saveEntryAsTemplateV664;
  try{saveEntryAsTemplate=window.saveEntryAsTemplateV664;}catch(e){}

  // Capture the click before legacy inline onclick handlers, so only v6.64 runs.
  document.addEventListener('click',function(ev){
    var btn=ev.target&&ev.target.closest&&ev.target.closest('button');if(!btn)return;
    var raw=String(btn.getAttribute('onclick')||'');
    if(raw.indexOf('saveEntryAsTemplate(')<0)return;
    var m=raw.match(/saveEntryAsTemplate\(['\"]([^'\"]+)['\"]\)/);if(!m)return;
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    trace('TEMPLATE_SAVE_V664_DIRECT_ROUTE',{entryId:m[1]});
    window.saveEntryAsTemplateV664(m[1]);
  },true);

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v664Wrapped){
    var wrapped=function(){var rows=oldRows.apply(this,arguments)||[];if(!rows.some(function(r){return String(r.version||r.id||'')==='6.64-beta';}))rows.unshift({version:'6.64-beta',title:'תיקון הצגת תבניות לאחר שמירה, עריכה ומחיקה',createdAt:'2026-07-30',items:['כפתור שמור כתבנית מנותב ישירות לפונקציה החדשה גם כאשר נשאר onclick ישן בכרטיס העבודה.','לאחר כתיבה ל-Firestore התבנית מתווספת מיד למערך המקומי, לרשימת הבחירה ולמנהל התבניות.','רענון כפוי של מנהל התבניות מבצע כעת קריאה אמיתית ל-Firestore ומאחד מסמכים לפי המזהה שלהם.','תבניות עם isDeleted=true או active=false מסוננות בכל רענון ואינן חוזרות דרך מאזין createdAt ישן.','נוספו אירועי Audit מפורטים לניתוב, עדכון מקומי ואימות מול השרת.']});return rows;};
    wrapped.__v664Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.66 BETA - IMMEDIATE TEMPLATE DELETE EVICTION
-------------------------------------------------------------------------------
1. A deleted template is removed from runtime arrays and both template UIs
   immediately, before waiting for Firestore listeners or a manual refresh.
2. A short tombstone guard prevents createdAt/updatedAt listeners from reviving
   the soft-deleted document while their pending snapshots settle.
3. The server reconciliation remains the final source of truth in background.
===============================================================================
*/
(function installImmediateTemplateDeleteV665(){
  'use strict';
  if(window.__wmImmediateTemplateDeleteV665)return;
  window.__wmImmediateTemplateDeleteV665=true;
  var tombstones=window.__wmTemplateDeleteTombstonesV665=window.__wmTemplateDeleteTombstonesV665||new Set();
  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function currentRows(){try{return (window.templates||templates||[]).slice();}catch(e){return [];}}
  function setRows(rows){
    var clean=(Array.isArray(rows)?rows:[]).filter(function(t){return t&&t.isDeleted!==true&&t.active!==false&&!tombstones.has(String(t.id||''));});
    window.templates=clean;try{templates=clean;}catch(e){}
    try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
    return clean;
  }
  function evict(id,reason){
    id=String(id||'');
    var before=currentRows().length;
    tombstones.add(id);
    var after=setRows(currentRows().filter(function(t){return String(t&&t.id||'')!==id;})).length;
    try{document.querySelectorAll('[data-template-id="'+CSS.escape(id)+'"]').forEach(function(el){el.remove();});}catch(e){
      try{document.querySelectorAll('[data-template-id]').forEach(function(el){if(String(el.getAttribute('data-template-id'))===id)el.remove();});}catch(_e){}
    }
    var box=document.getElementById('workerTemplateManagerListV661');
    if(box&&!box.querySelector('[data-template-id]'))box.innerHTML='<div class="hint-card">אין לך תבניות אישיות עדיין.</div>';
    trace('TEMPLATE_DELETE_V665_EVICT',{templateId:id,reason:reason||'',before:before,after:after});
  }
  window.wmEvictDeletedTemplateV665=evict;

  var oldRender=window.renderTemplateSelect;
  if(typeof oldRender==='function'&&!oldRender.__v665Wrapped){
    var wrappedRender=function(){setRows(currentRows());return oldRender.apply(this,arguments);};
    wrappedRender.__v665Wrapped=true;window.renderTemplateSelect=wrappedRender;try{renderTemplateSelect=wrappedRender;}catch(e){}
  }

  window.deleteMyTemplateV661=async function(id){
    id=String(id||'');
    var t=currentRows().find(function(x){return String(x&&x.id||'')===id;});
    if(!t){alert('התבנית לא נמצאה.');return;}
    if(!await window.wmConfirmTemplateDeleteV666(String(t.name||'')))return;
    evict(id,'before-write');
    try{
      if(typeof window.softDelete==='function')await window.softDelete('installTemplates',id);
      else await db.collection('installTemplates').doc(id).update({active:false,isDeleted:true,deletedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      trace('TEMPLATE_DELETE_V665_WRITE_OK',{templateId:id});
      try{if(typeof window.wmTemplateCacheEvictV670==='function')await window.wmTemplateCacheEvictV670(id,'delete-v671');}catch(cacheErr){trace('TEMPLATE_CACHE_V670_DELETE_ERROR',{templateId:id,error:String(cacheErr&&cacheErr.message||cacheErr)});}
      try{var m=document.getElementById('workerTemplateManagerMsgV661');if(m)m.innerHTML='<div class="notice">התבנית נמחקה ✅</div>';}catch(e){}
      [0,80,260,700,1500].forEach(function(ms){setTimeout(function(){evict(id,'listener-guard-'+ms);},ms);});
      setTimeout(function(){
        var reload=window.wmReloadTemplatesFromServerV664;
        if(typeof reload==='function')reload('post-delete-v665').then(function(){evict(id,'server-confirm');try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){};tombstones.delete(id);}).catch(function(e){trace('TEMPLATE_DELETE_V665_RELOAD_ERROR',{templateId:id,error:String(e&&e.message||e)});});
        else tombstones.delete(id);
      },900);
    }catch(e){
      tombstones.delete(id);
      trace('TEMPLATE_DELETE_V665_ERROR',{templateId:id,error:String(e&&e.message||e),code:e&&e.code||''});
      alert('שגיאה במחיקת התבנית: '+String(e&&e.message||e));
      try{window.wmReloadTemplatesFromServerV664&&window.wmReloadTemplatesFromServerV664('delete-error-v665');}catch(_e){}
    }
  };
  try{deleteMyTemplateV661=window.deleteMyTemplateV661;}catch(e){}

  var oldDelete=window.deleteTemplate;
  window.deleteTemplate=async function(id){
    id=String(id||'');if(!id||!await window.wmConfirmTemplateDeleteV666(''))return;
    evict(id,'admin-before-write');
    try{
      if(typeof window.softDelete==='function')await window.softDelete('installTemplates',id);
      else await db.collection('installTemplates').doc(id).update({active:false,isDeleted:true,deletedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      [0,100,350,900].forEach(function(ms){setTimeout(function(){evict(id,'admin-listener-guard-'+ms);},ms);});
      setTimeout(function(){try{window.wmReloadTemplatesFromServerV664&&window.wmReloadTemplatesFromServerV664('admin-post-delete-v665');window.loadTemplatesAdmin&&window.loadTemplatesAdmin();}catch(e){};tombstones.delete(id);},950);
    }catch(e){tombstones.delete(id);alert('שגיאה במחיקת התבנית: '+String(e&&e.message||e));if(oldDelete)return oldDelete.call(this,id);}
  };
  try{deleteTemplate=window.deleteTemplate;}catch(e){}

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v665Wrapped){
    var wrapped=function(){var rows=oldRows.apply(this,arguments)||[];if(!rows.some(function(r){return String(r.version||r.id||'')==='6.66-beta';}))rows.unshift({version:'6.66-beta',title:'מחיקת תבנית מיידית וכפתורי Audit קומפקטיים',createdAt:'2026-07-30',items:['תבנית שנמחקת מוסרת מיד ממנהל התבניות ומרשימת הבחירה בלי צורך בלחיצה על רענן.','נוסף מנגנון Tombstone קצר שמונע ממאזיני createdAt ו-updatedAt להחזיר למסך מסמך שנמחק בזמן שה-Snapshot מתעדכן.','לאחר המחיקה מתבצע אימות רקע מול Firestore ומיזוג מחדש לפי מזהה המסמך.','כפתורי חלון Firebase Audit הוקטנו לאייקונים קומפקטיים עם כותרות נגישות להעתקה, ניקוי, מזעור וסגירה.']});return rows;};
    wrapped.__v665Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.66 BETA - REAL DELETE CONFIRMATION + CLEAN LOGOUT LISTENER SHUTDOWN
-------------------------------------------------------------------------------
1. Template deletion uses an in-app two-button confirmation dialog: Delete/Cancel.
2. Cancel, backdrop tap and the X button never write to Firestore.
3. Every Firestore onSnapshot unsubscribe is tracked and detached before signOut,
   preventing expected permission errors from appearing after logout.
===============================================================================
*/
(function installTemplateConfirmAndCleanLogoutV666(){
  'use strict';
  if(window.__wmTemplateConfirmAndCleanLogoutV666)return;
  window.__wmTemplateConfirmAndCleanLogoutV666=true;

  function ensureConfirmUi(){
    var host=document.getElementById('wmConfirmDeleteV666');
    if(host)return host;
    var style=document.createElement('style');
    style.id='wmConfirmDeleteStyleV666';
    style.textContent='\
#wmConfirmDeleteV666{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.48);direction:rtl}\
#wmConfirmDeleteV666.wm-open-v666{display:flex}\
#wmConfirmDeleteV666 .wm-confirm-card-v666{width:min(92vw,390px);background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:20px}\
#wmConfirmDeleteV666 .wm-confirm-head-v666{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}\
#wmConfirmDeleteV666 .wm-confirm-title-v666{font-size:19px;font-weight:800}\
#wmConfirmDeleteV666 .wm-confirm-x-v666{border:0;background:transparent;font-size:25px;line-height:1;cursor:pointer;padding:3px 7px}\
#wmConfirmDeleteV666 .wm-confirm-text-v666{font-size:15px;line-height:1.55;margin:8px 0 18px;color:#333;overflow-wrap:anywhere}\
#wmConfirmDeleteV666 .wm-confirm-actions-v666{display:flex;gap:10px}\
#wmConfirmDeleteV666 .wm-confirm-actions-v666 button{flex:1;min-height:44px;border:0;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer}\
#wmConfirmDeleteV666 .wm-confirm-cancel-v666{background:#eef1f5;color:#222}\
#wmConfirmDeleteV666 .wm-confirm-delete-v666{background:#c62828;color:#fff}';
    document.head.appendChild(style);
    host=document.createElement('div');
    host.id='wmConfirmDeleteV666';
    host.setAttribute('role','dialog');
    host.setAttribute('aria-modal','true');
    host.setAttribute('aria-labelledby','wmConfirmDeleteTitleV666');
    host.innerHTML='<div class="wm-confirm-card-v666"><div class="wm-confirm-head-v666"><div id="wmConfirmDeleteTitleV666" class="wm-confirm-title-v666">מחיקת תבנית</div><button type="button" class="wm-confirm-x-v666" aria-label="סגירה">×</button></div><div class="wm-confirm-text-v666"></div><div class="wm-confirm-actions-v666"><button type="button" class="wm-confirm-cancel-v666">ביטול</button><button type="button" class="wm-confirm-delete-v666">כן, מחק</button></div></div>';
    document.body.appendChild(host);
    return host;
  }

  window.wmConfirmTemplateDeleteV666=function(templateName){
    return new Promise(function(resolve){
      var host=ensureConfirmUi();
      var done=false;
      var name=String(templateName||'').trim();
      var text=host.querySelector('.wm-confirm-text-v666');
      text.textContent=name?'האם למחוק את התבנית "'+name+'"?':'האם למחוק את התבנית?';
      var cancel=host.querySelector('.wm-confirm-cancel-v666');
      var del=host.querySelector('.wm-confirm-delete-v666');
      var close=host.querySelector('.wm-confirm-x-v666');
      function finish(value){if(done)return;done=true;host.classList.remove('wm-open-v666');document.removeEventListener('keydown',onKey,true);resolve(!!value);}
      function onKey(e){if(e.key==='Escape'){e.preventDefault();finish(false);}}
      cancel.onclick=function(){finish(false);};
      close.onclick=function(){finish(false);};
      del.onclick=function(){finish(true);};
      host.onclick=function(e){if(e.target===host)finish(false);};
      document.addEventListener('keydown',onKey,true);
      host.classList.add('wm-open-v666');
      setTimeout(function(){try{cancel.focus();}catch(e){}},0);
    });
  };

  // Track every Firestore listener created after scripts finish loading.
  var active=window.__wmActiveFirestoreUnsubsV666=window.__wmActiveFirestoreUnsubsV666||new Set();
  function wrapOnSnapshot(proto,label){
    if(!proto||typeof proto.onSnapshot!=='function'||proto.onSnapshot.__wmTrackedV666)return;
    var original=proto.onSnapshot;
    function tracked(){
      var unsub=original.apply(this,arguments);
      if(typeof unsub!=='function')return unsub;
      var closed=false;
      function wrapped(){if(closed)return;closed=true;active.delete(wrapped);return unsub();}
      wrapped.__wmListenerLabelV666=label||'';
      active.add(wrapped);
      return wrapped;
    }
    tracked.__wmTrackedV666=true;
    tracked.__wmOriginalV666=original;
    proto.onSnapshot=tracked;
  }
  try{
    var fs=firebase&&firebase.firestore;
    wrapOnSnapshot(fs&&fs.Query&&fs.Query.prototype,'query');
    wrapOnSnapshot(fs&&fs.DocumentReference&&fs.DocumentReference.prototype,'document');
    wrapOnSnapshot(fs&&fs.CollectionReference&&fs.CollectionReference.prototype,'collection');
  }catch(e){}

  window.wmDetachAllFirestoreListenersV666=function(reason){
    var list=Array.from(active),detached=0;
    list.forEach(function(fn){try{fn();detached++;}catch(e){active.delete(fn);}});
    try{window.stopHistoricalMonthListenerV631&&window.stopHistoricalMonthListenerV631(reason||'logout-v6.66');}catch(e){}
    try{window.stopHistoricalDayOffListenerV632&&window.stopHistoricalDayOffListenerV632(reason||'logout-v6.66');}catch(e){}
    try{window.wmTraceV617&&window.wmTraceV617('LOGOUT_LISTENERS_DETACHED_V666',{reason:reason||'',detached:detached,remaining:active.size});}catch(e){}
    return detached;
  };

  var oldLogout=window.logout;
  if(typeof oldLogout==='function'&&!oldLogout.__wmCleanV666){
    var cleanLogout=async function(){
      try{window.wmDetachAllFirestoreListenersV666('before-signout-v6.66');}catch(e){}
      return await oldLogout.apply(this,arguments);
    };
    cleanLogout.__wmCleanV666=true;
    window.logout=cleanLogout;
    try{logout=cleanLogout;}catch(e){}
  }

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v666Wrapped){
    var wrappedRows=function(){
      var rows=oldRows.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.66-beta';})){
        rows.unshift({version:'6.66-beta',title:'אישור מחיקת תבנית ויציאה נקייה',createdAt:'2026-07-31',items:[
          'מחיקת תבנית מציגה כעת חלון פנימי עם שני כפתורים ברורים: כן, מחק וביטול.',
          'לחיצה על ביטול, על X, מחוץ לחלון או על מקש Escape אינה מוחקת ואינה כותבת ל-Firebase.',
          'כל מאזיני Firestore מנותקים לפני signOut כדי למנוע שגיאות הרשאה מיותרות בלוג לאחר יציאה.',
          'נוסף אירוע Audit בשם LOGOUT_LISTENERS_DETACHED_V666 לצורך אימות סדר היציאה.'
        ]});
      }
      return rows;
    };
    wrappedRows.__v666Wrapped=true;
    window.requiredChangelogRows=wrappedRows;
    try{requiredChangelogRows=wrappedRows;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.68 BETA - SINGLE-FLIGHT TEMPLATE LOAD + SAFE WORKER SWITCH
-------------------------------------------------------------------------------
1. Templates load automatically only when opening "My tools" or Installation.
2. At most one full installTemplates query can run for the current worker.
3. Results started for a previous worker are ignored after logout/switch.
4. Template loading never blocks the worker login flow.
===============================================================================
*/
(function installAutomaticTemplateLoadV668(){
  'use strict';
  if(window.__wmAutomaticTemplateLoadV668)return;
  window.__wmAutomaticTemplateLoadV668=true;
  var timer=0,lastRequestedAt=0;
  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function workerId(){try{return String((window.viewedWorker&&viewedWorker.id)||(window.session&&session.workerId)||(window.session&&session.worker&&session.worker.id)||'');}catch(e){return '';}}
  function visibleRows(rows){return (Array.isArray(rows)?rows:[]).filter(function(t){return t&&t.active!==false&&t.isDeleted!==true;});}
  function normalizeRuntime(reason){
    var rows=[];try{rows=(window.templates||templates||[]).slice();}catch(e){}
    rows=visibleRows(rows);
    window.templates=rows;try{templates=rows;}catch(e){}
    try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
    trace('TEMPLATE_AUTO_V668_NORMALIZE',{reason:reason||'',visibleDocs:rows.length,workerId:workerId()});
    return rows;
  }
  function load(reason){
    var id=workerId();
    normalizeRuntime('before-'+(reason||'open'));
    try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
    if(!id){trace('TEMPLATE_AUTO_V668_SKIP_NO_WORKER',{reason:reason||''});return Promise.resolve([]);}
    lastRequestedAt=Date.now();
    return Promise.resolve().then(function(){
      if(workerId()!==id)return [];
      if(typeof window.wmReloadTemplatesFromServerV664==='function')return window.wmReloadTemplatesFromServerV664('auto-open-v668-'+(reason||'unknown'));
      return [];
    }).then(function(rows){
      if(workerId()!==id){trace('TEMPLATE_AUTO_V668_RESULT_IGNORED',{requestedWorker:id,currentWorker:workerId(),reason:reason||''});return [];}
      normalizeRuntime('after-server-'+(reason||'open'));
      try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
      try{window.loadTemplatesAdmin&&window.loadTemplatesAdmin();}catch(e){}
      trace('TEMPLATE_AUTO_V668_DONE',{reason:reason||'',workerId:id,elapsedMs:Date.now()-lastRequestedAt});
      return rows||[];
    }).catch(function(e){trace('TEMPLATE_AUTO_V668_ERROR',{reason:reason||'',workerId:id,error:String(e&&e.message||e)});return [];});
  }
  window.wmAutoLoadTemplatesV668=load;
  function schedule(reason){clearTimeout(timer);timer=setTimeout(function(){load(reason);},120);}
  document.addEventListener('click',function(ev){
    var btn=ev.target&&ev.target.closest&&ev.target.closest('button,[role="button"]');if(!btn)return;
    var text=String(btn.textContent||'').replace(/\s+/g,' ').trim();
    var id=String(btn.id||'');
    if(text.indexOf('הכלים שלי')>=0||id==='installBtn'||text==='התקנה')schedule(text||id||'template-open');
  },true);
  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v668Wrapped){
    var wrapped=function(){
      var rows=oldRows.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.72-beta';}))rows.unshift({version:'6.72-beta',title:'טעינת תבניות יחידה ומעבר בטוח בין עובדים',createdAt:'2026-07-31',items:[
        'טעינת התבניות האוטומטית מתבצעת רק בפתיחת הכלים שלי או חלון התקנה, ולא מכל פעולה בהגדרות או במעבר חודש.',
        'בכל רגע מתבצעת לכל היותר שאילתת installTemplates מלאה אחת; בקשות נוספות מצטרפות לאותה טעינה.',
        'תוצאה שהתחילה אצל עובד קודם נזרקת לאחר יציאה או מעבר עובד ואינה יכולה לעדכן את המסך של העובד החדש.',
        'טעינת התבניות פועלת ברקע ואינה חוסמת את תהליך הכניסה לעובד.'
      ]});
      return rows;
    };
    wrapped.__v668Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.69 BETA - INSTALL TEMPLATES CACHE + DELTA ONLY
-------------------------------------------------------------------------------
1. installTemplates restores immediately from IndexedDB.
2. Only createdAt/updatedAt delta listeners synchronize server changes.
3. Opening My Tools / Installation and pressing Refresh never runs a full get().
4. Save/delete update the local runtime immediately; listeners confirm changes.
===============================================================================
*/
(function installTemplateDeltaOnlyV669(){
  'use strict';
  if(window.__wmTemplateDeltaOnlyV669)return;
  window.__wmTemplateDeltaOnlyV669=true;
  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function refreshFromDelta(reason){
    var loader=window.loadTemplates||(typeof loadTemplates==='function'?loadTemplates:null);
    if(typeof loader!=='function')return Promise.resolve([]);
    return Promise.resolve(loader(false)).then(function(rows){
      try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
      try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
      trace('TEMPLATE_DELTA_V669_REFRESH',{reason:reason||'',docs:Array.isArray(rows)?rows.length:0});
      return rows||[];
    });
  }
  window.wmReloadTemplatesFromServerV664=function(reason){return refreshFromDelta(reason||'compat-reload');};
  window.wmRefreshTemplatesDeltaV669=refreshFromDelta;
  trace('TEMPLATE_DELTA_V669_READY',{mode:'indexeddb-createdAt-updatedAt'});

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v669Wrapped){
    var wrapped=function(){
      var rows=oldRows.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.72-beta';}))rows.unshift({version:'6.72-beta',title:'תבניות במטמון ודלתאות בלבד',createdAt:'2026-07-31',items:[
        'installTemplates נטען מיד מ-IndexedDB בדיוק כמו ימי חופש ונעילות ימים.',
        'לאחר הטעינה המקומית מחוברים מאזיני createdAt ו-updatedAt שמביאים רק תבניות חדשות או תבניות שהשתנו.',
        'פתיחת הכלים שלי, פתיחת התקנה ולחיצה על רענן אינן מבצעות עוד קריאה מלאה של כל אוסף התבניות.',
        'שמירה ומחיקה מעדכנות מיד את הרשימה המקומית, והדלתא מאשרת ומסנכרנת את השינוי בין מכשירים.',
        'מעבר בין עובדים אינו נחסם על ידי טעינת תבניות ואינו מחזיר תוצאה של העובד הקודם.'
      ]});
      return rows;
    };
    wrapped.__v669Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.70 BETA - STRICT PER-WORKER TEMPLATE ISOLATION
-------------------------------------------------------------------------------
1. The visible template array is cleared immediately when the active worker
   changes, signs out, or starts a new login.
2. Every template render is rebuilt only from the IndexedDB master cache and is
   filtered by the current workerId, active and isDeleted fields.
3. Save and delete mutate the IndexedDB master cache immediately, so Refresh
   never restores an older template list while waiting for Firestore delta.
4. Asynchronous results created for a previous worker are ignored.
===============================================================================
*/
(function installStrictWorkerTemplateIsolationV670(){
  'use strict';
  if(window.__wmStrictWorkerTemplateIsolationV670)return;
  window.__wmStrictWorkerTemplateIsolationV670=true;

  var DB_NAME='work_monitor_beta_cache',STORE='collections',KEY='installTemplates';
  var lastWorkerId='',switchToken=0,watchTimer=0;
  function trace(event,data){try{window.wmTraceV617&&window.wmTraceV617(event,data||{});}catch(e){}}
  function currentWorkerId(){
    try{return String((window.viewedWorker&&viewedWorker.id)||(window.session&&session.workerId)||(window.session&&session.worker&&session.worker.id)||'');}
    catch(e){return '';}
  }
  function isAdminWithoutSelectedWorker(){try{return !!(window.session&&session.role==='admin'&&!(window.viewedWorker&&viewedWorker.id));}catch(e){return false;}}
  function visibleForWorker(rows,id){
    id=String(id||'');
    return (Array.isArray(rows)?rows:[]).filter(function(t){
      if(!t||t.active===false||t.isDeleted===true)return false;
      var owner=String(t.ownerWorkerId||'');
      if(isAdminWithoutSelectedWorker())return true;
      return !!(id&&owner&&owner===id);
    }).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'he');});
  }
  function clearUi(reason){
    window.templates=[];try{templates=[];}catch(e){}
    try{var s=document.getElementById('installTemplateSelect');if(s)s.innerHTML='<option value="">בחר תבנית...</option>'; }catch(e){}
    try{var b=document.getElementById('workerTemplateManagerListV661');if(b)b.innerHTML='<p class="muted">התבניות ייטענו עבור העובד הנוכחי.</p>'; }catch(e){}
    try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
    trace('TEMPLATE_WORKER_ISOLATION_V670_CLEAR',{reason:reason||'',workerId:currentWorkerId()});
  }
  var dbPromiseV671=null;
  function openRaw(version){return new Promise(function(resolve,reject){
    try{
      var r=(typeof version==='number')?indexedDB.open(DB_NAME,version):indexedDB.open(DB_NAME);
      r.onupgradeneeded=function(ev){var db=ev.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
      r.onsuccess=function(){resolve(r.result);};
      r.onerror=function(){reject(r.error||new Error('IndexedDB open failed'));};
      r.onblocked=function(){trace('TEMPLATE_CACHE_V671_DB_BLOCKED',{database:DB_NAME,targetVersion:version||'current'});};
    }catch(e){reject(e);}
  });}
  async function ensureStoreV671(){
    var db=await openRaw();
    if(db.objectStoreNames.contains(STORE))return db;
    var nextVersion=Math.max(Number(db.version||1)+1,2);
    try{db.close();}catch(e){}
    trace('TEMPLATE_CACHE_V671_SCHEMA_UPGRADE',{database:DB_NAME,targetVersion:nextVersion,missingStore:STORE});
    db=await openRaw(nextVersion);
    if(!db.objectStoreNames.contains(STORE)){try{db.close();}catch(e){}throw new Error('IndexedDB store '+STORE+' was not created');}
    return db;
  }
  function openDb(){
    if(!dbPromiseV671)dbPromiseV671=ensureStoreV671().catch(function(err){dbPromiseV671=null;throw err;});
    return dbPromiseV671;
  }
  async function readMaster(){
    var db=await openDb();return new Promise(function(resolve,reject){
      try{var tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=function(){resolve(r.result&&Array.isArray(r.result.rows)?r.result.rows:[]);};r.onerror=function(){reject(r.error||tx.error);};}
      catch(e){dbPromiseV671=null;reject(e);}
    });
  }
  async function writeMaster(rows){
    var db=await openDb(),record={key:KEY,rows:Array.isArray(rows)?rows:[],savedAt:new Date().toISOString(),appVersion:'6.74-beta',schemaVersion:3};
    return new Promise(function(resolve,reject){
      try{var tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);tx.oncomplete=function(){resolve(record);};tx.onerror=function(){reject(tx.error||new Error('IndexedDB write failed'));};tx.onabort=function(){reject(tx.error||new Error('IndexedDB write aborted'));};}
      catch(e){dbPromiseV671=null;reject(e);}
    });
  }
  function applyRows(rows,requestedWorker,reason){
    var now=currentWorkerId();
    if(String(requestedWorker||'')!==now){trace('TEMPLATE_WORKER_ISOLATION_V670_STALE',{requestedWorker:requestedWorker||'',currentWorker:now,reason:reason||''});return [];}
    var clean=visibleForWorker(rows,now);
    window.templates=clean;try{templates=clean;}catch(e){}
    try{window.renderTemplateSelect&&window.renderTemplateSelect();}catch(e){}
    try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
    trace('TEMPLATE_WORKER_ISOLATION_V670_APPLY',{workerId:now,masterDocs:(rows||[]).length,visibleDocs:clean.length,reason:reason||''});
    return clean;
  }
  async function reloadForCurrentWorker(reason){
    var requested=currentWorkerId(),token=++switchToken;
    if(!requested&&!isAdminWithoutSelectedWorker()){clearUi('no-worker-'+(reason||''));return [];}
    try{
      var rows=await readMaster();
      if(token!==switchToken)return [];
      return applyRows(rows,requested,reason||'reload');
    }catch(e){trace('TEMPLATE_WORKER_ISOLATION_V670_IDB_ERROR',{reason:reason||'',error:String(e&&e.message||e)});return [];}
  }
  async function upsertCache(row,reason){
    if(!row||!row.id)return [];
    var runtime=[];try{runtime=Array.isArray(window.templates)?window.templates.slice():[];}catch(e){}
    runtime=runtime.filter(function(x){return String(x&&x.id||'')!==String(row.id);});runtime.push(row);
    applyRows(runtime,currentWorkerId(),(reason||'upsert')+'-runtime-first');
    try{
      var rows=await readMaster();
      rows=rows.filter(function(x){return String(x&&x.id||'')!==String(row.id);});rows.push(row);
      await writeMaster(rows);applyRows(rows,currentWorkerId(),reason||'upsert');
      trace('TEMPLATE_CACHE_V671_UPSERT',{templateId:String(row.id),workerId:String(row.ownerWorkerId||''),masterDocs:rows.length});
      return rows;
    }catch(e){
      trace('TEMPLATE_CACHE_V671_UPSERT_IDB_ERROR',{templateId:String(row.id),error:String(e&&e.message||e)});
      return runtime;
    }
  }
  async function evictCache(id,reason){
    id=String(id||'');var rows=await readMaster(),before=rows.length;
    rows=rows.filter(function(x){return String(x&&x.id||'')!==id;});
    await writeMaster(rows);applyRows(rows,currentWorkerId(),reason||'evict');
    trace('TEMPLATE_CACHE_V670_EVICT',{templateId:id,before:before,after:rows.length});
    return rows;
  }
  window.wmTemplateCacheUpsertV670=upsertCache;
  window.wmTemplateCacheEvictV670=evictCache;
  window.wmReloadTemplatesForCurrentWorkerV670=reloadForCurrentWorker;

  var previousLoad=window.loadTemplates||(typeof loadTemplates==='function'?loadTemplates:null);
  window.loadTemplates=async function(force){
    var requested=currentWorkerId(),token=++switchToken,rows=[];
    try{if(typeof previousLoad==='function')rows=await previousLoad.call(this,force===true)||[];}catch(e){trace('TEMPLATE_LOAD_V670_BASE_ERROR',{error:String(e&&e.message||e)});}
    if(token!==switchToken||requested!==currentWorkerId())return [];
    // v6.73: the worker-scoped loader is the source of truth, exactly like workerDaysOff/workEntries.
    // Never overwrite it with the old global installTemplates master cache.
    return applyRows(rows,requested,'load-v673-worker-scope');
  };
  try{loadTemplates=window.loadTemplates;}catch(e){}

  function workerChanged(reason){
    var id=currentWorkerId();if(id===lastWorkerId)return;
    var previous=lastWorkerId;lastWorkerId=id;switchToken++;
    clearUi(reason||'worker-change');
    if(id||isAdminWithoutSelectedWorker())setTimeout(function(){try{window.loadTemplates(false);}catch(e){trace('TEMPLATE_WORKER_SWITCH_V673_LOAD_ERROR',{error:String(e&&e.message||e)});}},0);
    trace('TEMPLATE_WORKER_SWITCH_V670',{previousWorker:previous,currentWorker:id,reason:reason||''});
  }
  watchTimer=setInterval(function(){workerChanged('state-watch');},120);
  try{window.addEventListener('beforeunload',function(){clearInterval(watchTimer);});}catch(e){}

  document.addEventListener('click',function(ev){
    var btn=ev.target&&ev.target.closest&&ev.target.closest('button');if(!btn)return;
    var id=String(btn.id||''),text=String(btn.textContent||'').replace(/\s+/g,' ').trim();
    if(id==='logoutBtn'||id==='workerLoginBtnV660'||/יציאה|התנתק/.test(text)){switchToken++;clearUi('auth-action-'+(id||text));}
  },true);

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v670Wrapped){
    var wrapped=function(){
      var rows=oldRows.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.72-beta';}))rows.unshift({version:'6.72-beta',title:'הפרדה מלאה של תבניות בין עובדים',createdAt:'2026-07-31',items:[
        'ביציאה או מעבר עובד רשימת התבניות מתנקה מיד ואינה מציגה עוד תבניות של המשתמש הקודם.',
        'כל טעינה ורענון מסננים באופן קשיח לפי ownerWorkerId של העובד הפעיל, יחד עם active ו-isDeleted.',
        'שמירה ומחיקה מעדכנות מיד גם את IndexedDB המקומי, ולכן רענון אינו מחזיר רשימה ישנה.',
        'תוצאות אסינכרוניות שהתחילו עבור עובד קודם נזרקות ואינן יכולות לצייר נתונים אצל העובד החדש.',
        'הגרסה נארזה כחבילה מלאה הכוללת beta.html, styles.css ושלושת קובצי JavaScript.'
      ]});
      return rows;
    };
    wrapped.__v670Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }

  var oldRowsV671=window.requiredChangelogRows;
  if(typeof oldRowsV671==='function'&&!oldRowsV671.__v671Wrapped){
    var wrappedV671=function(){
      var rows=oldRowsV671.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.72-beta';}))rows.unshift({version:'6.72-beta',title:'תיקון סופי למטמון התבניות והפרדה בין עובדים',createdAt:'2026-07-31',items:[
        'תוקן שדרוג IndexedDB כך שהחנות collections נוצרת גם אצל מכשירים שבהם מסד המטמון כבר היה קיים מגרסה קודמת.',
        'תוקנה המתנה לפעולת עדכון המטמון כדי למנוע UNHANDLED_REJECTION לאחר שמירת או מחיקת תבנית.',
        'תבנית חדשה נכנסת מיד לרשימה המקומית של העובד הפעיל גם אם IndexedDB נתקל בשגיאה זמנית.',
        'תבניות ללא ownerWorkerId אינן מוצגות עוד לעובדים; כל עובד רואה רק תבניות ששייכות אליו במפורש.',
        'נשמרו מנגנון הדלתאות והחיסכון בקריאות Firebase ללא הורדה מלאה של installTemplates.'
      ]});
      return rows;
    };
    wrappedV671.__v671Wrapped=true;window.requiredChangelogRows=wrappedV671;try{requiredChangelogRows=wrappedV671;}catch(e){}
  }

  lastWorkerId=currentWorkerId();
  clearUi('boot-v670');
  if(lastWorkerId||isAdminWithoutSelectedWorker())reloadForCurrentWorker('boot-v670');
})();


/*
===============================================================================
VERSION 6.72 BETA - UNIFIED WORK_MONITOR_BETA_CACHE SCHEMA VERSION
-------------------------------------------------------------------------------
1. The main work_monitor_beta_cache opener now uses schema version 2 everywhere.
2. Its upgrade transaction creates both workerSnapshots and collections stores.
3. This prevents VersionError when an existing version-2 database was reopened as version 1.
4. Template cache schema repair remains backward-compatible and no longer blocks startup.
===============================================================================
*/
(function installUnifiedCacheSchemaV672(){
  'use strict';
  if(window.__wmUnifiedCacheSchemaV672Installed)return;
  window.__wmUnifiedCacheSchemaV672Installed=true;
  try{window.wmTraceV617&&window.wmTraceV617('CACHE_SCHEMA_V672_READY',{database:'work_monitor_beta_cache',version:2,stores:['workerSnapshots','collections']});}catch(e){}
  var old=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof old==='function'&&!old.__v672Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=old.apply(this,arguments)||[];}catch(e){rows=[];}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.72-beta';}))rows.unshift({
        version:'6.72-beta',title:'איחוד גרסת IndexedDB ותיקון פתיחת המטמון',createdAt:'2026-07-31',items:[
          'כל פתיחה של work_monitor_beta_cache משתמשת כעת בגרסת מסד 2 ולא מנסה לפתוח מסד קיים בגרסה נמוכה יותר.',
          'שדרוג המסד יוצר יחד את workerSnapshots ואת collections, ולכן מטמון העבודה ומטמון התבניות יכולים לפעול באותו מסד בבטחה.',
          'תוקנה שגיאת The requested version (1) is less than the existing version (2) שחסמה את עליית האפליקציה.',
          'נשמרו טעינת הדלתא, ההפרדה בין עובדים והעדכון המיידי של תבניות ללא הורדות מלאות מיותרות.'
        ]
      });
      return rows;
    };
    wrapped.__v672Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.73 BETA - WORKER-SCOPED TEMPLATE CACHE/DELTA LIFECYCLE
-------------------------------------------------------------------------------
Templates now follow the same lifecycle as work entries and worker days off:
worker-specific IndexedDB key, one initial worker query, worker-filtered deltas,
listener detach on worker switch, and stale-result protection.
===============================================================================
*/
(function templateWorkerScopeV673(){
  'use strict';
  if(window.__wmTemplateWorkerScopeV673)return;window.__wmTemplateWorkerScopeV673=true;
  try{window.wmTraceV617&&window.wmTraceV617('TEMPLATE_WORKER_SCOPE_V673_INSTALLED',{cacheKey:'installTemplates:<workerId>',filters:['ownerWorkerId','createdAt/updatedAt']});}catch(e){}
  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v673Wrapped){
    var wrapped=function(){
      var rows=oldRows.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.74-beta';}))rows.unshift({version:'6.74-beta',title:'תבניות מסונכרנות לפי עובד כמו שאר הנתונים',createdAt:'2026-07-31',items:[
        'לכל עובד נשמר מטמון IndexedDB נפרד של installTemplates תחת מפתח הכולל את workerId.',
        'בכניסה לעובד מתבצעת טעינה מלאה אחת רק של התבניות שלו, ולאחריה מתקבלות רק דלתאות createdAt ו-updatedAt.',
        'במעבר או בהתנתקות מאזיני התבניות של העובד הקודם מנותקים, הרשימה מתנקה ותוצאות ישנות אינן יכולות לחזור למסך.',
        'שמירה, עריכה ומחיקה ממשיכות להתעדכן מיד מקומית ולהסתנכרן בין מכשירים.',
        'לוגיקת התבניות הותאמה ללוגיקה העובדת של עבודות וימי חופש, בלי לשנות את הגרסה היציבה 6.33.'
      ]});
      return rows;
    };
    wrapped.__v673Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.74 BETA - NON-BLOCKING WORKER TEMPLATE STARTUP
-------------------------------------------------------------------------------
Template loading must never hold the main worker startup screen. Cached rows are
rendered immediately; Firestore seed/delta work continues in the background.
===============================================================================
*/
(function templateNonBlockingV674(){
  'use strict';
  if(window.__wmTemplateNonBlockingV674)return;window.__wmTemplateNonBlockingV674=true;
  var DB_NAME='work_monitor_beta_cache',DB_VERSION=2,STORE='collections';
  var generation=0,activeWorker='',unsubs=[],inflight={};
  function trace(name,data){try{window.wmTraceV617&&window.wmTraceV617(name,data||{});}catch(e){}}
  function wid(){try{return String((window.viewedWorker&&window.viewedWorker.id)||(window.session&&window.session.workerId)||'');}catch(e){return '';}}
  function visible(rows){return (Array.isArray(rows)?rows:[]).filter(function(x){return x&&x.isDeleted!==true&&x.active!==false;});}
  function apply(rows,worker,source){
    if(wid()!==worker)return false;
    var clean=visible(rows).filter(function(x){return String(x.ownerWorkerId||'')===worker;}).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'he');});
    try{templates=clean;}catch(e){}
    window.templates=clean;
    try{typeof renderTemplateSelect==='function'&&renderTemplateSelect();}catch(e){}
    try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
    trace('TEMPLATES_V674_APPLY',{workerId:worker,docs:clean.length,source:source||''});
    return true;
  }
  function openDb(){return new Promise(function(resolve,reject){
    var r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains('workerSnapshots'))d.createObjectStore('workerSnapshots',{keyPath:'workerId'});if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'key'});};
    r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(r.error||new Error('IndexedDB open failed'));};
  });}
  async function read(worker){var d=await openDb();return new Promise(function(resolve,reject){try{var q=d.transaction(STORE,'readonly').objectStore(STORE).get('installTemplates:'+worker);q.onsuccess=function(){resolve(q.result||null);};q.onerror=function(){reject(q.error);};}catch(e){reject(e);}});}
  async function write(worker,rows){var d=await openDb(),rec={key:'installTemplates:'+worker,rows:Array.isArray(rows)?rows:[],savedAt:new Date().toISOString(),appVersion:'6.74-beta',schemaVersion:4};return new Promise(function(resolve,reject){try{var q=d.transaction(STORE,'readwrite').objectStore(STORE).put(rec);q.onsuccess=function(){resolve(rec);};q.onerror=function(){reject(q.error);};}catch(e){reject(e);}});}
  function stop(){unsubs.splice(0).forEach(function(u){try{u&&u();}catch(e){}});}
  function merge(base,snap){var m={};(Array.isArray(base)?base:[]).forEach(function(x){if(x&&x.id)m[x.id]=x;});snap.docChanges().forEach(function(ch){var row=Object.assign({id:ch.doc.id},ch.doc.data()||{});if(ch.type==='removed'||row.isDeleted===true||row.active===false)delete m[row.id];else m[row.id]=row;});return Object.keys(m).map(function(k){return m[k];});}
  async function background(worker,token,force){
    var key=worker+':'+token;if(inflight[key])return inflight[key];
    inflight[key]=(async function(){
      try{
        var q=db.collection('installTemplates').where('ownerWorkerId','==',worker);
        var snap=await q.get();
        if(token!==generation||wid()!==worker)return;
        var rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data()||{});});
        rows=visible(rows).filter(function(x){return String(x.ownerWorkerId||'')===worker;});
        apply(rows,worker,'firestore-seed');
        var rec=await write(worker,rows);
        if(token!==generation||wid()!==worker)return;
        stop();
        var ts=firebase.firestore.Timestamp.fromDate(new Date(rec.savedAt));
        ['createdAt','updatedAt'].forEach(function(field){
          var uq=db.collection('installTemplates').where('ownerWorkerId','==',worker).where(field,'>',ts);
          var u=uq.onSnapshot({includeMetadataChanges:true},function(ds){
            if(token!==generation||wid()!==worker)return;
            rows=merge(rows,ds);apply(rows,worker,'delta-'+field);
            if(ds.metadata.fromCache===false)write(worker,rows).catch(function(e){trace('TEMPLATES_V674_IDB_WRITE_ERROR',{error:String(e&&e.message||e)});});
          },function(e){trace('TEMPLATES_V674_DELTA_ERROR',{workerId:worker,field:field,error:String(e&&e.message||e)});});
          unsubs.push(u);
        });
        trace('TEMPLATES_V674_BACKGROUND_READY',{workerId:worker,docs:rows.length});
      }catch(e){trace('TEMPLATES_V674_BACKGROUND_ERROR',{workerId:worker,error:String(e&&e.message||e)});}
      finally{delete inflight[key];}
    })();
    return inflight[key];
  }
  window.loadTemplates=async function(force){
    var worker=wid();
    if(!worker){generation++;activeWorker='';stop();apply([],worker,'no-worker');return [];}
    if(activeWorker!==worker){generation++;activeWorker=worker;stop();try{templates=[];}catch(e){}window.templates=[];try{renderTemplateSelect();}catch(e){}}
    var token=generation,rows=[];
    try{var rec=await Promise.race([read(worker),new Promise(function(resolve){setTimeout(function(){resolve(null);},900);})]);if(rec&&Array.isArray(rec.rows)){rows=rec.rows;apply(rows,worker,'indexeddb');}}catch(e){trace('TEMPLATES_V674_IDB_READ_ERROR',{workerId:worker,error:String(e&&e.message||e)});}
    // Critical: never await Firestore here. Main startup continues immediately.
    setTimeout(function(){background(worker,token,force===true);},0);
    trace('TEMPLATES_V674_NONBLOCKING_RETURN',{workerId:worker,cachedDocs:visible(rows).length});
    return visible(rows);
  };
  try{loadTemplates=window.loadTemplates;}catch(e){}
  window.addEventListener('beforeunload',stop);
  trace('TEMPLATES_V674_INSTALLED',{mode:'cache-immediate-firestore-background'});

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v674Wrapped){
    var wrapped=function(){var rows=oldRows.apply(this,arguments)||[];if(!rows.some(function(r){return String(r.version||r.id||'')==='6.74-beta';}))rows.unshift({version:'6.74-beta',title:'טעינת תבניות ברקע ללא תקיעת מסך הכניסה',createdAt:'2026-07-31',items:[
      'טעינת תבניות אינה חוסמת עוד את מסך טוען נתונים גם כאשר Firestore איטי או מחזיר תחילה נתונים מהמטמון.',
      'התבניות של העובד מוצגות מיד מ-IndexedDB, והשלמת הנתונים מהענן מתבצעת ברקע.',
      'במעבר עובד מתבטלים מאזינים ותוצאות ישנות, ורק תבניות ownerWorkerId של העובד הפעיל יכולות להצטייר.',
      'נוסף timeout לקריאת המטמון המקומי וטיפול מלא בשגיאות בלי להשאיר Promise לא מטופל.'
    ]});return rows;};wrapped.__v674Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/*
===============================================================================
VERSION 6.75 BETA - SIMPLE WORKER TEMPLATE LISTENER, NO STARTUP BLOCKING
-------------------------------------------------------------------------------
The template subsystem is intentionally reduced to one worker-scoped listener.
No template query, cache read or listener is awaited by the main app startup.
Only active, non-deleted templates owned by the current worker are rendered.
===============================================================================
*/
(function templateStableWorkerListenerV675(){
  'use strict';
  if(window.__wmTemplateStableWorkerListenerV675)return;
  window.__wmTemplateStableWorkerListenerV675=true;

  var unsubscribe=null;
  var activeWorker='';
  var generation=0;
  var startupTimer=null;

  function trace(name,data){try{window.wmTraceV617&&window.wmTraceV617(name,data||{});}catch(e){}}
  function workerId(){
    try{return String((window.viewedWorker&&window.viewedWorker.id)||(window.session&&window.session.workerId)||'');}
    catch(e){return '';}
  }
  function stop(reason){
    generation++;
    if(startupTimer){clearTimeout(startupTimer);startupTimer=null;}
    if(unsubscribe){try{unsubscribe();}catch(e){}unsubscribe=null;}
    trace('TEMPLATES_V675_LISTENER_STOP',{workerId:activeWorker,reason:reason||''});
  }
  function clear(reason){
    try{templates=[];}catch(e){}
    window.templates=[];
    try{typeof renderTemplateSelect==='function'&&renderTemplateSelect();}catch(e){}
    try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
    trace('TEMPLATES_V675_CLEAR',{reason:reason||''});
  }
  function normalize(snapshot,requestedWorker){
    var rows=[];
    try{
      snapshot.forEach(function(doc){
        var row=Object.assign({id:doc.id},doc.data()||{});
        if(String(row.ownerWorkerId||'')!==requestedWorker)return;
        if(row.isDeleted===true||row.active===false)return;
        rows.push(row);
      });
    }catch(e){trace('TEMPLATES_V675_NORMALIZE_ERROR',{error:String(e&&e.message||e)});}
    rows.sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'he');});
    return rows;
  }
  function render(rows,requestedWorker,source){
    if(workerId()!==requestedWorker)return;
    try{templates=rows;}catch(e){}
    window.templates=rows;
    try{typeof renderTemplateSelect==='function'&&renderTemplateSelect();}catch(e){}
    try{window.refreshWorkerTemplateManagerV661&&window.refreshWorkerTemplateManagerV661(false);}catch(e){}
    trace('TEMPLATES_V675_RENDER',{workerId:requestedWorker,visibleDocs:rows.length,source:source||''});
  }
  function attach(requestedWorker,token){
    if(!requestedWorker||token!==generation||workerId()!==requestedWorker)return;
    if(!window.db){trace('TEMPLATES_V675_SKIP_NO_DB',{workerId:requestedWorker});return;}
    try{
      var query=db.collection('installTemplates').where('ownerWorkerId','==',requestedWorker);
      unsubscribe=query.onSnapshot({includeMetadataChanges:true},function(snapshot){
        if(token!==generation||workerId()!==requestedWorker)return;
        var rows=normalize(snapshot,requestedWorker);
        render(rows,requestedWorker,snapshot.metadata&&snapshot.metadata.fromCache?'firestore-cache':'firestore-server');
      },function(error){
        trace('TEMPLATES_V675_LISTENER_ERROR',{workerId:requestedWorker,error:String(error&&error.message||error)});
      });
      trace('TEMPLATES_V675_LISTENER_ATTACH',{workerId:requestedWorker});
    }catch(error){trace('TEMPLATES_V675_ATTACH_ERROR',{workerId:requestedWorker,error:String(error&&error.message||error)});}
  }

  window.loadTemplates=function(){
    var requestedWorker=workerId();
    if(!requestedWorker){stop('no-worker');activeWorker='';clear('no-worker');return Promise.resolve([]);}
    if(activeWorker!==requestedWorker){
      stop('worker-switch');
      activeWorker=requestedWorker;
      clear('worker-switch');
    }
    var token=generation;
    if(!unsubscribe&&!startupTimer){
      startupTimer=setTimeout(function(){startupTimer=null;attach(requestedWorker,token);},0);
    }
    trace('TEMPLATES_V675_NONBLOCKING_RETURN',{workerId:requestedWorker,currentVisible:(window.templates||[]).length||0});
    return Promise.resolve(Array.isArray(window.templates)?window.templates:[]);
  };
  try{loadTemplates=window.loadTemplates;}catch(e){}

  // Stop the old worker listener immediately on logout. The next login creates
  // one fresh listener for the new worker and clears the previous worker UI.
  document.addEventListener('click',function(event){
    var target=event&&event.target&&event.target.closest?event.target.closest('#logoutBtn,[data-action="logout"]'):null;
    if(!target)return;
    stop('logout');activeWorker='';clear('logout');
  },true);
  window.addEventListener('beforeunload',function(){stop('beforeunload');});

  var oldRows=window.requiredChangelogRows;
  if(typeof oldRows==='function'&&!oldRows.__v675Wrapped){
    var wrapped=function(){
      var rows=oldRows.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.75-beta';}))rows.unshift({
        version:'6.75-beta',
        title:'ייצוב סופי של תבניות לפי עובד',
        createdAt:'2026-07-31',
        items:[
          'הוסר מסלול הטעינה הכפול של התבניות שהשאיר את מסך טוען נתונים פתוח.',
          'התבניות מנוהלות באמצעות מאזין יחיד המסונן לפי ownerWorkerId של העובד הפעיל.',
          'רק תבניות פעילות שלא נמחקו מוצגות; מסמכים ישנים או מחוקים אינם נספרים כתבניות פעילות.',
          'במעבר עובד או יציאה הרשימה מתנקה והמאזין הקודם מנותק לפני חיבור העובד החדש.',
          'טעינת התבניות אינה נחסמת ואינה יכולה לעכב את עליית מסך העובד.'
        ]
      });
      return rows;
    };
    wrapped.__v675Wrapped=true;
    window.requiredChangelogRows=wrapped;
    try{requiredChangelogRows=wrapped;}catch(e){}
  }
  trace('TEMPLATES_V675_INSTALLED',{mode:'single-worker-listener-nonblocking'});
})();


/* VERSION 6.76 BETA - TEMPLATE EDITOR PRICE-LIST FILTER PARITY */
(function registerChangelogV676(){
  var previous=window.requiredChangelogRows;
  if(typeof previous==='function'&&!previous.__v676TemplatePriceFilter){
    var wrapped=function(){
      var rows=previous.apply(this,arguments)||[];
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.76-beta';}))rows.unshift({
        version:'6.76-beta',title:'סינון מחירון זהה גם בעריכת תבנית',createdAt:'2026-07-31',items:[
          'חלון עריכת תבנית מציג רק פריטי מחירון פעילים שאינם מחוקים.',
          'הפריטים מסוננים לפי סוג התבנית: מחירון סיב או מחירון RF.',
          'כפילויות מאוחדות לפי שם, מחיר, סוג קלט וסוג מחירון — בדיוק כמו בטופס ההתקנה.',
          'פריט ישן שכבר נבחר בתבנית נשמר פעם אחת גם אם אינו קיים עוד במחירון הפעיל.'
        ]
      });return rows;
    };
    wrapped.__v676TemplatePriceFilter=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();


/* v6.77-beta: visual-only polish for the personal template list and editor. */
(function addChangelogV677(){
  var oldRows=window.requiredChangelogRows||(typeof requiredChangelogRows==='function'?requiredChangelogRows:null);
  if(typeof oldRows==='function'&&!oldRows.__v677Wrapped){
    var wrapped=function(){
      var rows=[];try{rows=oldRows.apply(this,arguments)||[];}catch(e){}
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.82-beta';}))rows.unshift({
        version:'6.82-beta',title:'דשבורד חכם: מסנן ביצוע פעיל ומתוקן',createdAt:'2026-08-02',items:[
          'תוקנה ישירות פונקציית renderSmartDashboard הפעילה והמסנן done436 שבתוכה, ללא עטיפה חדשה.',
          'כל שדות הסטטוס נבדקים בנפרד, וכל סימן למתוזמן, לא בוצע, ממתין, מבוטל או מחוק מוציא את הרשומה מכל ספירות הביצוע.',
          'רשומה עם סטטוס מפורש נספרת רק כאשר קיים בה סטטוס ביצוע מפורש; רשומות היסטוריות ללא סטטוס נשארות תואמות לאחור.',
          'אותו מסנן מופעל שוב ישירות על מערך ההתקנות לפני חישוב התקנות שבוצעו, סיב, RF, CN/CH ו-Change.'
        ]});
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.81-beta';}))rows.unshift({
        version:'6.81-beta',title:'דשבורד חכם: מניעת ספירה של עותק ישן ממטמון הדלתא',createdAt:'2026-08-02',items:[
          'אותרה פונקציית הדשבורד הפעילה בפועל ב-functions2b והחישוב תוקן בתוכה, לפני יצירת מערכי ההתקנות.',
          'לפני הספירה מאוחדות כפילויות של אותו מסמך לפי מזהה הרשומה, כדי שגרסה ישנה מהמטמון לא תיספר לצד גרסת לא בוצע המעודכנת.',
          'כאשר קיימות שתי גרסאות של אותה רשומה, סטטוס לא בוצע, מתוזמן, מבוטל או מחוק גובר תמיד על סטטוס ישן של בוצע.',
          'אותו מקור נתונים נקי משמש את התקנות שבוצעו, התקנות סיב, RF, CN/CH ופקודות Change.'
        ]
      });
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.80-beta';}))rows.unshift({
        version:'6.80-beta',title:'דשבורד חכם: רק התקנות שבוצעו בפועל',createdAt:'2026-08-02',items:[
          'פונקציית הסינון הקיימת done436 עודכנה ישירות, ללא עטיפה וללא פונקציית דשבורד חלופית.',
          'כל רשומה מתוזמנת, ממתינה, לא בוצעה, מבוטלת או מחוקה יוצאת מכל מדדי ההתקנות גם כאשר נשארו בה שדות סטטוס ישנים או סותרים.',
          'אותו סינון משמש את סך ההתקנות שבוצעו, התקנות סיב, התקנות RF, ספירות CN/CH ופקודות Change.',
          'נוספה הגנה גם לפי שדות planned/isPlanned/scheduled וסימוני notDoneAt/notDoneReason כדי למנוע ספירה שגויה של רשומות ישנות.'
        ]
      });
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.79-beta';}))rows.unshift({
        version:'6.79-beta',title:'דשבורד חכם: התקנות שבוצעו וסיווג Change מדויק',createdAt:'2026-08-02',items:[
          'פונקציות הסינון והסיווג הקיימות של הדשבורד החכם עודכנו ישירות, ללא עטיפה וללא יצירת פונקציות חלופיות.',
          'הכרטיס התקנות שבוצעו וכל ספירות סיב, RF, CN, CH ו-Change מתעלמים מכל מתוזמנת, לא בוצעה, מבוטלת או מחוקה — גם ברשומות ישנות שבהן שדות הסטטוס סותרים.',
          'סיווג התקנת סיב מזהה גם את הפריט התקנת מודם וגם וריאציות תקינות של התקנת שקע סיב חדש כולל מודם, כדי שלא יוצגו פקודות Change שגויות.'
        ]
      });
      if(!rows.some(function(r){return String(r.version||r.id||'')==='6.77-beta';}))rows.unshift({
        version:'6.77-beta',title:'עיצוב מקצועי לרשימת התבניות ולעורך התבנית',createdAt:'2026-08-01',items:[
          'רשימת התבניות קיבלה כרטיסים נקיים, ריווח מאוזן, היררכיית טקסט ברורה וכפתורי פעולה קומפקטיים.',
          'אזור עריכת התבנית עוצב מחדש עם שורות פריטים מסודרות, שדות כמות קומפקטיים וקריאים ותצוגת מחיר ברורה.',
          'השינוי עיצובי בלבד ואינו משנה את הסינון, השמירה, המחיקה, הבעלות או מנגנון הסנכרון של התבניות.'
        ]
      });
      return rows;
    };
    wrapped.__v677Wrapped=true;window.requiredChangelogRows=wrapped;try{requiredChangelogRows=wrapped;}catch(e){}
  }
})();
