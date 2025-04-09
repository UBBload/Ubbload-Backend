const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json';

// Middleware to get real IP address
app.set('trust proxy', true); // Important if behind proxy like Vercel or Render

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Load users from file
let users = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (err) {
    console.error("Error reading users.json:", err.message);
  }
}

const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// --- LOGIN ---
app.post('/login', (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ message: "Username required" });

  username = username.toLowerCase();
  const ip = req.ip;

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  users[username] = {
    code,
    ip,
    verified: false
  };
  saveUsers();

  res.json({
    success: true,
    message: `Add this code to your Scratch bio: ${code}`
  });
});

// --- VERIFY ---
app.post('/verify', async (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ message: "Username required" });

  username = username.toLowerCase();
  const user = users[username];
  if (!user) return res.status(404).json({ message: "Please generate a code first." });

  const ip = req.ip;
  if (ip !== user.ip) {
    return res.status(403).json({ message: "Access denied. IP mismatch." });
  }

  try {
    const response = await axios.get(`https://api.scratch.mit.edu/users/${username}`);
    const bio = response.data?.
