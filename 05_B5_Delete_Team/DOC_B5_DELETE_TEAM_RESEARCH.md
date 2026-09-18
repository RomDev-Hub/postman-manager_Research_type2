# B5: Research on Deleting Teams in Postman (Admin Account)

## Objective
Investigate how an Admin can delete a team in Postman in two scenarios:
1. Newly created team (no members).
2. Expired trial team (with members).

## Findings
Postman has updated its organization and workspace architecture:
- Every Postman account is intrinsically tied to a **Primary Organization** (initially a "Personal" workspace/Solo plan).
- When a user "creates a team" via the UI or the `/api/organizations/add` API with `preserve_personal_context: False`, Postman actually **upgrades their Primary Organization** into a Team space.
- Because this team is the root context for the Admin's account, **Postman does not provide a "Delete Team" or "Leave Team" option for the sole Admin of a primary organization**. 

### Scenario 1: Newly created team (no members)
- **Status:** Cannot be deleted.
- **Reason:** The team is effectively the Admin's personal workspace. There is no "Delete" button in the Team Profile or Billing settings. The API also restricts deleting the primary organization.
- **Solution:** No action needed. It functions as a standard Free/Solo workspace.

### Scenario 2: Expired trial team (with members)
- **Status:** Cannot be deleted directly.
- **Reason:** Once the Enterprise Trial expires, the team automatically downgrades to a "Solo (Trial)" or Free plan with restricted limits.
- **Solution:** 
  - To clean up, the Admin must navigate to **Team Management -> Members** and manually remove all other invited members.
  - Once all members are removed, the team functions just like a Personal workspace again.
  - If the goal is absolute destruction of the team data, the only supported method is to delete the entire Postman Admin account via `Settings -> Account -> Delete Account`.

## API Sniffing Results
- `https://go.postman.co/settings/me/team` (Old URL) returns a 404 Not Found.
- The new settings reside at `https://go.postman.co/settings/team/profile`.
- Puppeteer DOM analysis confirms that the strings "Delete Team" and "Leave Team" do not exist in the DOM for the primary organization owner.
- The dropdown menu only allows "Switch to" between the primary context and any secondary contexts, but no deletion options are exposed for the primary context.
