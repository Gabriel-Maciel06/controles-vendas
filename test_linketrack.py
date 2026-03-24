import urllib.request
import json
import ssl

code = "BN094009743BR"
url = f"https://api.linketrack.com/track/json?user=test&token=1abcd&codigo={code}"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
}

print(f"Testando {code} na LinkeTrack...")
try:
    context = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context) as response:
        print(f"Status: {response.getcode()}")
        data = json.loads(response.read().decode('utf-8'))
        print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Falha: {e}")
