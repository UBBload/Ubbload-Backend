// server.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json';

const ALLOWED_ORIGINS = [
  'https://scratch-image-hoster.netlify.app',
  'https://ubbload.netlify.app',
  'https://ubbload.github.io'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Load users from file or initialize
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Save user data to file
const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const username = req.body?.username?.toLowerCase();
    if (!username) {
      return cb(new Error('Username is required'));
    }
    const userDir = path.join(__dirname, 'images', username);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

// --- LOGIN API ---
app.post('/login', (req, res) => {
  let { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username required' });
  }

  username = username.toLowerCase();
  if (users[username]?.verified) {
    return res.json({ message: 'You are already verified!', verified: true });
  }

  const code = Math.random().toString(36).substring(2, 8);
  users[username] = { code, verified: false };
  saveUsers();

  res.json({
    success: true,
    message: `Add this code to your Scratch bio: ${code}. This may take a few minutes to update.`
  });
});

// --- VERIFY API ---
app.post('/verify', async (req, res) => {
  let { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Invalid username' });
  }

  username = username.toLowerCase();
  if (!users[username]) {
    return res.status(400).json({ message: 'User not found. Please login first.' });
  }

  if (users[username].verified) {
    return res.json({ success: true, message: 'You are already verified!', verified: true });
  }

  try {
    const response = await axios.get(`https://api.scratch.mit.edu/users/${username}`);
    const bio = response.data.profile.bio;

    if (bio.includes(users[username].code)) {
      users[username].verified = true;
      saveUsers();
      res.json({ success: true, message: 'Verification successful', verified: true });
    } else {
      res.status(400).json({ message: 'Code not found in bio' });
    }
  } catch (error) {
    console.error('Error checking profile:', error.message);
    res.status(500).json({ message: 'Error checking profile' });
  }
});

// --- UPLOAD API ---
app.post('/upload', upload.single('image'), (req, res) => {
  let { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username required' });
  }

  username = username.toLowerCase();
  if (!users[username]?.verified) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const publicUrl = `https://image-hoster.onrender.com/images/${username}/${req.file.filename}`;
  res.json({ message: 'Image uploaded successfully', url: publicUrl });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    console.error('CORS error:', err.message);
    return res.status(403).json({ message: 'CORS not allowed for this origin' });
  }
  next(err);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
