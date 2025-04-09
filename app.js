const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const IMAGES_DIR = path.join(__dirname, 'public/images');

app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let users = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {}
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const username = req.body.username?.toLowerCase();
    if (!username) return cb(new Error('Username is required'));

    const userPath = path.join(IMAGES_DIR, username);
    fs.mkdirSync(userPath, { recursive: true });
    cb(null, userPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username required' });

  const uname = username.toLowerCase();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ip = req.ip;

  users[uname] = { code, ip, verified: false };
  saveUsers();

  res.json({ success: true, message: `Add this code to your Scratch bio: ${code}` });
});

app.post('/verify', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username required' });

  const uname = username.toLowerCase();
  const user = users[uname];
  if (!user) return res.status(404).json({ message: 'Please generate a code first.' });

  const ip = req.ip;
  if (ip !== user.ip) return res.status(403).json({ message: 'Access denied. IP mismatch.' });

  try {
    const response = await axios.get(`https://api.scratch.mit.edu/users/${uname}`);
    const bio = response.data?.profile?.bio || '';

    if (bio.includes(user.code)) {
      users[uname].verified = true;
      saveUsers();
      return res.json({ success: true, message: 'Verification successful' });
    } else {
      return res.status(400).json({ message: 'Code not found in bio' });
    }
  } catch {
    return res.status(500).json({ message: 'Error verifying Scratch profile' });
  }
});

app.post('/upload', upload.single('image'), (req, res) => {
  const username = req.body.username?.toLowerCase();
  const user = users[username];
  if (!username || !user?.verified || user.ip !== req.ip) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const fileUrl = `/images/${username}/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
