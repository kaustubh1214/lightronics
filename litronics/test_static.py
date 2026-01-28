
import requests

try:
    response = requests.get("http://localhost:8000/static/purchase.js")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("File content length:", len(response.text))
        print("First 100 chars:", response.text[:100])
except Exception as e:
    print(f"Error: {e}")
