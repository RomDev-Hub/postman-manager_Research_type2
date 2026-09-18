from create_and_upgrade_team import extract_profile_cookies
import sys

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
print(f"Total cookies in 0002: {len(cookies)}")
if "postman.sid" in cookies:
    print("postman.sid exists!")
else:
    print("postman.sid NOT FOUND. Not logged in.")
