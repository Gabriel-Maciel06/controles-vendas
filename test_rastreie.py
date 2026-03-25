import urllib.request
import json
import ssl

code = "BN094009743BR"
url = f"https://api.rastreie.com/v2/rastreio?codigo={code}"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
}

print(f"Testando {code} na Rastreie.com...")
try:
    context = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context) as response:
        body = response.read().decode('utf-8')
        print(f"Status: {response.getcode()}")
        print(f"Corpo (primeiros 500 chars): {body[:500]}")
        try:
            data = json.loads(body)
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except:
            print("Não é um JSON válido.")
except Exception as e:
    print(f"Falha: {e}")
