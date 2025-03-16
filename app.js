const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json'; // Where we store the verified users

// Enable CORS for multiple origins
const ALLOWED_ORIGINS = [
  'https://scratch-image-hoster.netlify.app',
  'https://ubbload.netlify.app',
  'https://krxzykrxzy.github.io/Image-Hoster'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Configure image uploads
const upload = multer({ dest: 'images/', limits: { fileSize: 5 * 1024 * 1024 } });
app.use('/images', express.static(path.join(__dirname, 'images')));

// Load verified users from file
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Save verified users to file
function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Login - Generate code
app.post('/login', (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username required' });

  username = username.toLowerCase(); // Ensure consistency

  if (users[username]?.verified) {
    return res.json({ message: 'You are already verified! You can upload images.', verified: true });
  }

  const code = Math.random().toString(36).substring(2, 8);
  users[username] = { code, verified: false };
  saveUsers();

  res.json({ message: `Add this code to your Scratch bio: ${code}. This may take a few minutes to update.` });
});

// Verify code in Scratch bio
app.post('/verify', async (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Invalid username' });

  username = username.toLowerCase();
  if (!users[username]) return res.status(400).json({ message: 'User not found. Please login first.' });

  if (users[username].verified) {
    return res.json({ message: 'You are already verified!', verified: true });
  }

  try {
    const response = await axios.get(`https://api.scratch.mit.edu/users/${username}`);
    const bio = response.data.profile.bio;

    if (bio.includes(users[username].code)) {
      users[username].verified = true;
      saveUsers();
      res.json({ message: 'Verification successful', verified: true });
    } else {
      res.status(400).json({ message: 'Code not found in bio' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error checking profile' });
  }
});

// Image Upload
app.post('/upload', upload.single('image'), (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username required' });

  username = username.toLowerCase();
  if (!users[username]?.verified) return res.status(403).json({ message: 'Unauthorized' });

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const userDir = path.join(__dirname, 'images', username);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const targetPath = path.join(userDir, req.file.originalname);
  fs.rename(req.file.path, targetPath, (err) => {
    if (err) return res.status(500).json({ message: 'File upload failed' });

    const publicUrl = `https://image-hoster.onrender.com/images/${username}/${req.file.originalname}`;
    res.json({ message: 'Image uploaded successfully', url: publicUrl });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
