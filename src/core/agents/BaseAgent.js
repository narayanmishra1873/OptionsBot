class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.isActive = true;
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
   * Must be implemented by child classes
   */
  async generateResponse(message, sessionId) {
    throw new Error(`generateResponse method must be implemented by ${this.name}`);
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
