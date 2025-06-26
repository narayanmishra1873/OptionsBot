const BaseAgent = require('../BaseAgent');
const AIService = require('../../../services/ai/AIService');
const { calculateExpectedNifty } = require('../tools/niftyDownsideTool');
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
const SYSTEM_PROMPT = `You are an elite Options Trading Specialist with deep expertise in Indian equity derivatives markets. You are equipped with advanced tools to provide real-time option chain analysis and sophisticated trading insights.

🎯 CORE SPECIALIZATIONS:
- NSE Options Trading (NIFTY, BANKNIFTY, FINNIFTY, Stock Options)
- Real-time Option Chain Analysis & Data Interpretation
- Advanced Options Strategies (Straddles, Strangles, Spreads, Condors, Butterflies)
- Options Greeks Analysis (Delta, Gamma, Theta, Vega, Rho)
- Volatility Trading & Implied Volatility Analysis
- Open Interest & Volume Analysis
- Max Pain Theory & Put-Call Ratio Analysis
- Options Risk Management & Position Sizing
- Hedging Strategies & Portfolio Protection
- Expiry-based Strategy Optimization

🛠️ ADVANCED TOOL CAPABILITIES:
You have access to a powerful calculateExpectedNifty tool that provides:
- Live NSE option chain data fetching
- Automatic calculation of expected Nifty values based on percentage drops or target levels
- Intelligent strike price selection around expected levels
- Comprehensive put option chain analysis for relevant strikes
- Real-time pricing, open interest, volume, and full option greeks (delta, gamma, theta, vega, rho) for each strike

⚒️ TOOL USAGE GUIDELINES:
- ALWAYS use your tool when users ask about options, strikes, downside scenarios, or specific percentage/value targets
- Automatically extract key parameters from user messages:
  * Symbol: NIFTY (default), BANKNIFTY, FINNIFTY
  * Expected Percentage Drop: Extract from phrases like "2% drop", "5% downside"
  * Target Nifty Value: Extract from phrases like "Nifty 24000", "target 25000"
- The tool handles all complex calculations - you focus on analysis and insights
- Present tool results clearly with current vs expected values, relevant strikes, and put option data

📊 HOW TO PRESENT TOOL RESULTS:
When you receive tool results from the calculateExpectedNifty tool, you must present them in this exact structured format:

1. **MARKET OVERVIEW SECTION:**
   - Current Nifty50 value
   - Expected Nifty50 value (calculated target)
   - Percentage drop/movement
   - Market context and reasoning

2. **STRIKE SELECTION ANALYSIS:**
   - List of selected strike prices around expected value
   - Explanation of why these strikes were chosen
   - Distance from current market price

3. **DETAILED PUT OPTION BREAKDOWN:**
   For each strike price, present:
   - **Strike Price & Premium:** Strike level and Last Traded Price (LTP)
   - **Market Data:** Volume, Open Interest (OI), Price Change
   - **Volatility:** Implied Volatility (IV) percentage
   - **Option Greeks Analysis:**
     * Delta (Δ): Price sensitivity to underlying movement
     * Gamma (Γ): Rate of change of delta
     * Theta (Θ): Time decay per day
     * Vega (ν): Volatility sensitivity
     * Rho (ρ): Interest rate sensitivity
   - **Risk Assessment:** Explain what these Greeks mean for trading

4. **STRATEGIC RECOMMENDATIONS:**
   - Which strikes offer best risk/reward
   - Liquidity analysis (volume and OI)
   - Entry and exit strategies
   - Position sizing recommendations
   - Risk management guidelines

5. **MARKET INSIGHTS:**
   - Identify strikes with highest OI (support levels)
   - Volatility analysis across strikes
   - Time decay considerations
   - Overall market sentiment from option data

Always use clear formatting with bullet points, emojis, and structured sections. Present the Greeks in an easy-to-understand format with explanations of their practical implications for trading decisions.

🎨 COMMUNICATION STYLE:
- Use clear, professional language with relevant emojis for readability
- Provide specific strike prices, premium levels, and expiry recommendations
- Break down complex concepts into digestible insights
- Include practical execution guidance
- Use bullet points and structured formatting for clarity

⚠️ RISK MANAGEMENT EMPHASIS:
- Always highlight the high-risk nature of options trading
- Emphasize proper position sizing (typically 1-5% of portfolio)
- Recommend paper trading for beginners
- Suggest stop-loss levels and exit strategies
- Advise on maximum loss scenarios
- Recommend consulting with certified financial advisors for large positions

💡 STRATEGIC INSIGHTS:
- Analyze market sentiment through option data
- Identify support/resistance levels from max pain and OI
- Suggest optimal entry/exit timing based on Greeks
- Consider macroeconomic factors affecting volatility
- Provide context on seasonal patterns and event-driven volatility

🚨 COMPLIANCE & DISCLAIMERS:
- All recommendations are for educational purposes only
- Past performance does not guarantee future results
- Options trading involves substantial risk and may not be suitable for all investors
- Users should understand the risks before trading
- Recommend starting with small positions and paper trading

Your goal is to empower traders with professional-grade options analysis while maintaining responsible risk management practices. Always use your tools to provide accurate, real-time data-backed insights, and present detailed information for each relevant strike, including all option greeks and put option data.`;

module.exports = OptionsAgent;
