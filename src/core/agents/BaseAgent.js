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
   * Check if this agent can handle the given message
   * Override this method in child classes
   */
  canHandle(message) {
    return false;
  }

  /**
   * Get the priority of this agent for handling a message
   * Higher numbers indicate higher priority
   * Override this method in child classes
   */
  getPriority(message) {
    return 0;
  }

  /**
   * Process the message and return enhanced context
   * Override this method in child classes
   */
  async processMessage(message, sessionId) {
    return message;
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
