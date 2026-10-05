"""下载第一版图书馆的固定依赖和封面；不写入知识库。"""
import concurrent.futures
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets' / 'library'
NOTES = Path(r'E:\增涛的知识库\吼吼吼\我这些年读过的书')

def download(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size:
        return
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    target.write_bytes(data)

dependencies = {
    'vendor/three.module.js': 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js',
    'vendor/GLTFLoader.js': 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js',
    'vendor/BufferGeometryUtils.js': 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js',
    'vendor/LICENSE-three.txt': 'https://cdn.jsdelivr.net/npm/three@0.169.0/LICENSE',
    'astronaut.glb': 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
}
books = []
for note in sorted(NOTES.glob('*.md')):
    content = note.read_text(encoding='utf-8-sig')
    cover = re.search(r'^cover:\s*(https?://\S+)', content, re.M)
    if not cover:
        continue
    book_id = re.search(r'^bookId:\s*[\"\']?(\d+)', content, re.M)
    if not book_id:
        continue
    identity = book_id.group(1)
    if any(book['id'] == identity for book in books):
        continue
    books.append({'id': identity, 'title': note.stem, 'cover': f'assets/library/covers/{identity}.jpg', 'source': cover.group(1)})

jobs = [(url, ASSETS / name) for name, url in dependencies.items()]
jobs += [(book['source'], ROOT / book['cover']) for book in books]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    futures = {pool.submit(download, url, target): target for url, target in jobs}
    failures = []
    for future in concurrent.futures.as_completed(futures):
        try:
            future.result()
        except Exception as error:
            failures.append(str(futures[future].name))
            print('下载失败:', futures[future].name, type(error).__name__)
loader = ASSETS / 'vendor' / 'GLTFLoader.js'
if loader.exists():
    loader.write_text(loader.read_text(encoding='utf-8').replace('../utils/BufferGeometryUtils.js', './BufferGeometryUtils.js'), encoding='utf-8')
available = [book for book in books if (ROOT / book['cover']).exists()]
(ASSETS / 'books.json').write_text(json.dumps(available, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'covers': len(available), 'failures': failures}, ensure_ascii=False))
if failures:
    raise SystemExit(1)
