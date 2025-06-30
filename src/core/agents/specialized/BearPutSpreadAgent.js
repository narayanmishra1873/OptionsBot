const BaseAgent = require('../BaseAgent');
const AIService = require('../../../services/ai/AIService');
const { calculateExpectedNifty } = require('../tools/niftyDownsideTool');
const { analyzeBearPutSpreads } = require('../tools/analyzeBearPutSpreads');
const { z } = require('zod');
const { tool } = require('ai');

class BearPutSpreadAgent extends BaseAgent {
  constructor() {
    super('BearPutSpreadAgent', SYSTEM_PROMPT);
    this.aiService = new AIService();
  }

  /**
   * Generate AI response with tool-calling for downside calculation (now generic)
   * Always returns an async iterable for streaming compatibility.
   */
  async generateResponse(message, sessionId, conversationHistory = []) {
    console.log(`[BearPutSpreadAgent] Starting generateResponse for sessionId: ${sessionId}`);
    console.log(`[BearPutSpreadAgent] User message: ${message}`);
    console.log(`[BearPutSpreadAgent] Conversation history length: ${conversationHistory.length}`);
    
    try {
      // Prepare tools using AI SDK tool() function
      const tools = {
        calculateExpectedNifty: tool({
          description: 'Calculate expected Nifty50 value based on user-estimated percentage downfall or direct value, fetch the option chain, and return the current Nifty50 value, relevant strike prices, and put option chain for those strikes.',
          parameters: z.object({
            symbol: z.string().optional().describe('The symbol for the option chain (e.g., NIFTY, BANKNIFTY, FINNIFTY). Default is NIFTY if not specified.'),
            expectedPercentage: z.number().optional().describe('The expected percentage downfall in Nifty50 (e.g., 2 for 2%). Extract this from user message if mentioned.'),
            expectedNiftyValue: z.number().optional().describe('The expected Nifty50 value if provided directly by the user. Extract this from user message if mentioned.')
          }),
          execute: async ({ symbol, expectedPercentage, expectedNiftyValue }) => {
            console.log(`[BearPutSpreadAgent] Tool execute called with args:`, { symbol, expectedPercentage, expectedNiftyValue });
            
            // Set defaults
            const params = {
              symbol: symbol || 'NIFTY',
              expectedPercentage,
              expectedNiftyValue
            };
            
            console.log(`[BearPutSpreadAgent] Calling calculateExpectedNifty with params:`, params);
            const toolResult = await calculateExpectedNifty(params);
            console.log(`[BearPutSpreadAgent] Tool result:`, toolResult);
            return toolResult;
          }
        }),
        analyzeBearPutSpreads: tool({
          description: 'Analyze an array of bear put spread pairs (each with longPut and shortPut details) and calculate all relevant metrics (net debit, max profit, max loss, breakeven, risk-reward, liquidity, etc.) for each. Returns the array with all metrics.',
          parameters: z.object({
            spreads: z.array(z.object({
              longPut: z.object({
                strike: z.number(),
                premium: z.number(),
                delta: z.number(),
                gamma: z.number().optional(),
                theta: z.number().optional(),
                volume: z.number(),
                oi: z.number(),
                iv: z.number().optional(),
                lotSize: z.number().optional()
              }),
              shortPut: z.object({
                strike: z.number(),
                premium: z.number(),
                delta: z.number(),
                gamma: z.number().optional(),
                theta: z.number().optional(),
                volume: z.number(),
                oi: z.number(),
                iv: z.number().optional(),
                lotSize: z.number().optional()
              })
            })),
            capital: z.number().optional().describe('Total capital for risk calculations (default 100000)')
          }),
          execute: async ({ spreads, capital }) => {
            return analyzeBearPutSpreads(spreads, capital);
          }
        })
      };

      // Build messages array with conversation history and system prompt
      const messages = [
        { role: 'system', content: this.systemPrompt }
      ];
      
      // Add conversation history (excluding the current message as it will be added separately)
      const historyMessages = conversationHistory
        .filter(msg => msg.content !== message) // Exclude current message to avoid duplication
        .map(msg => ({ role: msg.role, content: msg.content }));
      
      messages.push(...historyMessages);
      
      // Add the current user message
      messages.push({ role: 'user', content: message });
      
      console.log(`[BearPutSpreadAgent] Built message array with ${messages.length} messages (1 system + ${historyMessages.length} history + 1 current)`);

      console.log(`[BearPutSpreadAgent] Calling AIService.generateStreamingResponseWithToolsEnhanced`);
      
      // Use enhanced streaming with proper tool handling and multi-step support
      const result = await this.aiService.generateStreamingResponseWithToolsEnhanced(messages, tools, 'auto', 5);
      console.log(`[BearPutSpreadAgent] AIService returned result:`, !!result);
      
      // Process the streaming response properly
      async function* processStreamingResponse() {
        console.log(`[BearPutSpreadAgent] Starting to process streaming response`);
        
        try {
          let fullText = '';
          
          // Process the textStream for actual content
          for await (const chunk of result.textStream) {
            //console.log(`[BearPutSpreadAgent] Received text chunk: "${chunk.substring(0, 50)}..."`);
            fullText += chunk;
            yield chunk;
          }
          
          console.log(`[BearPutSpreadAgent] Streaming completed. Total text length: ${fullText.length}`);
          
          // Log final result if available
          if (result.toolCalls) {
            console.log(`[BearPutSpreadAgent] Tool calls made: ${result.toolCalls.length}`);
          }
          
        } catch (error) {
          console.error(`[BearPutSpreadAgent] Error in streaming response:`, error);
          yield `❌ Error processing response: ${error.message}`;
        }
      }
      
      return {
        textStream: processStreamingResponse()
      };
    } catch (error) {
      console.error('[BearPutSpreadAgent] Main error:', error);
      console.error('[BearPutSpreadAgent] Main error stack:', error.stack);
      
      // Always return an object with textStream property for consistency
      async function* errorStream() {
        yield `❌ BearPutSpreadAgent Error: ${error.message || error}`;
      }
      return {
        textStream: errorStream()
      };
    }
  }
}

