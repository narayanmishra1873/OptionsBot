const AgentManager = require('../../core/agents/AgentManager');
const ConversationManager = require('../../services/chat/ConversationManager');

class ChatController {
  constructor() {
    this.agentManager = new AgentManager();
    this.conversationManager = new ConversationManager();
  }

  /**
   * Handle chat messages
   */
  async handleChat(req, res) {
    try {
      const { message, sessionId = 'default' } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Add user message to conversation history
      this.conversationManager.addMessage(sessionId, 'user', message);

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Process message with appropriate agent and get streaming response
      const agentResult = await this.agentManager.processMessage(message, sessionId);
      
      let fullResponse = '';
      
      // Stream the response from the agent
      for await (const delta of agentResult.response.textStream) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ delta, agent: agentResult.agent })}\n\n`);
      }

      // Add assistant message to conversation history
      this.conversationManager.addMessage(sessionId, 'assistant', fullResponse);

      // Send final message and close stream
      res.write(`data: ${JSON.stringify({ 
        done: true, 
        fullResponse,
        agent: agentResult.agent,
        conversationStats: this.conversationManager.getConversationStats(sessionId)
      })}\n\n`);
      res.end();

    } catch (error) {
      console.error('Chat error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
        res.end();
      }
    }
  }

  /**
   * Clear conversation history
   */
  async clearConversation(req, res) {
    try {
      const { sessionId } = req.params;
      
      const success = this.conversationManager.clearConversation(sessionId);
      
      res.json({ 
        success,
        message: success ? 'Conversation cleared' : 'Conversation not found'
      });
    } catch (error) {
      console.error('Clear conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(req, res) {
    try {
      const { sessionId } = req.params;
      
      const stats = this.conversationManager.getConversationStats(sessionId);
      
      res.json(stats);
    } catch (error) {
      console.error('Get conversation stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get agent information
   */
  async getAgentsInfo(req, res) {
    try {
      const agentsInfo = this.agentManager.getAgentsInfo();
      
      res.json({
        agents: agentsInfo,
        activeAgents: agentsInfo.filter(agent => agent.isActive).length,
        totalAgents: agentsInfo.length
      });
    } catch (error) {
      console.error('Get agents info error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = ChatController;
