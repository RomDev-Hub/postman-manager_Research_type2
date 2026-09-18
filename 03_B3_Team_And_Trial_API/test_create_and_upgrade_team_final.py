from create_and_upgrade_team import create_and_upgrade_team
import sys
import time

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
prefix = "vinfast"

links = []
for i in range(1, 4):
    team_name = f"{prefix}-{i:03d}"
    print(f"Creating team: {team_name}...")
    try:
        # Check what the function returns! It returns a dict now!
        res = create_and_upgrade_team(profile_path, team_name)
        if res:
            invite_url = res.get("invite_link")
            if invite_url:
                links.append(f"{team_name}: {invite_url}")
                print(f"Success! Invite URL: {invite_url}")
            else:
                print(f"Failed to get invite URL for {team_name}")
        else:
            print(f"Failed to create {team_name}")
    except Exception as e:
        print(f"Error creating {team_name}: {e}")
    
    if i < 3:
        time.sleep(5)

print("\n--- Final Links ---")
for link in links:
    print(link)
