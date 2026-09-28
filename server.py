# MS Construction Management System - Shared Server v5.5.0
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote
import json, threading, os, socket, subprocess, time, shutil, uuid, re

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'shared_data'
DATA_FILE = DATA_DIR / 'storage.json'
SEED_FILE = ROOT / 'initial_data' / 'storage.json'
# Related documents are intentionally separated from storage.json.
# If the environment changes later (NAS / another server), change this base folder first.
DOCUMENTS_DIR = DATA_DIR / 'documents'
DOCUMENTS_INDEX = DOCUMENTS_DIR / 'index.json'
MAX_PDF_SIZE = 100 * 1024 * 1024
LOCK = threading.RLock()
HOST='0.0.0.0'; PORT=8766

def valid_store(path):
    try:
        if not path.exists() or path.stat().st_size < 100: return False
        d=json.loads(path.read_text(encoding='utf-8'))
        return isinstance(d,dict) and 'mscm:v1:projects' in d
    except Exception: return False

def ensure_data():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    if not DOCUMENTS_INDEX.exists(): DOCUMENTS_INDEX.write_text('[]',encoding='utf-8')
    if valid_store(DATA_FILE): return 'existing'
    if DATA_FILE.exists() and DATA_FILE.stat().st_size:
        bak=DATA_DIR/'storage_invalid_backup.json'; shutil.copy2(DATA_FILE,bak)
    if not valid_store(SEED_FILE): raise RuntimeError('Initial storage.json is missing or invalid.')
    shutil.copy2(SEED_FILE,DATA_FILE)
    return 'initialized'

def load_store():
    with LOCK:
        return json.loads(DATA_FILE.read_text(encoding='utf-8')) if valid_store(DATA_FILE) else {}

def save_store(d):
    with LOCK:
        tmp=DATA_FILE.with_suffix('.tmp')
        tmp.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
        os.replace(tmp,DATA_FILE)

def load_documents():
    try:
        x=json.loads(DOCUMENTS_INDEX.read_text(encoding='utf-8'))
        return x if isinstance(x,list) else []
    except Exception: return []

def save_documents(rows):
    tmp=DOCUMENTS_INDEX.with_suffix('.tmp')
    tmp.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    os.replace(tmp,DOCUMENTS_INDEX)

def safe_piece(v, fallback='file'):
    v=re.sub(r'[\\/:*?"<>|\x00-\x1f]+','_',str(v or '')).strip(' .')
    return v[:120] or fallback

def local_ips():
    out=[]
    try:
        for info in socket.getaddrinfo(socket.gethostname(),None,socket.AF_INET):
            ip=info[4][0]
            if not ip.startswith('127.') and ip not in out: out.append(ip)
    except Exception: pass
    return out

