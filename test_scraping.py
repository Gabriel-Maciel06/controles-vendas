import urllib.request
import ssl
import re

code = "BN094009743BR"
url = f"https://www.linketrack.com.br/rastreio/{code}"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
}

print(f"Tentando scraping em {url}...")
try:
    context = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context) as response:
        html = response.read().decode('utf-8')
        print(f"Sucesso! Tamanho do HTML: {len(html)}")
        # Tenta achar o status via regex simples
        # <p class="status">Entregue</p> ou algo assim
        # No LinkeTrack atual costuma vir em um script ou tags específicas
        print("HTML (primeiros 500 chars):", html[:500])
        
        # Procura por padrões comuns no LinkeTrack
        if "Entregue" in html: print("Encontrou 'Entregue' no HTML!")
        if "Postado" in html: print("Encontrou 'Postado' no HTML!")
        
except Exception as e:
    print(f"Falha: {e}")
