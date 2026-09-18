import sys
import os
sys.path.append(os.path.abspath("../03_B3_Team_And_Trial_API"))
import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
session = requests.Session()
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")
        session.cookies.set(k, v, domain="app.getpostman.com")

session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

url = "https://app.getpostman.com/"
res = session.get(url)
print(res.text[:1000])
with open("/home/dev/postman_app.html", "w") as f:
    f.write(res.text)
