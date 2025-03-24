const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json';

// Enable JSON and URL-encoded parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html, login.html, etc.)
app.use(express.static(path.join(__dirname)));

// Serve uploaded images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const username = req.body.username.toLowerCase();
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

const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Load existing users from file
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Save users to file
const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Login endpoint
app.post('/login', (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username required' });

  username = username.toLowerCase();
  if (users[username]?.verified) {
    return res.json({ message: 'You are already verified!' });
  }

  const code = Math.random().toString(36).substring(2, 8);
  users[username] = { code, verified: false };
  saveUsers();

  res.json({
    message: `Add this code to your Scratch bio: ${code}. This may take a few minutes to update.`
  });
});

// Verification endpoint
app.post('/verify', async (req, res) => {
  let { username } = req.body;
  username = username.toLowerCase();
  if (!users[username]) {
    return res.status(400).json({ message: 'User not found. Please login first.' });
  }

  try {
    const response = await axios.get(`https://api.scratch.mit.edu/users/${username}`);
    const bio = response.data.profile.bio;
    if (bio.includes(users[username].code)) {
      users[username].verified = true;
      saveUsers();
      res.json({ message: 'Verification successful' });
    } else {
      res.status(400).json({ message: 'Code not found in bio' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error checking profile' });
  }
});

// Image upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
  const { username } = req.body;
  if (!users[username]?.verified) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  const publicUrl = `/images/${username}/${req.file.filename}`;
  res.json({ message: 'Image uploaded successfully', url: publicUrl });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
