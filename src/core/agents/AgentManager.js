const OptionsAgent = require('./specialized/OptionsAgent');
const GeneralFinanceAgent = require('./specialized/GeneralFinanceAgent');

class AgentManager {
  constructor() {
    this.agents = [];
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
   * Find the best agent to handle a message
   */
  selectAgent(message) {
    const availableAgents = this.agents.filter(agent => 
      agent.isActive && agent.canHandle(message)
    );

    if (availableAgents.length === 0) {
      // Default to GeneralFinanceAgent if no specific agent can handle it
      return this.agents.find(agent => agent.name === 'GeneralFinanceAgent');
    }

    // Sort by priority (highest first)
    availableAgents.sort((a, b) => b.getPriority(message) - a.getPriority(message));
    
    console.log(`🤖 Selected agent: ${availableAgents[0].name} for message: "${message.substring(0, 50)}..."`);
    
    return availableAgents[0];
  }

  /**
   * Process a message using the appropriate agent
   */
  async processMessage(message, sessionId = 'default') {
    const selectedAgent = this.selectAgent(message);
    
    if (!selectedAgent) {
      throw new Error('No agent available to handle this message');
    }

    // Process the message with the selected agent
    const processedMessage = await selectedAgent.processMessage(message, sessionId);
    
    return {
      agent: selectedAgent.name,
      systemPrompt: selectedAgent.getSystemPrompt(),
      processedMessage,
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
