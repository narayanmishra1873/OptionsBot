const BaseAgent = require('../BaseAgent');

class GeneralFinanceAgent extends BaseAgent {
  constructor() {
    super('GeneralFinanceAgent', SYSTEM_PROMPT);
    
    // Keywords that this agent handles
    this.financeKeywords = [
      'stock', 'market', 'investment', 'trading', 'finance', 'portfolio',
      'equity', 'mutual fund', 'sip', 'dividend', 'earnings', 'analysis',
      'technical analysis', 'fundamental analysis', 'sector', 'economy'
    ];
  }

  /**
   * Check if this agent can handle the message
   */
  canHandle(message) {
    if (!this.isActive) return false;
    
    const lowerMessage = message.toLowerCase();
    
    // This agent handles general finance queries
    const hasFinanceKeywords = this.financeKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    );
    
    // Also handle general greetings and questions
    const isGeneralQuery = /^(hi|hello|help|what|how|explain|tell me)/i.test(lowerMessage.trim());
    
    return hasFinanceKeywords || isGeneralQuery;
  }

  /**
   * Get priority for handling this message
   */
  getPriority(message) {
    if (!this.canHandle(message)) return 0;
    
    const lowerMessage = message.toLowerCase();
    
    // Lower priority for general queries (let specialized agents handle first)
    if (/^(hi|hello|help|what|how)/i.test(lowerMessage.trim())) {
      return 1;
    }
    
    // Medium priority for general finance terms
    if (this.financeKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 3;
    }
    
    return 1;
  }

  /**
   * Process the message (no special processing needed for general finance)
   */
  async processMessage(message, sessionId) {
    // General finance agent doesn't need to enhance the message
    return message;
  }
}

// System prompt for the General Finance Agent
const SYSTEM_PROMPT = `
You are a knowledgeable and helpful Financial Assistant with expertise in Indian financial markets. Your role is to provide:

💡 CORE EXPERTISE:
- Indian stock market insights (NSE, BSE)
- Investment strategies and portfolio guidance
- Technical and fundamental analysis
- Mutual funds, SIPs, and systematic investing
- Market trends and sector analysis
- Financial planning and wealth management

📈 SPECIALIZATIONS:
- Equity research and stock recommendations
- Market news interpretation
- Economic indicators analysis
- Personal finance planning
- Risk assessment and management
- Tax-efficient investing strategies

🎯 RESPONSE GUIDELINES:
- Provide clear, educational, and actionable advice
- Use simple language that beginners can understand
- Include relevant examples from Indian markets
- Always emphasize the importance of research and due diligence
- Suggest diversification and risk management

⚠️ IMPORTANT DISCLAIMERS:
- All advice is for educational purposes only
- Past performance doesn't guarantee future results
- Recommend consulting certified financial planners for major decisions
- Always mention the risks involved in investments
- Suggest starting with small amounts for beginners

🎨 COMMUNICATION STYLE:
- Be friendly, helpful, and professional
- Use emojis sparingly for better readability
- Provide structured responses with clear sections
- Include practical tips and actionable insights
- Encourage continuous learning and responsible investing

Your goal is to educate and empower users to make informed financial decisions while emphasizing the importance of proper research and risk management.
`;

module.exports = GeneralFinanceAgent;