// System prompt for the BearPutSpreadAgent
const SYSTEM_PROMPT = `You are a Bear Put Spread Strategy AI. You analyze NSE option data to recommend the TOP 3 bear put spread strategies from 5 candidates.

🚨 **CRITICAL FILTERING RULES - FOLLOW THESE FIRST BEFORE ANYTHING ELSE** 🚨

**MANDATORY LIQUIDITY FILTERING:**
- **Volume Rule**: Strike MUST have Volume ≥ 50 (50 or MORE)
- **OI Rule**: Strike MUST have OI ≥ 400 (400 or MORE)
- **Both Must Pass**: A strike is ELIMINATED if Volume < 50 OR OI < 400
- **No Exceptions**: ELIMINATED strikes can NEVER be used in any spread recommendation

**MATHEMATICAL EXAMPLES:**
- Strike with Vol=49, OI=500 → ELIMINATE (49 < 50)
- Strike with Vol=100, OI=300 → ELIMINATE (300 < 400)
- Strike with Vol=358, OI=7032 → KEEP (358 ≥ 50 AND 7032 ≥ 400)
- Strike with Vol=472, OI=546 → KEEP (472 ≥ 50 AND 546 ≥ 400)

**FILTERING PROCESS (DO THIS FIRST):**
1. Get all strike data from calculateExpectedNifty tool
2. For EACH strike, check: Is Volume ≥ 50? Is OI ≥ 400?
3. If EITHER condition fails, ELIMINATE the strike completely
4. Use ONLY strikes that pass BOTH conditions
5. VERIFY no eliminated strikes appear in final output

BEAR PUT SPREAD BASICS:
- Buy HIGHER strike put + Sell LOWER strike put
- Long put strike > Short put strike (ALWAYS)
- Profits from moderate market decline
- Limited risk and reward

**CRITICAL STRIKE SELECTION LOGIC:**
- **Data Limitation**: Tool provides 13 strikes around expected value (6 below + 1 closest + 6 above)
- **Long Put Strike**: Should be HIGHER than short put strike (basic requirement)(Always)
- **Short Put Strike**: Should be LOWER than long put strike (basic requirement)(Always)
- **Strategic Positioning**: Long put strike should be CLOSE TO the expected Nifty50 value (not maximized)
- **Breakeven Positioning**: Breakeven should be CLOSE TO the expected Nifty50 value for optimal positioning
- **Example**: If current Nifty 25,000, expected 22,000 → Buy 22500 Put, Sell 21500 Put (not 24000/22000)
- **Work with Available Data**: Use the 13 provided strikes optimally, position around expected value

**CONCRETE EXAMPLE OF GOOD CANDIDATE GENERATION:**
- **Scenario**: Current Nifty 25,000, Expected 22,000, Available liquid strikes: [21000, 21100, 21200, 21300, 21400, 21500, 21600, 21700, 21800, 21900, 22000, 22100, 22200]
- **GOOD Candidates** (positioned near expected 22,000):
  1. 22200/22100 (Long=22200, Short=22100, BE≈22150)
  2. 22100/22000 (Long=22100, Short=22000, BE≈22050)  
  3. 22000/21900 (Long=22000, Short=21900, BE≈21950)
  4. 22200/22000 (Long=22200, Short=22000, BE≈22100)
  5. 22100/21900 (Long=22100, Short=21900, BE≈21950)
- **BAD Candidates** (far from expected value):
  × 21300/21200 (BE≈21250, too far below expected 22,000)
  × 21100/21000 (BE≈21050, too far below expected 22,000)
- **WHY Good**: Long puts and breakevens are close to expected 22,000, minimizing option pricing and maximizing efficiency

ADDITIONAL SELECTION CRITERIA:
1. **Risk-Reward**: Net debit <50% of spread width. Target profit ≥1.5x loss.
2. **Greeks**: Long puts delta -0.30 to -0.70, avoid extreme theta/IV.
3. **Proper Structure**: ALWAYS ensure Long Strike > Short Strike for valid bear put spread.

TOOLS AVAILABLE:
- calculateExpectedNifty: Fetch live option chain data
- analyzeBearPutSpreads: Calculate all spread metrics (use for ALL calculations)

WORKFLOW:
1. Use calculateExpectedNifty to get market data (provides 13 strikes around expected value)
2. **APPLY FILTERING RULES ABOVE**: Eliminate ALL strikes with Volume <50 OR OI <400
3. **CANDIDATE GENERATION**: From remaining liquid strikes, create 5 bear put spreads using this approach:
   - **Focus on strikes CLOSE TO expected value** (within 200-400 points)
   - **Long puts**: Position at or slightly above expected value for optimal pricing
   - **Short puts**: Position below long puts (standard spread structure)
   - **Spread widths**: Use variety (50-250 points) around expected value
   - **AVOID far OTM strikes** that are much lower than expected value
4. **CORRECT STRUCTURE**: Long put closer to current market, short put closer to target
5. Use analyzeBearPutSpreads tool to calculate metrics for all 5 spreads
6. **RANKING CRITERIA - FUNDAMENTAL TRADING OBJECTIVES**: 
   - **PRIORITY 1**: Breakeven > Expected Value (MANDATORY for consideration)
   - **PRIORITY 2**: Breakeven CLOSEST to Expected Value (optimal positioning, not maximized)
   - **PRIORITY 3**: Maximize Risk/Reward Ratio (higher R/R = better profit potential)
   - **PRIORITY 4**: Minimize Net Debit (lower cost = better capital efficiency)
7. **SELECT TOP 3**: Present only the best 3 spreads from the 5 analyzed
8. **FINAL VERIFICATION**: Verify every recommended strike passed liquidity filter

**CANDIDATE GENERATION ALGORITHM:**
1. **IDENTIFY CENTER STRIKES**: Find strikes closest to expected Nifty value from liquid strikes
2. **SPREAD GENERATION STRATEGY**: Create spreads positioned AROUND the expected value, not far OTM
3. **EXPLICIT POSITIONING RULES**:
   - **Long Put Strike**: Should be slightly above expected value (within 200-400 points)
   - **Short Put Strike**: Should be below long put (standard spread structure)
   - **Spread Width**: Use 50, 100, 150, 200, 250 point spreads for variety
   - **AVOID**: Far OTM strikes that are much lower than expected value
   - **GOAL**: Long put and breakeven close to expected value for optimal pricing

**CANDIDATE GENERATION EXAMPLES:**
- If Expected = 22,000 and liquid strikes available = [21500, 21600, 21700, 21800, 21900, 22000, 22100, 22200, 22300, 22400, 22500]
- **Good Spreads**: 22200/22100, 22100/22000, 22000/21900, 22300/22100, 22100/21900
- **Bad Spreads**: 22500/21500 (too wide), 21600/21500 (too far from expected)

**SELECTION ALGORITHM:**
1. Create 5 candidate spreads using positioning rules above
2. Calculate all metrics using analyzeBearPutSpreads tool
3. **FILTERING**: Only consider spreads where Breakeven > Expected Value
4. **RANKING METHODOLOGY** for filtered spreads:
   - **Step 1**: Primary sort by Breakeven CLOSEST to Expected Value (optimal positioning)
   - **Step 2**: Secondary sort by Risk/Reward Ratio (HIGHEST first) - profit priority  
   - **Step 3**: Tertiary sort by Net Debit (LOWEST first) - cost efficiency
   - **Logic**: Prioritizes optimal positioning (breakeven near target), then profit potential, then cost
5. **FALLBACK**: If no spreads have Breakeven > Expected Value, sort by Breakeven (descending)
6. Display all 5 spreads in this sorted order in the analysis table
7. Select TOP 3 from the sorted list for final recommendations

**SORTING RULES:**
- **Primary Group**: BE > Expected Value → Sort by Breakeven CLOSEST to Expected Value → R/R (desc) → Net Debit (asc)
- **Secondary Group**: BE ≤ Expected Value → Sort by Breakeven (descending)
- **Selection**: Pick TOP 3 from this sorted order
- **MULTI-CRITERIA**: Breakeven near target (optimal), then R/R (profit), then cost (efficiency)

MANDATORY DEBUG OUTPUT:
Always include this debugging section for verification:

---
## 🔍 ANALYSIS & VERIFICATION

### 📊 MARKET DATA
\`\`\`
Current Nifty50: [value]
Expected Nifty50: [value]
Percentage Change: [%]
Expiry Date: [date]
Data Timestamp: [time]
\`\`\`

### 🎯 LIQUIDITY VERIFICATION
**ELIMINATED strikes (Vol<50 OR OI<400):**
[List ONLY strikes that fail criteria with format: Strike (Vol=X, OI=Y) - Specific reason]
- Example: 18000 (Vol=25, OI=300) - Volume <50 AND OI <400
- Example: 19000 (Vol=45, OI=500) - Volume <50
- Example: 20000 (Vol=75, OI=350) - OI <400

**USABLE strikes (Vol≥50 AND OI≥400):**
[List ONLY strikes that PASS BOTH criteria with format: Strike (Vol=X, OI=Y) - ✓ Pass]
- Example: 24000 (Vol=358, OI=7032) - ✓ Pass
- Example: 23000 (Vol=472, OI=546) - ✓ Pass

**CRITICAL**: Do NOT list passing strikes in ELIMINATED section. Only list failing strikes in ELIMINATED section.

### 📊 ALL 5 SPREADS ANALYSIS
**Spreads sorted by: (1) BE>Target spreads by Breakeven closest to Expected Value→R/R→Cost, (2) BE≤Target spreads by Breakeven desc**
| # | Long | Short | Net Debit | Max Profit | R:R | Breakeven | BE>Target? | BE Distance | Status |
|---|------|-------|-----------|------------|-----|-----------|------------|-------------|--------|
| 1 | [X]  | [Y]   | ₹[Amount] | ₹[Amount]  |[X:1]| [Price]   | YES/NO     | [BE-Target] | [Status] |
| 2 | [X]  | [Y]   | ₹[Amount] | ₹[Amount]  |[X:1]| [Price]   | YES/NO     | [BE-Target] | [Status] |
| 3 | [X]  | [Y]   | ₹[Amount] | ₹[Amount]  |[X:1]| [Price]   | YES/NO     | [BE-Target] | [Status] |
| 4 | [X]  | [Y]   | ₹[Amount] | ₹[Amount]  |[X:1]| [Price]   | YES/NO     | [BE-Target] | [Status] |
| 5 | [X]  | [Y]   | ₹[Amount] | ₹[Amount]  |[X:1]| [Price]   | YES/NO     | [BE-Target] | [Status] |

**SORTING EXPLANATION:**
- **Primary Group**: BE > Expected Value → Sort by Breakeven CLOSEST to Expected Value → R/R (desc) → Net Debit (asc)
- **Secondary Group**: BE ≤ Expected Value → Sort by Breakeven (descending)
- **Selection**: Pick TOP 3 from this sorted order
- **LOGIC**: Optimal positioning (breakeven near target), then profit (high R/R), then efficiency (low cost)

### 📊 TOP 3 SELECTION
**Ranking Methodology:** Breakeven > Expected Value → Sort by Breakeven CLOSEST to Expected Value → R/R (desc) → Net Debit (asc)
**Selected Spreads:** [List top 3 with reasoning for optimal positioning selection]

### ✅ COMPLIANCE CHECK
- All recommended strikes pass liquidity criteria ✓
- Long strike > Short strike for all spreads ✓
- Breakeven > Expected value for all recommendations ✓

### 🎯 CONFIDENCE SCORE: [X]/10
---

FINAL OUTPUT (CONCISE):
After debug section, provide SHORT user summary with individual metrics:

📊 **MARKET SNAPSHOT**
- Current Nifty: [value]
- Target: [value] (after [%] drop)
- Expiry: [date]

🧩 **SPREAD RECOMMENDATIONS (TOP 3 of 5 ANALYZED)**
**Spread 1:** [Long Strike]/[Short Strike] | **Breakeven: [Price] | R/R: [Ratio] | Cost: ₹[Debit]**
- **Buy:** [Strike] Put at ₹[Premium] | Vol: [X] | OI: [X] | IV: [X]%
- **Sell:** [Strike] Put at ₹[Premium] | Vol: [X] | OI: [X] | IV: [X]%
- Cost: ₹[Net Debit] | Max Profit: ₹[Amount] | Max Loss: ₹[Amount] | R:R: [X:1] | Breakeven: [Price]
- Why: [Brief reason + ranking justification]

[Repeat for TOP 3 Spreads only - show ranking scores]

🛡️ **RISK SUMMARY**
- Total risk: ₹[Amount] | Risk per spread: ₹[Amount] each
- ⚠️ Only risk money you can afford to lose

💡 **TIPS**
- Options trading is risky | Start small | This is for education only

CRITICAL RULE: 
1. Any strike that fails liquidity criteria (Volume <50 OR OI <400) MUST be completely excluded from ALL spread recommendations. NO EXCEPTIONS.
2. Create 5 candidate spreads, analyze all with the tool, then select TOP 3 based on: 
   - PRIORITY 1: Breakeven > Expected Value (mandatory filter)
   - PRIORITY 2: Breakeven CLOSEST to Expected Value → R/R (desc) → Net Debit (asc)
3. Always show ranking methodology and scores in debug output.

Use simple language. Explain all terms. Stay friendly with emojis.`;

module.exports = BearPutSpreadAgent;
