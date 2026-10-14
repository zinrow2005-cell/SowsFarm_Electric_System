/** 虎尾母豬場 V6.9.60：公開唯讀與管理者授權分離。 */
const PROPS=PropertiesService.getScriptProperties();
const PROJECT='huwei-pigfarm-main';
const SHEETS={PROJECTS:'Projects',PHOTOS:'Photos',ACTIVITY:'Activity',SETTINGS:'Settings'};
function setupCloud(){
 const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('請從 Google Sheet 開啟 Apps Script');
 PROPS.setProperty('SPREADSHEET_ID',ss.getId());
 let root;try{root=DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID')||'')}catch(e){}
 if(!root){root=DriveApp.createFolder('虎尾場_CAD_雲端同步');PROPS.setProperty('ROOT_FOLDER_ID',root.getId())}
 let photos;try{photos=DriveApp.getFolderById(PROPS.getProperty('PHOTO_FOLDER_ID')||'')}catch(e){}
 if(!photos){photos=root.createFolder('現場照片');PROPS.setProperty('PHOTO_FOLDER_ID',photos.getId())}
 ensure_();return {ok:true,spreadsheetUrl:ss.getUrl(),photosFolder:photos.getUrl()};
}
/** 先在 Apps Script 專案設定 > 指令碼屬性填 ADMIN_USER、ADMIN_PASSWORD；執行一次後刪除明文密碼。 */
function initializeAdmin(){
 const user=PROPS.getProperty('ADMIN_USER')||'dad';
 const pw=PROPS.getProperty('ADMIN_PASSWORD');
 if(!pw||pw.length<12)throw Error('ADMIN_PASSWORD 至少 12 個字元；不要使用 1234');
 const salt=Utilities.getUuid()+Utilities.getUuid();
 PROPS.setProperties({ADMIN_USER:user,ADMIN_SALT:salt,ADMIN_HASH:hash_(salt+pw)});
 PROPS.deleteProperty('ADMIN_PASSWORD');
 PROPS.deleteProperty('PROJECT_TOKEN'); // 伺服器不再接受舊的共用 Token
 // 舊 Settings 表格可能公開洩漏 Token，清除可見的值
 try{const sh=ss_().getSheetByName(SHEETS.SETTINGS);if(sh){const a=sh.getDataRange().getValues();for(let i=1;i<a.length;i++){if(String(a[i][0]).includes('TOKEN'))sh.getRange(i+1,2).clearContent()}}}catch(e){}
 return '管理者已建立。請重新部署並停用舊部署的公開寫入入口。';
}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('')}
function constantEqual_(a,b){a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0}
function adminLogin_(b){
 const user=PROPS.getProperty('ADMIN_USER'),salt=PROPS.getProperty('ADMIN_SALT'),expected=PROPS.getProperty('ADMIN_HASH');
 if(!user||!expected)throw Error('管理者尚未初始化');
 if(String(b.username||'')!==user||!constantEqual_(hash_(salt+String(b.password||'')),expected))throw Error('帳號或密碼錯誤');
 const session=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
 CacheService.getScriptCache().put('session_'+hash_(session),user,21600);return{ok:true,session,expiresIn:21600};
}
function admin_(b){const value=CacheService.getScriptCache().get('session_'+hash_(String(b.session||'')));if(!value||value!==PROPS.getProperty('ADMIN_USER'))throw Error('管理者登入已過期，請重新登入')}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return out_({ok:true,service:'虎尾場CAD V6.9.60',mode:'public-readonly',serverTime:new Date().toISOString()})}
function doPost(e){
 try{
  const b=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');const action=String(b.action||'');
  if(action==='publicProject'||action==='publicVersion')return out_(publicRead_(action));
  if(action==='adminLogin')return out_(adminLogin_(b));
  admin_(b);ensure_();
  if(action==='ping')return out_(ping_(b));
  if(action==='saveProject')return out_(saveProject_(b));
  if(action==='getProject')return out_(getProject_(b));
  if(action==='uploadPhoto')return out_(uploadPhoto_(b));
  if(action==='listPhotos')return out_(listPhotos_(b));
  if(action==='logout'){CacheService.getScriptCache().remove('session_'+hash_(String(b.session||'')));return out_({ok:true})}
  throw Error('未知操作');
 }catch(err){return out_({ok:false,error:String(err.message||err)})}
}
function ss_(){return SpreadsheetApp.openById(PROPS.getProperty('SPREADSHEET_ID'))}
function rootFolder_(){return DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID'))}
function photoFolder_(){return DriveApp.getFolderById(PROPS.getProperty('PHOTO_FOLDER_ID'))}
function ensure_(){const ss=ss_();Object.entries({Projects:['projectId','revision','fileId','updatedAt','deviceName','deviceId','bytes'],Photos:['photoId','projectId','objectUid','objectName','building','note','fileId','fileName','mimeType','createdAt','deviceName'],Activity:['timestamp','action','projectId','deviceName','detail'],Settings:['設定','值']}).forEach(([n,headers])=>{let sh=ss.getSheetByName(n);if(!sh)sh=ss.insertSheet(n);if(sh.getLastRow()<1)sh.getRange(1,1,1,headers.length).setValues([headers])})}
function projectRow_(id){const sh=ss_().getSheetByName(SHEETS.PROJECTS),last=sh.getLastRow();if(last<2)return{sh,row:0,v:null};const rows=sh.getRange(2,1,last-1,7).getValues();for(let i=0;i<rows.length;i++)if(String(rows[i][0])===id)return{sh,row:i+2,v:rows[i]};return{sh,row:0,v:null}}
function publicRead_(action){const r=projectRow_(PROJECT);if(!r.v)return{ok:true,revision:0,project:null};const base={ok:true,revision:Number(r.v[1]||0),updatedAt:String(r.v[3]||'')};if(action==='publicVersion')return base;const raw=DriveApp.getFileById(String(r.v[2])).getBlob().getDataAsString('UTF-8');return{...base,project:JSON.parse(raw)}}
function ping_(b){const r=projectRow_(PROJECT);return{ok:true,revision:r.v?Number(r.v[1]||0):0,serverTime:new Date().toISOString()}}
function log_(action,id,name,detail){try{ss_().getSheetByName(SHEETS.ACTIVITY).appendRow([new Date().toISOString(),action,id||'',name||'',detail||''])}catch(e){}}
function saveProject_(b){
 if(b.projectId!==PROJECT||!b.project||!Array.isArray(b.project.elements))throw Error('專案資料不完整');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
 const r=projectRow_(PROJECT),rev=r.v?Number(r.v[1]||0):0,base=Number(b.baseRevision||0);
 if(rev>base&&!b.force)return{ok:false,conflict:true,revision:rev,error:'雲端已有較新版本'};
 const json=JSON.stringify(b.project),bytes=Utilities.newBlob(json,'application/json').getBytes().length;
 if(bytes>18*1024*1024)throw Error('專案過大，請移除內嵌超大照片');
 let f;if(r.v&&r.v[2])try{f=DriveApp.getFileById(String(r.v[2]))}catch(e){}
 if(!f)f=rootFolder_().createFile(PROJECT+'.json',json,MimeType.PLAIN_TEXT);else f.setContent(json);
 const nr=rev+1,ts=new Date().toISOString(),row=[PROJECT,nr,f.getId(),ts,b.deviceName||'',b.deviceId||'',bytes];
 if(r.row)r.sh.getRange(r.row,1,1,row.length).setValues([row]);else r.sh.appendRow(row);
 log_('saveProject',PROJECT,b.deviceName,'revision '+nr);return{ok:true,revision:nr,updatedAt:ts,bytes};
 }finally{lock.releaseLock()}
}
function getProject_(b){return publicRead_('publicProject')}
function uploadPhoto_(b){
 if(b.projectId!==PROJECT)throw Error('專案無效');
 const m=String(b.dataUrl||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('只接受 JPG、PNG 或 WebP 圖片');
 const bytes=Utilities.base64Decode(m[2]);if(bytes.length>8*1024*1024)throw Error('照片超過 8MB');
 const ts=new Date(),mime=m[1],stamp=Utilities.formatDate(ts,'Asia/Taipei','yyyyMMdd_HHmmss'),name=stamp+'_'+String(b.objectName||'現場照片').replace(/[\\/:*?"<>|#%{}~&]/g,'_').slice(0,60)+(mime==='image/png'?'.png':mime==='image/webp'?'.webp':'.jpg');
 const f=photoFolder_().createFile(Utilities.newBlob(bytes,mime,name)),id=Utilities.getUuid(),iso=ts.toISOString();
 ss_().getSheetByName(SHEETS.PHOTOS).appendRow([id,PROJECT,b.objectUid||'',b.objectName||'',b.building||'',b.note||'',f.getId(),name,mime,iso,b.deviceName||'']);
 log_('uploadPhoto',PROJECT,b.deviceName,name);return{ok:true,photoId:id,fileId:f.getId(),fileName:name,driveUrl:f.getUrl(),createdAt:iso};
}
function listPhotos_(b){
 const sh=ss_().getSheetByName(SHEETS.PHOTOS),last=sh.getLastRow(),arr=[];
 if(last>=2){const a=sh.getRange(2,1,last-1,11).getValues();for(let i=a.length-1;i>=0&&arr.length<30;i--){const r=a[i];if(String(r[1])===PROJECT&&String(r[2])===String(b.objectUid))arr.push({photoId:String(r[0]),fileName:String(r[7]||''),note:String(r[5]||''),createdAt:String(r[9]||''),deviceName:String(r[10]||''),driveUrl:'https://drive.google.com/file/d/'+String(r[6])+'/view'})}}
 return{ok:true,photos:arr};
}
