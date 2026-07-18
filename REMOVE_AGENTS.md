# Remove Agents from Dashboard

## Files to Delete

```powershell
# React components
Remove-Item "D:\dev\trading-dashboard\dashboard\src\pages\Agents.jsx"
Remove-Item "D:\dev\trading-dashboard\dashboard\src\pages\Agents.css"
Remove-Item "D:\dev\trading-dashboard\dashboard\src\components\AgentCard.jsx"
Remove-Item "D:\dev\trading-dashboard\dashboard\src\components\AgentCard.css"
Remove-Item "D:\dev\trading-dashboard\dashboard\src\assets\agents.svg"
```

## Files to Edit

### 1. App.jsx - Remove Agents route
```jsx
// Remove:
import Agents from "./pages/Agents";
<Route path="/agents" element={<Agents />} />
```

### 2. Sidebar.jsx - Remove Agents nav
```jsx
// Remove:
import agentsIcon from "../assets/agents.svg";
{ icon: agentsIcon, label: "Agents", to: "/agents" },
```

### 3. index.js - Remove agent endpoints

The agent code in `dashboard/server/index.js` spans multiple sections:

**Section 1: Lines ~39-236 - Agent metadata**
- Remove all `AGENT_*` constants
- Remove `parseIdentityMd()` function
- Remove `refreshAgentMetadata()` function
- Remove `getAgentModel()` function
- Remove `getAgentPrimaryModel()` function
- Remove `getAgentRole()` function
- Remove `getAgentEmoji()` function

**Section 2: Lines ~344-450 - API endpoints**
- Remove `/api/agents` endpoint
- Remove `/api/agents/health` endpoint
- Remove `/api/agents/refresh` endpoint

**Section 3: Lines ~744-772 - Agent signals**
- Remove agent signals endpoint

**Section 4: Lines ~1570, 1604, 1629, 1649, 1659, 1684**
- Replace `AGENT_WALLET` with direct wallet reference

**Section 5: Line ~2038**
- Change console.log message

## Simpler Approach

Since the file is complex, here's a Node.js script to do it:

```javascript
const fs = require('fs');
const path = require('path');

const filePath = 'D:\\dev\\trading-dashboard\\dashboard\\server\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// Remove agent metadata section (from OPENCLAW_AGENTS_DIR to end of getAgentEmoji)
content = content.replace(
  /\/\/ â”€â”€ OpenClaw session log reader[\s\S]*?function getAgentEmoji[\s\S]*?\n\}\n/,
  ''
);

// Remove agent endpoints
content = content.replace(
  /\/\/ GET \/api\/agents[\s\S]*?app\.get\('\/api\/agents'[\s\S]*?\n\}\);\n/,
  ''
);

content = content.replace(
  /\/\/ GET \/api\/agents\/health[\s\S]*?app\.get\('\/api\/agents\/health'[\s\S]*?\n\}\);\n/,
  ''
);

content = content.replace(
  /\/\/ POST \/api\/agents\/refresh[\s\S]*?app\.post\('\/api\/agents\/refresh'[\s\S]*?\n\}\);\n/,
  ''
);

// Remove agent signals endpoint
content = content.replace(
  /\/\/ ===== Agent Signals Endpoint =====[\s\S]*?\/\/ ===== End Agent Signals =====\n/,
  ''
);

// Replace AGENT_WALLET
content = content.replace(/AGENT_WALLET/g, 'process.env.HYPERLIQUID_WALLET');

// Fix console.log
content = content.replace(
  /console\.log\(`Agent Dashboard API running on/,
  'console.log(`Trading Dashboard API running on'
);

fs.writeFileSync(filePath, content);
console.log('Agent code removed');
```

Run with:
```powershell
cd D:\dev\trading-dashboard
node remove-agents.js
```

## Database

The `agentdb` database and `agent_status` table are separate from the trading database. They can be left as-is or dropped:

```sql
-- Optional: Drop agent database
DROP DATABASE IF EXISTS agentdb;
```

## Verification

After removal, test:
```powershell
cd D:\dev\trading-dashboard\dashboard\server
node index.js
```

Dashboard should work without the /agents page.
