const BaseAgent = require('../BaseAgent');
const OptionChainService = require('../../../services/optionChain/OptionChainService');
const AIService = require('../../../services/ai/AIService');

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
   * Process the message and enhance it with option chain data
   */
  async processMessage(message, sessionId) {
    const optionRequest = this.isOptionChainRequest(message);
    
    if (!optionRequest.isOptionChainRequest) {
      console.log(`📋 OptionsAgent: No option data needed for this message`);
      return message;
    }

    console.log(`📊 OptionsAgent: Fetching option data for ${optionRequest.symbol}`);
    
    try {
      const optionData = await this.optionChainService.getOptionChain(optionRequest.symbol);
      
      // For testing purposes, only use the first option to avoid token overload
      const formattedData = this.optionChainService.formatFirstOptionOnly(optionData);
      
      console.log(`✅ OptionsAgent: Successfully formatted option data for ${optionRequest.symbol}`);
      
      // Enhance the message with option data context
      const enhancedMessage = `${message}\n\nHere's a sample from the latest option chain data:\n${formattedData}\n\nPlease analyze and explain this data in a helpful way. Note that this is just one option from the full chain for demonstration purposes.`;
      
      return enhancedMessage;
    } catch (error) {
      console.error(`❌ OptionsAgent: Failed to fetch option data for ${optionRequest.symbol}:`, error.message);
      
      // Return message with error context
      const errorMessage = `${message}\n\nI'm sorry, I'm currently unable to fetch live option chain data due to a technical issue. However, I can still help you understand options trading concepts, strategies, and answer any questions you have about options!`;
      
      return errorMessage;
    }
  }

  /**
   * Generate AI response with options-specific context and tools
   */
  async generateResponse(message, sessionId) {
    console.log(`🎯 OptionsAgent: Starting response generation for session: ${sessionId}`);
    
    try {
      // First process the message to add any option chain data
      const processedMessage = await this.processMessage(message, sessionId);
      
      // Create messages array with system prompt and processed message
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: processedMessage }
      ];

      console.log(`🤖 OptionsAgent: Calling AI service for response generation`);
      
      // Generate streaming response using the AI service
      const result = await this.aiService.generateStreamingResponse(messages);
      
      console.log(`✅ OptionsAgent: Successfully generated streaming response`);
      return result;
    } catch (error) {
      console.error(`❌ OptionsAgent: Error generating response:`, error.message);
      throw error;
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

Your responses should be informative, practical, and help traders make better-informed decisions while maintaining responsible trading practices.
`;

module.exports = OptionsAgent;
