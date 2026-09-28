/* MS建設管理システム GitHub Pages + 共有データサーバー Ver.2.1
   方針:
   - アプリ本体はGitHub Pages
   - 業務データは会社ごとの共有データサーバー
   - 接続先は各PCのブラウザに保存し、HTMLへIPアドレスを埋め込まない
   - 将来、親PCから専用サーバーへ移行しても接続先変更だけで対応する
*/
(function(global){
  'use strict';

  const SETTING_KEY='mscm:networkApi';
  const CURRENT_TEST_DEFAULT='http://192.168.1.5:8766'; // 現在の試験環境だけの初期値
  let cache=null;

  function normalize(v){
    return String(v||'').trim().replace(/\/+$/,'');
  }

  function savedApiBase(){
    try { return normalize(localStorage.getItem(SETTING_KEY)); }
    catch(e){ return ''; }
  }

  function apiBase(){
    return savedApiBase() || CURRENT_TEST_DEFAULT;
  }

  function apiUrl(path){
    return apiBase()+path;
  }

  function connectionHelp(){
    return '共有データサーバーの電源・データサーバー起動状態・接続先アドレスを確認してください。';
  }

  function request(method,path,body){
    const base=apiBase();
    if(!base) throw new Error('共有データサーバーが未設定です。管理・設定から接続先を設定してください。');

    const x=new XMLHttpRequest();
    x.open(method,base+path,false);
    if(body!==undefined) x.setRequestHeader('Content-Type','application/json;charset=UTF-8');
    try{
      x.send(body===undefined?null:JSON.stringify(body));
    }catch(e){
      throw new Error('共有データサーバーに接続できません。'+connectionHelp());
    }
    if(x.status<200||x.status>=300){
      throw new Error('共有データ通信エラー ('+x.status+')');
    }
    return x.responseText ? JSON.parse(x.responseText) : null;
  }

  function loadAll(){
    if(cache!==null) return cache;
    const r=request('GET','/api/storage/all');
    cache=(r&&r.data&&typeof r.data==='object') ? r.data : {};
    return cache;
  }

  global.MSShared={
    getItem(key){
      const d=loadAll();
      return Object.prototype.hasOwnProperty.call(d,key) ? d[key] : null;
    },
    setItem(key,value){
      const v=String(value);
      request('POST','/api/storage/set',{key,value:v});
      if(cache===null) cache={};
      cache[key]=v;
    },
    removeItem(key){
      request('POST','/api/storage/remove',{key});
      if(cache!==null) delete cache[key];
    },
    refresh(){
      cache=null;
      return loadAll();
    },
    ping(){
      return request('GET','/api/ping');
    },
    apiBase,
    apiUrl,
    hasSavedApiBase(){
      return !!savedApiBase();
    },
    setApiBase(v){
      const n=normalize(v);
      if(!/^https?:\/\/[^/]+/i.test(n)){
        throw new Error('http:// または https:// から始まるサーバーアドレスを入力してください。');
      }
      localStorage.setItem(SETTING_KEY,n);
      cache=null;
      return n;
    },
    clearApiBase(){
      localStorage.removeItem(SETTING_KEY);
      cache=null;
    },
    currentTestDefault:CURRENT_TEST_DEFAULT,
    connectionHelp
  };
})(window);
