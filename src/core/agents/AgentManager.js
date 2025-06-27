const BearPutSpreadAgent = require('./specialized/BearPutSpreadAgent');
const GeneralFinanceAgent = require('./specialized/GeneralFinanceAgent');
const AIService = require('../../services/ai/AIService');

class AgentManager {
  constructor() {
    this.agents = [];
    this.aiService = new AIService();
    this.systemPrompt = this.getAgentManagerSystemPrompt();
    this.initializeAgents();
  }

  /**
   * Initialize all available agents
   */
  initializeAgents() {
    // Add specialized agents
    this.agents.push(new BearPutSpreadAgent());
    this.agents.push(new GeneralFinanceAgent());
    
    console.log(`✅ Initialized ${this.agents.length} agents:`, 
      this.agents.map(agent => agent.name).join(', '));
  }

  /**
   * Get the system prompt for the Agent Manager
   */
  getAgentManagerSystemPrompt() {
    return `You are an intelligent Agent Manager responsible for routing user queries to the most appropriate specialized financial agent. You must analyze each user message and select the correct agent based on the query content and intent.

🎯 AVAILABLE AGENTS:

1. BearPutSpreadAgent - SELECT FOR:
   - ANY mention of options, derivatives, option chains, strikes, expiry
   - Queries about puts, calls, option strategies (straddles, strangles, spreads)
   - Requests for downside protection, hedging with options
   - Questions about option Greeks (delta, gamma, theta, vega)
   - Option chain analysis, strike selection, open interest
   - Volatility trading, IV analysis, max pain theory
   - NSE derivatives (NIFTY, BANKNIFTY, FINNIFTY options)
   - Specific percentage drops or target values for option analysis
   - Keywords: "options", "puts", "calls", "strikes", "expiry", "hedging", "downside", "option chain", "Greeks", "derivatives"

2. GeneralFinanceAgent - SELECT FOR:
   - Stock market basics, investment advice, portfolio management
   - Equity research, fundamental/technical analysis
   - Mutual funds, SIPs, systematic investing
   - Market trends, sector analysis, economic indicators
   - Personal finance planning, wealth management
   - General trading strategies (not options-specific)
   - Financial planning, tax strategies, insurance
   - Keywords: "stocks", "investment", "portfolio", "SIP", "mutual funds", "market", "finance", "planning"

🔍 ROUTING LOGIC:
- If the message contains ANY options/derivatives keywords or concepts → "BearPutSpreadAgent"
- If asking about current NIFTY/BANKNIFTY values or live market data → "BearPutSpreadAgent"
- If asking about percentage drops WITH context of options/hedging → "BearPutSpreadAgent"  
- If asking about target values WITH context of option strategies → "BearPutSpreadAgent"
- For all other finance/investment queries → "GeneralFinanceAgent"
- When in doubt between agents, prefer BearPutSpreadAgent if ANY options context exists

📋 RESPONSE FORMAT:
- Respond with ONLY the agent name: "BearPutSpreadAgent" or "GeneralFinanceAgent"
- Do NOT include any explanation, punctuation, or additional text
- Be precise and consistent in your selection

Analyze the user message carefully and respond with the appropriate agent name only.`;
  }

  /**
   * Use AI to intelligently select the best agent
   */
  async selectAgent(message) {
    console.log(`🔍 AgentManager: Selecting agent for message: "${message.substring(0, 50)}..."`);
    
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Select the appropriate agent for this message: "${message}"` }
      ];

      const selectedAgentName = await this.aiService.generateResponse(messages);
      const trimmedName = selectedAgentName.trim();
      
      console.log(`🎯 AgentManager: AI suggested agent: ${trimmedName}`);
      
      // Find the agent by name
      const selectedAgent = this.agents.find(agent => 
        agent.name === trimmedName && agent.isActive
      );

      if (selectedAgent) {
        console.log(`✅ AgentManager: Successfully selected ${selectedAgent.name}`);
        return selectedAgent;
      }

      // Fallback to default agent if AI selection fails
      console.log(`⚠️ AgentManager: Agent '${trimmedName}' not found or inactive. Using GeneralFinanceAgent as fallback.`);
      return this.agents.find(agent => agent.name === 'GeneralFinanceAgent') || this.agents[0];
      
    } catch (error) {
      console.error('❌ AgentManager: Error in AI agent selection:', error.message);
      const fallbackAgent = this.agents.find(agent => agent.name === 'GeneralFinanceAgent') || this.agents[0];
      console.log(`🔄 AgentManager: Using fallback agent: ${fallbackAgent?.name}`);
      return fallbackAgent;
    }
  }

  /**
   * Process a message using the appropriate agent
   */
  async processMessage(message, sessionId = 'default', conversationHistory = []) {
    console.log(`📨 AgentManager: Processing message for session: ${sessionId}`);
    console.log(`📚 AgentManager: Received ${conversationHistory.length} messages from conversation history for session: ${sessionId}`);
    
    const selectedAgent = await this.selectAgent(message);
    
    if (!selectedAgent) {
      console.error('❌ AgentManager: No agent available to handle message');
      throw new Error('No agent available to handle this message');
    }

    console.log(`🚀 AgentManager: Delegating to ${selectedAgent.name} for response generation`);
    
    try {
      // Let the agent generate its own response with conversation history
      console.log(`🔄 AgentManager: Calling ${selectedAgent.name}.generateResponse() with conversation history`);
      const agentResponse = await selectedAgent.generateResponse(message, sessionId, conversationHistory);
      
      console.log(`✅ AgentManager: Successfully got response from ${selectedAgent.name}`, {
        hasResponse: !!agentResponse,
        hasTextStream: !!agentResponse?.textStream,
        responseType: typeof agentResponse
      });
      
      return {
        agent: selectedAgent.name,
        response: agentResponse,
        originalMessage: message
      };
    } catch (error) {
      console.error(`❌ AgentManager: Error getting response from ${selectedAgent.name}:`, error.message);
      console.error(`❌ AgentManager: Error stack:`, error.stack);
      throw error;
    }
  }

  /**
   * Get information about all agents
   */
  getAgentsInfo() {
    return this.agents.map(agent => agent.getMetadata());
  }

  /**
   * Get a specific agent by name
   */
  getAgent(name) {
    return this.agents.find(agent => agent.name === name);
  }

  /**
   * Add a new agent
   */
  addAgent(agent) {
    this.agents.push(agent);
    console.log(`➕ Added new agent: ${agent.name}`);
  }

  /**
   * Remove an agent
   */
  removeAgent(name) {
    const index = this.agents.findIndex(agent => agent.name === name);
    if (index !== -1) {
      this.agents.splice(index, 1);
      console.log(`➖ Removed agent: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Enable or disable an agent
   */
  setAgentActive(name, isActive) {
    const agent = this.getAgent(name);
    if (agent) {
      agent.setActive(isActive);
      console.log(`🔄 Set agent ${name} to ${isActive ? 'active' : 'inactive'}`);
      return true;
    }
    return false;
  }
}

module.exports = AgentManager;
