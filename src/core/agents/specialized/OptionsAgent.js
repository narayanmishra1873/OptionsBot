const BaseAgent = require('../BaseAgent');
const OptionChainService = require('../../../services/optionChain/OptionChainService');

class OptionsAgent extends BaseAgent {
  constructor() {
    super('OptionsAgent', SYSTEM_PROMPT);
    this.optionChainService = new OptionChainService();
    
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
      return message;
    }

    try {
      console.log(`Fetching option chain data for ${optionRequest.symbol}...`);
      const optionData = await this.optionChainService.getOptionChain(optionRequest.symbol);
      const formattedData = this.optionChainService.formatOptionChainData(optionData);
      
      // Enhance the message with option data context
      const enhancedMessage = `${message}\n\nHere's the latest option chain data:\n${formattedData}\n\nPlease analyze and explain this data in a helpful way.`;
      
      return enhancedMessage;
    } catch (error) {
      console.error('Error fetching option data:', error);
      
      // Return message with error context
      const errorMessage = `${message}\n\nI'm sorry, I'm currently unable to fetch live option chain data due to a technical issue. However, I can still help you understand options trading concepts, strategies, and answer any questions you have about options!`;
      
      return errorMessage;
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
