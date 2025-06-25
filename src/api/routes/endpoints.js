const express = require('express');
const ChatController = require('../controllers/ChatController');
const OptionChainController = require('../controllers/OptionChainController');

const router = express.Router();
const chatController = new ChatController();
const optionChainController = new OptionChainController();

// Chat endpoints
router.post('/chat', chatController.handleChat.bind(chatController));
router.delete('/chat/:sessionId', chatController.clearConversation.bind(chatController));
router.get('/chat/stats/:sessionId', chatController.getConversationStats.bind(chatController));
router.get('/agents', chatController.getAgentsInfo.bind(chatController));

// Option Chain endpoints
router.get('/option-chain/:symbol', optionChainController.getOptionChain.bind(optionChainController));

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
