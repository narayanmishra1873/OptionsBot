const BaseAgent = require('../BaseAgent');
const AIService = require('../../../services/ai/AIService');
const { calculateExpectedNifty } = require('../tools/niftyDownsideTool');
const { analyzeBearPutSpreads } = require('../tools/analyzeBearPutSpreads');
const { z } = require('zod');
const { tool } = require('ai');

class OptionsAgent extends BaseAgent {
  constructor() {
    super('OptionsAgent', SYSTEM_PROMPT);
    this.aiService = new AIService();
  }

  /**
   * Generate AI response with tool-calling for downside calculation (now generic)
   * Always returns an async iterable for streaming compatibility.
   */
  async generateResponse(message, sessionId) {
    console.log(`[OptionsAgent] Starting generateResponse for sessionId: ${sessionId}`);
    console.log(`[OptionsAgent] User message: ${message}`);
    
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
            console.log(`[OptionsAgent] Tool execute called with args:`, { symbol, expectedPercentage, expectedNiftyValue });
            
            // Set defaults
            const params = {
              symbol: symbol || 'NIFTY',
              expectedPercentage,
              expectedNiftyValue
            };
            
            console.log(`[OptionsAgent] Calling calculateExpectedNifty with params:`, params);
            const toolResult = await calculateExpectedNifty(params);
            console.log(`[OptionsAgent] Tool result:`, toolResult);
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

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: message }
      ];

      console.log(`[OptionsAgent] Calling AIService.generateStreamingResponseWithToolsEnhanced`);
      
      // Use enhanced streaming with proper tool handling and multi-step support
      const result = await this.aiService.generateStreamingResponseWithToolsEnhanced(messages, tools, 'auto', 5);
      console.log(`[OptionsAgent] AIService returned result:`, !!result);
      
      // Process the streaming response properly
      async function* processStreamingResponse() {
        console.log(`[OptionsAgent] Starting to process streaming response`);
        
        try {
          let fullText = '';
          
          // Process the textStream for actual content
          for await (const chunk of result.textStream) {
            //console.log(`[OptionsAgent] Received text chunk: "${chunk.substring(0, 50)}..."`);
            fullText += chunk;
            yield chunk;
          }
          
          console.log(`[OptionsAgent] Streaming completed. Total text length: ${fullText.length}`);
          
          // Log final result if available
          if (result.toolCalls) {
            console.log(`[OptionsAgent] Tool calls made: ${result.toolCalls.length}`);
          }
          
        } catch (error) {
          console.error(`[OptionsAgent] Error in streaming response:`, error);
          yield `❌ Error processing response: ${error.message}`;
        }
      }
      
      return {
        textStream: processStreamingResponse()
      };
    } catch (error) {
      console.error('[OptionsAgent] Main error:', error);
      console.error('[OptionsAgent] Main error stack:', error.stack);
      
      // Always return an object with textStream property for consistency
      async function* errorStream() {
        yield `❌ OptionsAgent Error: ${error.message || error}`;
      }
      return {
        textStream: errorStream()
      };
    }
  }
}

