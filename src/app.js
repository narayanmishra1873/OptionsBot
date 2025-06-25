const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const apiRoutes = require('./api/routes/endpoints');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api', apiRoutes);

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
