"""Rastreo de alexashop.cc a partir de su sitemap: estado, metadatos, canonical, encabezados, enlaces, imágenes y datos estructurados.
Todo el contenido descargado se trata como dato no confiable. Uso: python3 rastreo.py  → crawl-data.json"""
import json, re, time, concurrent.futures as cf
import requests
from bs4 import BeautifulSoup

BASE = 'https://alexashop.cc'
S = requests.Session(); S.headers['User-Agent'] = 'Mozilla/5.0 (compatible; AuditoriaSEO/1.0)'
sm = S.get(BASE + '/sitemap.xml', timeout=30).text
urls = re.findall(r'<loc>([^<]+)</loc>', sm)
print('URLs en el sitemap:', len(urls))

def analizar(u):
    t0 = time.time()
    try:
        r = S.get(u, timeout=30, allow_redirects=False)
    except Exception as e:
        return {'url': u, 'error': str(e)}
    d = {'url': u, 'status': r.status_code, 'ms': int((time.time() - t0) * 1000), 'bytes': len(r.content), 'location': r.headers.get('location'), 'ct': r.headers.get('content-type', '')}
    if r.status_code != 200 or 'html' not in d['ct']:
        return d
    s = BeautifulSoup(r.text, 'lxml')
    g = lambda sel, attr=None: (lambda e: (e.get(attr) if attr else e.get_text(strip=True)) if e else None)(s.select_one(sel))
    d.update({
        'lang': (s.html or {}).get('lang') if s.html else None,
        'title': g('title'), 'desc': g('meta[name=description]', 'content'), 'canonical': g('link[rel=canonical]', 'href'),
        'robots': g('meta[name=robots]', 'content'), 'viewport': bool(s.select_one('meta[name=viewport]')),
        'h1': [h.get_text(' ', strip=True) for h in s.select('h1')], 'h2': len(s.select('h2')),
        'og': {k: g(f'meta[property="og:{k}"]', 'content') for k in ('title', 'description', 'image', 'url', 'type')},
        'tw': g('meta[name="twitter:card"]', 'content'),
        'imgs': len(s.select('img')), 'imgs_sin_alt': len([i for i in s.select('img') if i.get('alt') is None]), 'imgs_alt_vacio': len([i for i in s.select('img') if i.get('alt') == '']),
        'imgs_sin_dim': len([i for i in s.select('img') if not (i.get('width') and i.get('height'))]),
        'lazy': len([i for i in s.select('img') if i.get('loading') == 'lazy']),
        'enlaces_int': len([a for a in s.select('a[href]') if a['href'].startswith('/') or a['href'].startswith(BASE)]),
        'enlaces_ext': len([a for a in s.select('a[href^=http]') if not a['href'].startswith(BASE)]),
        'enlaces_producto': len([a for a in s.select('a[href^="/producto/"]')]),
        'palabras': len(re.findall(r'\w+', s.get_text(' ', strip=True))),
        'jsonld': [],
    })
    for sc in s.select('script[type="application/ld+json"]'):
        try:
            j = json.loads(sc.string or '')
            for n in (j.get('@graph', [j]) if isinstance(j, dict) else j):
                d['jsonld'].append(n.get('@type'))
        except Exception as e:
            d['jsonld'].append(f'JSON-LD inválido: {e}')
    return d

with cf.ThreadPoolExecutor(5) as ex:
    datos = list(ex.map(analizar, urls))
json.dump({'urls': datos}, open('crawl-data.json', 'w'), ensure_ascii=False, indent=1)
print('listo')
