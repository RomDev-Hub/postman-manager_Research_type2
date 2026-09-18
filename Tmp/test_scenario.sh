#!/bin/bash

EMAIL="hunggreen0001@maildrop.cc"
BROWSER_ARG=""

if [ "$1" == "--edge" ]; then
    BROWSER_ARG="--edge"
    echo "Using Microsoft Edge browser."
else
    echo "Using Google Chrome browser. (Pass --edge to use Edge)"
fi

echo "==========================================="
echo "POSTMAN TEAM AUTOMATION TEST SCENARIO"
echo "==========================================="
echo "NOTE: Please ensure you have logged into $EMAIL before running this."
echo "If prompted, please allow the browser to auto-fill your credentials."
echo ""

echo "[1/4] Creating Team 1: VinFast 001 (vinfast-001)"
node /home/dev/_Tool_postman_Sep17/03_B3_Team_And_Trial_API/b3_create_team.mjs $EMAIL "VinFast 001" vinfast-001 --headful $BROWSER_ARG

echo "[2/4] Creating Team 2: VinFast 002 (vinfast-002)"
node /home/dev/_Tool_postman_Sep17/03_B3_Team_And_Trial_API/b3_create_team.mjs $EMAIL "VinFast 002" vinfast-002 --headful $BROWSER_ARG

echo "[3/4] Deleting Team 1 (Empty Team)"
node /home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/b5_delete_team.mjs $EMAIL vinfast-001 --headful $BROWSER_ARG

echo "[4/4] Cleaning up all other 'Trash' Teams where $EMAIL is admin"
node /home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/b5_clean_trash_teams.mjs $EMAIL --headful $BROWSER_ARG

echo "==========================================="
echo "TEST SCENARIO COMPLETE."
echo "Invite links for the created teams have been saved to invite_links.txt"
echo "You can use B4 to join other accounts to VinFast 002 using the link."
