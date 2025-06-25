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
  getConversation(sessionId) {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    
    return this.conversations.get(sessionId);
  }

  /**
   * Add a message to the conversation
   */
  addMessage(sessionId, role, content) {
    const messages = this.getConversation(sessionId);
    
    // Add the new message
    messages.push({ role, content, timestamp: new Date().toISOString() });
    
    console.log(`💾 ConversationManager: Added ${role} message to session: ${sessionId} (total: ${messages.length})`);
    
    // Trim conversation if it gets too long
    this.trimConversation(sessionId);
    
    return messages;
  }

  /**
   * Update the last user message (used for agent enhancement)
   */
  updateLastUserMessage(sessionId, newContent) {
    const messages = this.getConversation(sessionId);
    
    // Find the last user message and update it
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i].content = newContent;
        messages[i].timestamp = new Date().toISOString();
        break;
      }
    }
    
    return messages;
  }

  /**
   * Trim conversation to maintain reasonable length
   */
  trimConversation(sessionId) {
    const messages = this.getConversation(sessionId);
    
    if (messages.length > this.maxConversationLength) {
      // Keep the most recent messages
      const recentMessages = messages.slice(-this.maxConversationLength);
      this.conversations.set(sessionId, recentMessages);
    }
  }

  /**
   * Clear conversation history for a session
   */
  clearConversation(sessionId) {
    const existed = this.conversations.has(sessionId);
    this.conversations.delete(sessionId);
    
    if (existed) {
      console.log(`🗑️ ConversationManager: Cleared conversation for session: ${sessionId}`);
    }
    
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
