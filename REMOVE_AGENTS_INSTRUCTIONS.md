# Remove Agents - Step by Step Instructions

The agent code in `dashboard/server/index.js` is extensive. Here's what needs to be removed:

## Sections to Remove from index.js:

### 1. Lines ~39-100: Agent Constants and Functions
Remove everything from:
```javascript
// â”€â”€ OpenClaw session log reader
```
To (but keep the normalizeModel function):
```javascript
function normalizeModel(model) {
```

**Keep only:**
```javascript
function normalizeModel(model) {
  if (!model) return 'unknown';
  if (model.includes('/')) return model;
  if (model.includes('claude'))  return `anthropic/${model}`;
  if (model.includes('grok'))    return `xai/${model}`;
  if (model.includes('gpt'))     return `openai/${model}`;
  if (model.includes('gemini'))  return `google/${model}`;
  if (model.includes(':'))       return `ollama/${model}`;
  return model;
}
```

### 2. Lines ~110-180: Session Log Reader Function
Remove the entire `readSessionLogs()` function that references `AGENT_DISPLAY_NAMES`.

### 3. Lines ~190-280: /api/agents endpoint
Remove:
```javascript
app.get('/api/agents', async (req, res) => {
```
And all its handler code.

### 4. Lines ~280-320: /api/agents/health endpoint
Remove:
```javascript
app.get('/api/agents/health', async (req, res) => {
```

### 5. Lines ~320-360: /api/agents/refresh endpoint
Remove:
```javascript
app.post('/api/agents/refresh', async (req, res) => {
```

### 6. Lines ~620-680: Agent Signals Endpoint
Remove:
```javascript
// ===== Agent Signals Endpoint =====
```
To:
```javascript
// ===== End Agent Signals =====
```

### 7. Lines ~1300-1500: /api/usage endpoint (optional)
This endpoint shows agent usage stats. Can be removed or kept.

### 8. Lines ~1570, 1604, 1629, 1649, 1659, 1684: AGENT_WALLET references
Replace `AGENT_WALLET` with `process.env.HYPERLIQUID_WALLET`

### 9. Line ~2038: Console log message
Change:
```javascript
console.log(`Agent Dashboard API running on http://localhost:${PORT}`);
```
To:
```javascript
console.log(`Trading Dashboard API running on http://localhost:${PORT}`);
```

## Alternative: Create New File

Given the complexity, it may be easier to:
1. Backup the current index.js
2. Create a new minimal server file with only trading endpoints
3. Test and replace

## Database

The `agentdb` database connection can be removed from the pools since we only need `tradingPool`.

## Testing

After removal:
```powershell
cd D:\dev\trading-dashboard\dashboard\server
node index.js
```

Should start without errors on port 3001.
