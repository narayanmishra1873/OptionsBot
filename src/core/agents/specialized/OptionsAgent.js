const BaseAgent = require('../BaseAgent');
const OptionChainService = require('../../../services/optionChain/OptionChainService');
const AIService = require('../../../services/ai/AIService');
const { calculateOptionMetrics } = require('../../../utils/optionMath');
const { calculateExpectedNifty } = require('../tools/niftyDownsideTool');
const { generateWithTools } = require('../tools/generateWithTools');

class OptionsAgent extends BaseAgent {
  constructor() {
    super('OptionsAgent', SYSTEM_PROMPT);
    this.optionChainService = new OptionChainService();
    this.aiService = new AIService();
    
    // Keywords that trigger option chain requests
    this.optionKeywords = [
      'option chain', 'options', 'calls', 'puts', 'strike price', 
      'expiry', 'nifty', 'banknifty', 'oi', 'open interest', 
      'option data', 'derivatives', 'premium', 'volatility'
    ];
  }

  /**
   * Check if message is requesting option chain data
   */
  isOptionChainRequest(message) {
    const lowerMessage = message.toLowerCase();
    
    // Look for symbols (NIFTY, BANKNIFTY, etc.)
    const symbolMatch = lowerMessage.match(/\b(nifty|banknifty|finnifty)\b/i);
    
    // Check for option-related keywords
    const hasOptionKeywords = this.optionKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    );
    
