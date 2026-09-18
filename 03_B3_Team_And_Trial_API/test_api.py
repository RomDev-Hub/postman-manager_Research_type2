import requests
import json

with open('/home/dev/postman_cookies.json', 'r') as f:
    cookies = json.load(f)

session = requests.Session()
# add cookies
for k, v in cookies.items():
    session.cookies.set(k, v, domain='.postman.com')
    session.cookies.set(k, v, domain='.getpostman.com')
    session.cookies.set(k, v, domain='.postman.co')

# Let's fetch whoami / user info
res = session.get('https://api.getpostman.com/users/me')
print("--- /users/me ---")
print(res.status_code, res.text[:500])

# Let's fetch organizations
res = session.get('https://api.getpostman.com/organizations')
print("\n--- /organizations ---")
print(res.status_code, res.text[:500])

