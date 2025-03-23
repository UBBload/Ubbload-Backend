const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json';

// Allowed front-end URLs
const ALLOWED_ORIGINS = [
  'https://scratch-image-hoster.netlify.app',
  'https://ubbload.netlify.app',
  'https://ubbload.github.io'
];

// ✅ Enable CORS with Debug Logging
app.use(cors({
  origin: function (origin, callback) {
    console.log('Origin:', origin || 'No origin provided'); // Log origin for debugging
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Handle preflight requests for all routes
app.options('*', cors());

// ✅ Parse JSON and URL-encoded data
app.use(express.json()); // Handle JSON payloads
app.use(express.urlencoded({ extended: true })); // Handle URL-encoded payloads

// ✅ Serve static images with CORS enabled
app.use('/images', cors(), express.static(path.join(__dirname, 'images')));

// ✅ Configure image uploads with error handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const username = req.body?.username?.toLowerCase(); // Handle missing username safely
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max file size
});

// ✅ Load existing users from file
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// ✅ Save users to file
const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// ===============================
// ✅ Login - Generate verification code
// ===============================
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
    message: `Add this code to your Scratch bio: ${code}. This may take a few minutes to update.`,
  });
});

// ===============================
// ✅ Verify Scratch bio
// ===============================
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
    console.error('Error checking profile:', error.message);
    res.status(500).json({ message: 'Error checking profile' });
  }
});

// ===============================
// ✅ Upload image
// ===============================
app.post('/upload', upload.single('image'), (req, res) => {
  console.log('Request Body:', req.body); // Log request body for debugging

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

// ===============================
// ✅ Handle invalid CORS requests
// ===============================
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    console.error('CORS error:', err.message);
    return res.status(403).json({ message: 'CORS not allowed for this origin' });
  }
  next(err);
});

// ===============================
// ✅ Start the server
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
