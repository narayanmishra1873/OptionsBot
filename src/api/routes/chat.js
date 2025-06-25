const express = require('express');
const ChatController = require('../controllers/ChatController');

const router = express.Router();
const chatController = new ChatController();

// Chat endpoints
router.post('/', chatController.handleChat.bind(chatController));
router.delete('/:sessionId', chatController.clearConversation.bind(chatController));
router.get('/stats/:sessionId', chatController.getConversationStats.bind(chatController));
router.get('/agents', chatController.getAgentsInfo.bind(chatController));

module.exports = router;
