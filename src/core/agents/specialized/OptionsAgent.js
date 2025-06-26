const BaseAgent = require('../BaseAgent');
const AIService = require('../../../services/ai/AIService');
const { calculateExpectedNifty } = require('../tools/niftyDownsideTool');
const { z } = require('zod');

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
    try {
      // Prepare tools in AI SDK format with Zod schemas
      const tools = {
        calculateExpectedNifty: {
          description: 'Calculate expected Nifty50 value based on user-estimated percentage downfall or direct value, fetch the option chain, and return the current Nifty50 value, relevant strike prices, and put option chain for those strikes.',
          parameters: z.object({
            symbol: z.string().optional().describe('The symbol for the option chain (e.g., NIFTY, BANKNIFTY, FINNIFTY). Default is NIFTY if not specified.'),
            expectedPercentage: z.number().optional().describe('The expected percentage downfall in Nifty50 (e.g., 2 for 2%). Extract this from user message if mentioned.'),
            expectedNiftyValue: z.number().optional().describe('The expected Nifty50 value if provided directly by the user. Extract this from user message if mentioned.')
          }),
          execute: async (args) => {
            // Set defaults
            const params = {
              symbol: args.symbol || 'NIFTY',
              expectedPercentage: args.expectedPercentage,
              expectedNiftyValue: args.expectedNiftyValue
            };
            return await calculateExpectedNifty(params);
          }
        }
      };

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: message }
      ];

      // Use AIService's native tool calling - let AI extract parameters and call tools
      const result = await this.aiService.generateStreamingResponseWithTools(messages, tools, 'auto');
      // Handle the streaming response with tool calls
      let toolResultText = '';
      
      // Stream the AI response and handle tool calls
      async function* streamWithToolHandling() {
        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              yield part.textDelta;
            } else if (part.type === 'tool-call') {
              // Tool calls are automatically executed by AI SDK, just handle the results
              console.log(`[OptionsAgent] AI called tool: ${part.toolName} with args:`, part.args);
            } else if (part.type === 'tool-result') {
              // Handle tool results
              const { toolName, result: toolResult } = part;
              if (toolName === 'calculateExpectedNifty') {
                if (toolResult.error) {
                  toolResultText = `\n\n⚠️ Could not calculate expected Nifty50: ${toolResult.error}`;
                } else {
                  toolResultText = `\n\n📉 Downside Tool Result:\n- Current Nifty50: ${toolResult.currentNifty}\n- Expected Nifty50: ${toolResult.expectedNifty}`;
                  if (toolResult.surroundingStrikes && toolResult.surroundingStrikes.length) {
                    toolResultText += `\n- Relevant Strikes: ${toolResult.surroundingStrikes.join(', ')}`;
                  }
                  if (toolResult.putOptions && toolResult.putOptions.length) {
                    toolResultText += `\n- Put Option Chain for Relevant Strikes:\n` + toolResult.putOptions.map(opt => `Strike: ${opt.strikePrice}, LTP: ${opt.lastPrice}, OI: ${opt.openInterest}`).join('\n');
                  }
                }
              }
            }
          }
          
          // Append tool results at the end
          if (toolResultText) {
            yield toolResultText;
          }
        } catch (err) {
          console.log('[OptionsAgent] Error in stream handling:', err);
          yield '\n\n❌ Error processing response';
        }
      }

      return {
        textStream: streamWithToolHandling()
      };
    } catch (error) {
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
const SYSTEM_PROMPT = `
You are an expert Options Trading Assistant specializing in Indian equity derivatives markets. Your expertise includes:

🎯 CORE SPECIALIZATIONS:
- NSE Option Chain Analysis (NIFTY, BANKNIFTY, FINNIFTY)
- Options Greeks (Delta, Gamma, Theta, Vega, Rho)
- Options Strategies (Straddles, Strangles, Spreads, etc.)
- Open Interest Analysis & Max Pain Theory
- Volatility Analysis & IV Crush
- Options Risk Management

📊 ANALYSIS CAPABILITIES:
- Real-time option chain interpretation
- Strike price selection guidance
- Expiry-based strategy recommendations
- Put-Call Ratio analysis
- Support & Resistance from option data

⚒️ TOOL USAGE:
- You have access to a calculateExpectedNifty tool that fetches live option chain data and calculates relevant strikes.
- You MUST analyze the user's message and extract relevant parameters (symbol, expectedPercentage, expectedNiftyValue) to call this tool.
- When the user mentions a percentage drop (e.g., "2%", "5% drop"), extract the expectedPercentage parameter.
- When the user mentions a target Nifty value (e.g., "Nifty 24000", "target 25000"), extract the expectedNiftyValue parameter.
- For symbol, extract NIFTY, BANKNIFTY, or FINNIFTY from the message. Default to 'NIFTY' if not specified.
- If the user asks about options, strikes, or downside scenarios, you should call the tool with appropriate parameters.
- Always present tool results clearly, including current Nifty value, expected Nifty value, relevant strikes, and put option chain data.

🎨 RESPONSE STYLE:
- Clear, concise, and actionable insights
- Use relevant emojis for better readability
- Provide specific strike prices and levels
- Include risk warnings when appropriate
- Focus on practical trading applications

⚠️ IMPORTANT GUIDELINES:
- All advice is for educational purposes only
- Emphasize proper risk management
- Highlight that options trading involves significant risk
- Suggest position sizing and stop-loss strategies
- Recommend consulting with financial advisors for major decisions

Your responses should be informative, practical, and help traders make better-informed decisions while maintaining responsible trading practices. For all option chain and strike logic, always use the provided tools to ensure live, accurate data. When calling a tool, you must extract and pass the correct parameters from the user message. Do not use any fallback mechanism or prompt the user for missing values.`;

module.exports = OptionsAgent;
