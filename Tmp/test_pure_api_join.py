import requests
import json
import urllib.parse
from pprint import pprint

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

invite_url = "https://app.getpostman.com/join-team?invite_code=511c52d43e5c70bf1c9a41639f75ec4f&target=team"
# from B3: https://app.getpostman.com/join-team?invite_code=2323cc3830a66fbc66bc502f90a98212&target=team
invite_code = "2323cc3830a66fbc66bc502f90a98212"

print("Step 1: Get authFlowId")
url1 = f"https://identity.getpostman.com/join-team?cta=join-team&invite_code={invite_code}&is_signup=0"
# Don't allow redirects to see where it goes
res1 = session.get(url1, allow_redirects=False)
print("Status:", res1.status_code)
print("Headers:", res1.headers)

location = res1.headers.get("Location", "")
print("Location:", location)

authFlowId = ""
if "authFlowId=" in location:
    parsed = urllib.parse.urlparse(location)
    qs = urllib.parse.parse_qs(parsed.query)
    if "authFlowId" in qs:
        authFlowId = qs["authFlowId"][0]
elif res1.status_code == 200:
    # maybe it returns html with authFlowId?
    print("Extracting from HTML...")

print("Auth Flow ID:", authFlowId)
