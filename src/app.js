const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const chatRoutes = require('./api/routes/chat');
const optionChainRoutes = require('./api/routes/optionChain');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/option-chain', optionChainRoutes);

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = app;