def open_chrome(url):
    env=os.environ
    candidates=[Path(env.get('PROGRAMFILES','C:/Program Files'))/'Google/Chrome/Application/chrome.exe',Path(env.get('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Google/Chrome/Application/chrome.exe',Path(env.get('LOCALAPPDATA',''))/'Google/Chrome/Application/chrome.exe']
    for exe in candidates:
        if exe.exists():
            try: subprocess.Popen([str(exe),'--new-window',url]); return True
            except Exception: pass
    try: os.startfile(url); return True
    except Exception: return False

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def log_message(self,fmt,*args): print('[MS]',fmt%args)
    def end_headers(self):
        self.send_header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0'); self.send_header('Pragma','no-cache'); self.send_header('Expires','0'); super().end_headers()
    def send_json(self,obj,status=200):
        b=json.dumps(obj,ensure_ascii=False).encode('utf-8'); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(b))); super().end_headers(); self.wfile.write(b)
    def do_GET(self):
        u=urlparse(self.path); path=u.path; q=parse_qs(u.query)
        if path=='/api/ping': return self.send_json({'ok':True,'dataFile':str(DATA_FILE),'documentsDir':str(DOCUMENTS_DIR)})
        if path=='/api/storage/all': return self.send_json({'data':load_store()})
        if path=='/api/documents/list':
            project_id=(q.get('projectId') or [''])[0]
            with LOCK: rows=[r for r in load_documents() if r.get('projectId')==project_id]
            rows.sort(key=lambda r:r.get('registeredAt',''), reverse=True)
            return self.send_json({'documents':rows})
        return super().do_GET()
    def do_POST(self):
        u=urlparse(self.path); path=u.path
        try:
            if path=='/api/documents/upload':
                n=int(self.headers.get('Content-Length','0'))
                if n<=0 or n>MAX_PDF_SIZE: return self.send_json({'error':'PDF size is invalid or too large.'},400)
                project_id=self.headers.get('X-Project-Id','').strip(); original=self.headers.get('X-File-Name','').strip(); category=self.headers.get('X-Category','その他').strip() or 'その他'; title=self.headers.get('X-Title','').strip()
                from urllib.parse import unquote
                original=unquote(original); category=unquote(category); title=unquote(title)
                if not project_id: return self.send_json({'error':'projectId required'},400)
                if not original.lower().endswith('.pdf'): return self.send_json({'error':'PDF files only.'},400)
                data=self.rfile.read(n)
                if not data.startswith(b'%PDF-'): return self.send_json({'error':'The selected file is not a valid PDF.'},400)
                doc_id=uuid.uuid4().hex; project_folder=DOCUMENTS_DIR/safe_piece(project_id,'project'); project_folder.mkdir(parents=True,exist_ok=True)
                stored=doc_id+'_'+safe_piece(Path(original).stem,'document')+'.pdf'; dest=project_folder/stored; dest.write_bytes(data)
                rec={'id':doc_id,'projectId':project_id,'fileName':original,'title':title or Path(original).stem,'category':category,'size':len(data),'registeredAt':time.strftime('%Y-%m-%dT%H:%M:%S'),'url':'/shared_data/documents/'+quote(safe_piece(project_id,'project'))+'/'+quote(stored)}
                with LOCK:
                    rows=load_documents(); rows.append(rec); save_documents(rows)
                return self.send_json({'ok':True,'document':rec})
            if path=='/api/documents/delete':
                n=int(self.headers.get('Content-Length','0')); body=json.loads(self.rfile.read(n) or b'{}'); doc_id=str(body.get('id',''))
                with LOCK:
                    rows=load_documents(); rec=next((r for r in rows if r.get('id')==doc_id),None)
                    if not rec: return self.send_json({'error':'document not found'},404)
                    try:
                        rel=rec.get('url','').split('/shared_data/documents/',1)[1]
                        from urllib.parse import unquote
                        p=DOCUMENTS_DIR/unquote(rel)
                        if p.resolve().is_relative_to(DOCUMENTS_DIR.resolve()) and p.exists(): p.unlink()
                    except Exception: pass
                    rows=[r for r in rows if r.get('id')!=doc_id]; save_documents(rows)
                return self.send_json({'ok':True})
            if not path.startswith('/api/storage/'): return self.send_json({'error':'not found'},404)
            n=int(self.headers.get('Content-Length','0')); body=json.loads(self.rfile.read(n) or b'{}'); key=str(body.get('key',''))
            if not key: return self.send_json({'error':'key required'},400)
            with LOCK:
                d=load_store()
                if path.endswith('/get'): return self.send_json({'value':d.get(key)})
                if path.endswith('/set'): d[key]=body.get('value'); save_store(d); return self.send_json({'ok':True})
                if path.endswith('/remove'): d.pop(key,None); save_store(d); return self.send_json({'ok':True})
            return self.send_json({'error':'not found'},404)
        except Exception as e: return self.send_json({'error':str(e)},500)

if __name__=='__main__':
    print('='*70); print(' MS Construction Management - v5.5.0 DOCUMENTS'); print(' PROGRAM :',ROOT); print(' DATA    :',DATA_FILE); print(' PDF     :',DOCUMENTS_DIR)
    try: state=ensure_data(); print(' DATA STATUS:', 'initialized from baseline' if state=='initialized' else 'existing shared data')
    except Exception as e: print('DATA ERROR:',e); input('Press Enter to close...'); raise SystemExit(1)
    print(' This PC : http://localhost:%d/index.html'%PORT)
    for ip in local_ips(): print(' Other PC: http://%s:%d/index.html'%(ip,PORT))
    print('='*70)
    try: srv=ThreadingHTTPServer((HOST,PORT),Handler)
    except OSError as e: print('SERVER START ERROR:',e); print('Close the previous server window using port 8766.'); input('Press Enter to close...'); raise SystemExit(2)
    threading.Thread(target=lambda:(time.sleep(1),open_chrome('http://localhost:%d/index.html'%PORT)),daemon=True).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
