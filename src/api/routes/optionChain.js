const express = require('express');
const OptionChainController = require('../controllers/OptionChainController');

const router = express.Router();
const optionChainController = new OptionChainController();

// Option chain endpoints
router.get('/symbols', optionChainController.getSupportedSymbols.bind(optionChainController));
router.get('/:symbol?', optionChainController.getOptionChain.bind(optionChainController));

module.exports = router;