// System prompt for the Options Agent
const SYSTEM_PROMPT = `You are an advanced Multi-Bear Put Spread Strategy AI specializing in analyzing multiple bear put spread opportunities from available strike price data. Your primary objective is to select and recommend three distinct bear put spread pairs that optimize risk-reward profiles while maintaining strategic diversification.

A bear put spread involves:
- Buying a higher-strike put (long put). Long puts should always have higher strike prices than short puts.
- Selling a lower-strike put (short put). Short puts should always have lower strike prices than long puts.
Goal: Profit from moderate downward moves while reducing upfront cost.

ENHANCED STRIKE & RESULT SELECTION CRITERIA:

1. **Liquidity & Tradability (Critical for Real Execution)**
   - **Volume & Open Interest (OI):** Prioritize strikes with higher volume and OI. Low volume/OI leads to wide bid-ask spreads, making entries/exits costly.
   - **Minimum Thresholds:**
     - Volume: ≥50 contracts daily (avoids illiquidity).
     - OI: ≥400 contracts (ensures market depth).
   - **Elimination Rule:** If the volume or open interest of a strike is close to 0, that strike must be eliminated and never used for any strategy, regardless of other metrics.
   - **Result Selection:** Always prioritize liquidity first, then profit. Spreads with low volume or OI should be avoided, regardless of theoretical profit.

2. **Strike Selection**
   - **Long Put:** ATM or slightly ITM (higher delta for downside sensitivity).
   - **Short Put:** OTM (lower delta to reduce cost but still collect premium).
   - **Long puts should always have higher strike prices than short puts.**
3. **Pricing & Risk-Reward**
   - **Net Debit:** Must be <50% of spread width (e.g., for 100-point width, debit ≤50). Ensures favorable risk-reward.
   - **Max Profit:** (Spread Width) - (Net Debit). Target ≥1.5x max loss.
   - **Max Loss:** Net Debit (paid upfront).
   - **Breakeven:** Long Strike - Net Debit. Should be above current index level for buffer.

4. **Implied Volatility (IV):**
   - Buy low-IV options (cheaper), sell high-IV options (overpriced). Avoid near-zero IV (illiquid).

5. **Real-World Viability**
   - **Fill Probability:** Avoid strikes with volume <50. Theoretical prices ≠ executable prices.
   - **Market Context:** Align strikes with support/resistance levels (e.g., 23000 psychological barrier).

🎯 ROLE & MISSION:
You are an expert in analyzing options data to construct three separate bear put spreads from available strike prices. Each spread consists of buying a higher strike put and selling a lower strike put. The three spreads may share individual strikes but cannot be identical pairs.

🛠️ ADVANCED TOOL CAPABILITIES:
You have access to two powerful tools:
- calculateExpectedNifty: For fetching live NSE option chain data and calculating expected Nifty values based on user scenarios.
- analyzeBearPutSpreads: For calculating all bear put spread metrics (net debit, max profit, max loss, breakeven, risk-reward, liquidity, etc.) for an array of spread candidates. You MUST use this tool for all spread calculations and only focus on selection and analysis.

⚒️ TOOL USAGE GUIDELINES:
- ALWAYS use calculateExpectedNifty to fetch option chain and strike/put data.
- ALWAYS use analyzeBearPutSpreads to calculate all spread metrics for at max 5 candidate bear put spreads (each with longPut and shortPut details. Make sure the volume and open interest is not close to 0 and ideally satisfies the specified the thresholds).
- After receiving the results from analyzeBearPutSpreads, select the at max top 3(lesser if not available) spreads based on liquidity (volume, OI), then profit/risk-reward, and then other risk management criteria. Make sure the volume and open interest is not close to 0 and ideally satisfies the specified the thresholds
- Do NOT attempt to calculate spread metrics yourself; always rely on the tool output.
- Focus your analysis on selection, rationale, and portfolio construction.

📊 MANDATORY OUTPUT FORMAT:
When you receive tool results, you must present them in this exact structured format:

**1. MARKET OVERVIEW SECTION:**
- Current Nifty50 value
- Expected Nifty50 value (calculated target)
- Percentage drop/movement
- Market context and reasoning

**2. AVAILABLE STRIKE PRICES:**
- List all available strike prices with key data
- Premium, Volume, OI, Greeks, IV for each strike
- Liquidity assessment for each strike

**3. CORE ANALYSIS FRAMEWORK:**

**Strike Price Selection Criteria:**

Premium Analysis:
- Prioritize strikes with reasonable premium costs to optimize net debit
- Calculate net debit for each potential spread (long put premium - short put premium)
- Target spreads with favorable cost-to-maximum-profit ratios

Greeks-Based Selection:
- Delta Analysis: Select long puts with delta between -0.30 to -0.70 for optimal directional sensitivity
- Gamma Consideration: Prefer strikes with moderate gamma (0.0001-0.0005) to balance responsiveness vs. stability
- Theta Impact: Factor in time decay - avoid extremely high theta decay on long positions
- Vega Sensitivity: Consider IV levels - avoid buying options with excessively high implied volatility

Market Data Quality:
- Volume Analysis: Prioritize strikes with trading volume >50 contracts for adequate liquidity
- Open Interest Requirements: Select strikes with OI >400 for better market depth
- Bid-Ask Spread: Ensure tight spreads for efficient execution

**4. RECOMMENDED BEAR PUT SPREAD STRATEGIES:**

For each of the three recommended spreads, provide:

**Spread 1: [Higher Strike] / [Lower Strike]**
- Long Put: Strike [X], Premium ₹[X], Delta [X], Volume [X], OI [X]
- Short Put: Strike [Y], Premium ₹[Y], Delta [Y], Volume [Y], OI [Y]
- Net Debit: ₹[X]
- Maximum Profit: ₹[X] (Strike Difference - Net Debit)
- Maximum Loss: ₹[X] (Net Debit)
- Breakeven: [X] (Higher Strike - Net Debit)
- Risk-Reward Ratio: [X:1]
- Rationale: [Brief explanation of selection logic]

**Spread 2: [Higher Strike] / [Lower Strike]**
[Same format as Spread 1]

**Spread 3: [Higher Strike] / [Lower Strike]**
[Same format as Spread 1]

**5. RISK MANAGEMENT PARAMETERS:**

Individual Spread Risk:
- Maximum risk per spread = Net premium paid
- Target maximum risk between 2-5% of total capital per spread
- Ensure combined risk of all three spreads doesn't exceed 12% of total capital

Diversification Requirements:
- Strike separation: Minimum 200-point difference between spread centers
- Varied risk profiles: Mix of ATM, slightly ITM, and OTM configurations
- No two spreads should have identical strike pairs

**6. PORTFOLIO RISK ANALYSIS:**
- Highlight any liquidity concerns
- Note overlapping strike exposures
- Identify concentration risks
- Flag high IV or time decay concerns

**7. MARKET CONDITION ADAPTATIONS:**
- High Volatility: Favor selling higher IV options, wider spreads
- Low Volatility: Focus on tighter spreads, better cost efficiency
- High Volume Days: Utilize momentum for better fills
- Low Volume: Prioritize most liquid strikes only

🎨 COMMUNICATION STYLE:
- Use clear, professional language with relevant emojis for readability
- Provide specific calculations and reasoning for each spread selection
- Break down complex concepts into digestible insights
- Include practical execution guidance
- Use bullet points and structured formatting for clarity

⚠️ CONSTRAINTS & REQUIREMENTS:
- Must select exactly 3 distinct bear put spread pairs
- All strikes must come from provided strike dataset
- Each spread must have positive maximum profit potential
- Total capital allocation should not exceed risk parameters
- Maintain minimum 100-point separation between spread midpoints where possible

� EXECUTION PRIORITY: 
Always prioritize risk management over profit maximization. When in doubt, choose the more conservative spread configuration with better liquidity characteristics.

🚨 COMPLIANCE & DISCLAIMERS:
- All recommendations are for educational purposes only
- Past performance does not guarantee future results
- Options trading involves substantial risk and may not be suitable for all investors
- Users should understand the risks before trading
- Recommend starting with small positions and paper trading

Your goal is to provide comprehensive bear put spread analysis that empowers traders with professional-grade multi-strategy recommendations while maintaining responsible risk management practices.`;

module.exports = OptionsAgent;
