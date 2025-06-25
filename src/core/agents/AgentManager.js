const OptionsAgent = require('./specialized/OptionsAgent');
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
    this.agents.push(new OptionsAgent());
    this.agents.push(new GeneralFinanceAgent());
    
    console.log(`✅ Initialized ${this.agents.length} agents:`, 
      this.agents.map(agent => agent.name).join(', '));
  }

  /**
   * Get the system prompt for the Agent Manager
   */
  getAgentManagerSystemPrompt() {
    return `You are an intelligent Agent Manager responsible for selecting the most appropriate specialized agent to handle user queries about finance and trading.

Available Agents:
1. OptionsAgent - Handles queries about options trading, option chains, derivatives, strike prices, expiry dates, volatility, Greeks, options strategies, NSE options data, NIFTY/BANKNIFTY options, put-call ratios, open interest analysis
2. GeneralFinanceAgent - Handles general finance questions, stock market basics, investment advice, portfolio management, fundamental analysis, technical analysis, market trends, financial planning

Your task is to analyze the user's message and respond with ONLY the name of the most appropriate agent:
- Respond with "OptionsAgent" for options-related queries
- Respond with "GeneralFinanceAgent" for general finance queries

Consider keywords, context, and intent. Be precise in your selection.

Respond with ONLY the agent name, nothing else.`;
  }

  /**
   * Use AI to intelligently select the best agent
   */
  async selectAgent(message) {
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Select the appropriate agent for this message: "${message}"` }
      ];

      const selectedAgentName = await this.aiService.generateResponse(messages);
      const trimmedName = selectedAgentName.trim();
      
      // Find the agent by name
      const selectedAgent = this.agents.find(agent => 
        agent.name === trimmedName && agent.isActive
      );

      if (selectedAgent) {
        console.log(`🤖 AI selected agent: ${selectedAgent.name} for message: "${message.substring(0, 50)}..."`);
        return selectedAgent;
      }

      // Fallback to default agent if AI selection fails
      console.log(`⚠️ AI selection failed or agent not found. Using GeneralFinanceAgent as fallback.`);
      return this.agents.find(agent => agent.name === 'GeneralFinanceAgent') || this.agents[0];
      
    } catch (error) {
      console.error('Error in AI agent selection:', error);
      // Fallback to GeneralFinanceAgent
      return this.agents.find(agent => agent.name === 'GeneralFinanceAgent') || this.agents[0];
    }
  }

  /**
   * Process a message using the appropriate agent
   */
  async processMessage(message, sessionId = 'default') {
    const selectedAgent = await this.selectAgent(message);
    
    if (!selectedAgent) {
      throw new Error('No agent available to handle this message');
    }

    // Let the agent generate its own response
    const agentResponse = await selectedAgent.generateResponse(message, sessionId);
    
    return {
      agent: selectedAgent.name,
      response: agentResponse,
      originalMessage: message
    };
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
