const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Allowed front-end URLs
const allowedOrigins = [
  'https://scratch-image-hoster.netlify.app', 
  'https://ubbload.netlify.app',    
  'https://krxzykrxzy.github.io/Image-Hoster',    
  'https://ubbload.github.io' 
];

// Set up CORS middleware
const corsOptions = {
  origin: function (origin, callback) {
    console.log("Request Origin:", origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up multer storage for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// Serve uploaded videos
app.use('/uploads', express.static('uploads'));

// Video upload route
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  console.log('Uploaded file:', req.file);
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