    return {
      isOptionChainRequest: hasOptionKeywords,
      symbol: symbolMatch ? symbolMatch[1].toUpperCase() : 'NIFTY'
    };
  }

  /**
   * Extract expected percentage downfall or expected Nifty value from user message
   * Returns: { expectedPercentage, expectedNiftyValue }
   */
  extractDownsideExpectation(message) {
    // Look for patterns like 'downfall of 2%', 'down 2%', 'fall by 2%', etc.
    const percentMatch = message.match(/(?:downfall|down|fall|drop)[^\d]{0,10}(\d{1,3}(?:\.\d{1,2})?)\s*%/i);
    if (percentMatch) {
      return { expectedPercentage: parseFloat(percentMatch[1]) };
    }
    // Look for direct Nifty value: 'expect nifty at 21000', 'nifty to 21000', etc.
    const niftyValueMatch = message.match(/nifty[^\d]{0,10}(\d{4,6})/i);
    if (niftyValueMatch) {
      return { expectedNiftyValue: parseFloat(niftyValueMatch[1]) };
    }
    return {};
  }

  /**
   * Tool schema for AI tool-calling (downside calculator)
   */
  getDownsideToolSchema(optionData) {
    return {
      name: 'calculateExpectedNifty',
      description: 'Calculate expected Nifty50 value based on user-estimated percentage downfall or direct value, and return the current Nifty50 value. Use this tool if the user mentions a percentage drop or a target Nifty value.',
      parameters: {
        type: 'object',
        properties: {
          optionChain: {
            type: 'object',
            description: 'The option chain data for Nifty50 (JSON object, must include current value as underlyingValue or records.underlyingValue)'
          },
          expectedPercentage: {
            type: 'number',
            description: 'The expected percentage downfall in Nifty50 (e.g., 2 for 2%)',
          },
          expectedNiftyValue: {
            type: 'number',
            description: 'The expected Nifty50 value (if provided directly by the user)',
          }
        },
        required: ['optionChain']
      }
    };
  }

  /**
   * Generate AI response with tool-calling for downside calculation (now generic)
   * Always returns an async iterable for streaming compatibility.
   */
  async generateResponse(message, sessionId) {
    try {
      const optionRequest = this.isOptionChainRequest(message);
      let optionData = null;
      let strikePrices = [];
      if (optionRequest.isOptionChainRequest) {
        optionData = await this.optionChainService.getOptionChain(optionRequest.symbol);
        if (optionData && Array.isArray(optionData.optionData)) {
          strikePrices = Array.from(new Set(optionData.optionData
            .map(opt => typeof opt.strikePrice === 'number' ? opt.strikePrice : undefined)
            .filter(x => typeof x === 'number')));
        } else {
          strikePrices = [];
        }
      }
      console.log('[OptionsAgent] striekePrices:', strikePrices);
      // Prepare tool schema
      const tools = [this.getDownsideToolSchema(optionData)];
      // Detect if tool should be called and extract params
      let toolCalls = [];
      const percentMatch = message.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/);
      const valueMatch = message.match(/nifty[^\d]{0,10}(\d{4,6})/i);
      let expectedPercentage = percentMatch ? parseFloat(percentMatch[1]) : undefined;
      let expectedNiftyValue = valueMatch ? parseFloat(valueMatch[1]) : undefined;
      if ((expectedPercentage || expectedNiftyValue) && optionData) {
        toolCalls.push({
          toolName: 'calculateExpectedNifty',
          args: {
            optionChain: optionData,
            expectedPercentage,
            expectedNiftyValue
          }
        });
      }
      // Prepare messages
      const systemPrompt = this.systemPrompt;
      let userContent = message;
      let formattedData = '';
      if (strikePrices.length) {
        formattedData = `Available strike prices: ${strikePrices.join(', ')}`;
      }
      if (formattedData) {
        userContent += `\n\nHere's a list of available strike prices:\n${formattedData}\nIf you need to estimate downside, use the tool.`;
      }
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ];
      // Call global generateWithTools (generic)
      const { aiResponse, toolResults } = await generateWithTools({
        messages,
        tools,
        toolImpls: { calculateExpectedNifty },
        toolCalls,
        aiService: this.aiService,
        temperature: 0.7,
        maxTokens: 800
      });
      
      // Format tool result for user if present
      let toolResultText = '';
      if (toolResults.calculateExpectedNifty) {
        const result = toolResults.calculateExpectedNifty;
        if (result.error) {
          toolResultText = `\n\n⚠️ Could not calculate expected Nifty50: ${result.error}`;
        } else {
          toolResultText = `\n\n📉 Downside Tool Result:\n- Current Nifty50: ${result.currentNifty}\n- Expected Nifty50: ${result.expectedNifty}`;
        }
      }
      
      // aiResponse is the full streaming response object from AI service (has textStream property)
      
      // If no tool result, just return the AI response object directly (it has textStream)
      if (!toolResultText) {
        return aiResponse;
      }
      
      // If there is a tool result, stream both AI and tool result
      async function* streamWithToolResult() {
        try {
          // aiResponse.textStream is the actual text stream
          for await (const chunk of aiResponse.textStream) {
            yield chunk;
          }
        } catch (err) {
          console.log('[OptionsAgent] Error streaming AI response:', err);
          yield '[Error streaming AI response]';
        }
        if (toolResultText) {
          yield toolResultText;
        }
      }
      const finalStream = streamWithToolResult();
      
      // Return in the same format as AIService.generateStreamingResponse (with textStream property)
      return {
        textStream: finalStream
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

  /**
   * Get option chain data directly (for API endpoints)
   */
  async getOptionChain(symbol = 'NIFTY') {
    return await this.optionChainService.getOptionChain(symbol.toUpperCase());
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

🎨 RESPONSE STYLE:
- Clear, concise, and actionable insights
- Use relevant emojis for better readability
- Provide specific strike prices and levels
- Include risk warnings when appropriate
- Focus on practical trading applications

⚠️ IMPORTANT GUIDELINES:
- Always mention that this is for educational purposes
- Emphasize proper risk management
- Highlight that options trading involves significant risk
- Suggest position sizing and stop-loss strategies
- Recommend consulting with financial advisors for major decisions

⚒️ TOOL USAGE:
- If the user asks for a downside estimate (percentage drop or target Nifty value), use the available tool to calculate the expected Nifty50 value and always mention the current Nifty50 value.
- Use the tool whenever you need to perform such calculations, and clearly present the tool's results in your response.

Your responses should be informative, practical, and help traders make better-informed decisions while maintaining responsible trading practices.
`;

module.exports = OptionsAgent;
