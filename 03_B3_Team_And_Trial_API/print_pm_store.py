import urllib.parse
from create_and_upgrade_team import extract_profile_cookies

cookies = extract_profile_cookies("/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc")
print("_pm.store:", urllib.parse.unquote(cookies.get("_pm.store", "")))
