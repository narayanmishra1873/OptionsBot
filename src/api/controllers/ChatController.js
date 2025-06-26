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
    const { message, sessionId = 'default' } = req.body;
    console.log(`💬 ChatController: New chat request for session: ${sessionId}`);

    try {
      if (!message) {
        console.log(`⚠️ ChatController: Missing message in request`);
        return res.status(400).json({ error: 'Message is required' });
      }

      console.log(`📝 ChatController: Processing message: "${message.substring(0, 50)}..."`);

      // Add user message to conversation history
      this.conversationManager.addMessage(sessionId, 'user', message);

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      console.log(`🔄 ChatController: Starting agent processing`);

      // Process message with appropriate agent and get streaming response
      const agentResult = await this.agentManager.processMessage(message, sessionId);
      console.log(`🤖 ChatController: Agent result received:`, {
        agent: agentResult.agent,
        hasResponse: !!agentResult.response,
        hasTextStream: !!agentResult.response?.textStream
      });
      
      let fullResponse = '';
      console.log(`📡 ChatController: Starting response streaming with ${agentResult.agent}`);
      
      // Stream the response from the agent
      let deltaCount = 0;
      for await (const delta of agentResult.response.textStream) {
        deltaCount++;
        //console.log(`📤 ChatController: Streaming delta ${deltaCount}: "${delta.substring(0, 100)}..."`);
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ delta, agent: agentResult.agent })}\n\n`);
      }
      console.log(`📊 ChatController: Finished streaming, total deltas: ${deltaCount}, response length: ${fullResponse.length}`);

      // Add assistant message to conversation history
      this.conversationManager.addMessage(sessionId, 'assistant', fullResponse);

      console.log(`✅ ChatController: Successfully completed chat for session: ${sessionId}`);

      // Send final message and close stream
      res.write(`data: ${JSON.stringify({ 
        done: true, 
        fullResponse,
        agent: agentResult.agent,
        conversationStats: this.conversationManager.getConversationStats(sessionId)
      })}\n\n`);
      res.end();

    } catch (error) {
      console.error(`❌ ChatController: Error in chat handling for session ${sessionId}:`, error.message);
      
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
