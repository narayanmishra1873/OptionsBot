const AIService = require('../../services/ai/AIService');

class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.isActive = true;
    this.aiService = new AIService();
  }

  /**
   * Get the system prompt for this agent
   */
  getSystemPrompt() {
    return this.systemPrompt;
  }

  /**
   * Process the message and return enhanced context
   * Override this method in child classes
   */
  async processMessage(message, sessionId) {
    return message;
  }

  /**
   * Generate a streaming AI response using this agent's capabilities
   */
  async generateResponse(message, sessionId) {
    try {
      // First process the message to add any agent-specific context
      const processedMessage = await this.processMessage(message, sessionId);
      
      // Create messages array with system prompt and user message
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: processedMessage }
      ];

      // Generate streaming response
      const result = await this.aiService.generateStreamingResponse(messages);
      
      return result;
    } catch (error) {
      console.error(`Error generating response in ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      name: this.name,
      isActive: this.isActive,
      type: this.constructor.name,
    };
  }

  /**
   * Enable or disable the agent
   */
  setActive(isActive) {
    this.isActive = isActive;
  }
}

module.exports = BaseAgent;
