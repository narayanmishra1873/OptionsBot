const BaseAgent = require('../BaseAgent');
const AIService = require('../../../services/ai/AIService');

class GeneralFinanceAgent extends BaseAgent {
  constructor() {
    super('GeneralFinanceAgent', SYSTEM_PROMPT);
    this.aiService = new AIService();
  }

  /**
   * Process the message - no special processing needed for general finance
   */
  async processMessage(message, sessionId) {
    console.log(`📋 GeneralFinanceAgent: Processing general finance query for session: ${sessionId}`);
    return message;
  }

  /**
   * Generate AI response for general finance queries
   */
  async generateResponse(message, sessionId) {
    console.log(`💼 GeneralFinanceAgent: Starting response generation for session: ${sessionId}`);
    
    try {
      // Process the message (currently no special processing for general finance)
      const processedMessage = await this.processMessage(message, sessionId);
      
      // Create messages array with system prompt and processed message
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: processedMessage }
      ];

      console.log(`🤖 GeneralFinanceAgent: Calling AI service for response generation`);
      
      // Generate streaming response using the AI service
      const result = await this.aiService.generateStreamingResponse(messages);
      
      console.log(`✅ GeneralFinanceAgent: Successfully generated streaming response`);
      return result;
    } catch (error) {
      console.error(`❌ GeneralFinanceAgent: Error generating response:`, error.message);
      throw error;
    }
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
