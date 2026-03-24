import urllib.request
import json
import ssl

code = "BN094009743BR"
url = f"https://proxyapp.correios.com.br/v1/sro-rastro/{code}"
headers = {
    'User-Agent': 'Dart/2.18 (dart:io)'
}

print(f"Testando {code} na API interna Correios (ProxyApp)...")
try:
    context = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context) as response:
        print(f"Status: {response.getcode()}")
        data = json.loads(response.read().decode('utf-8'))
        print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Falha: {e}")
