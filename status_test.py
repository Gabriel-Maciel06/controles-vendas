import requests
import json

codes = ["BN094009743BR", "BN094010619BR", "BN094010605BR", "BN446900275BR"]

for code in codes:
    url = f"https://brasilaberto.com/api/v1/trackobject/{code}"
    print(f"Testando {code} em {url}...")
    try:
        resp = requests.get(url, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(f"Erro: {resp.text}")
    except Exception as e:
        print(f"Falha: {e}")
    print("-" * 30)
