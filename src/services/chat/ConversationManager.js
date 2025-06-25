const config = require('../../config');

class ConversationManager {
  constructor() {
    // Store conversation history (in production, use a database)
    this.conversations = new Map();
    this.maxConversationLength = config.session.maxConversationLength;
  }

  /**
   * Get or create conversation history for a session
   */
  getConversation(sessionId, systemPrompt) {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, [
        { role: 'system', content: systemPrompt }
      ]);
    }
    
    return this.conversations.get(sessionId);
  }

  /**
   * Add a message to the conversation
   */
  addMessage(sessionId, role, content, systemPrompt) {
    const messages = this.getConversation(sessionId, systemPrompt);
    
    // Add the new message
    messages.push({ role, content });
    
    // Trim conversation if it gets too long
    this.trimConversation(sessionId, systemPrompt);
    
    return messages;
  }

  /**
   * Update the last user message (used for agent enhancement)
   */
  updateLastUserMessage(sessionId, newContent, systemPrompt) {
    const messages = this.getConversation(sessionId, systemPrompt);
    
    // Find the last user message and update it
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i].content = newContent;
        break;
      }
    }
    
    return messages;
  }

  /**
   * Trim conversation to maintain reasonable length
   */
  trimConversation(sessionId, systemPrompt) {
    const messages = this.getConversation(sessionId, systemPrompt);
    
    if (messages.length > this.maxConversationLength) {
      // Keep the system message and the most recent messages
      const systemMessage = messages[0];
      const recentMessages = messages.slice(-this.maxConversationLength + 1);
      
      this.conversations.set(sessionId, [systemMessage, ...recentMessages]);
    }
  }

  /**
   * Clear conversation history for a session
   */
  clearConversation(sessionId) {
    this.conversations.delete(sessionId);
    return true;
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(sessionId) {
    const messages = this.conversations.get(sessionId);
    if (!messages) {
      return { messageCount: 0, hasHistory: false };
    }

    return {
      messageCount: messages.length,
      hasHistory: true,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.conversations.keys());
  }
}

module.exports = ConversationManager;
