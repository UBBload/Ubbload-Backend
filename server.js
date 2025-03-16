const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');  // Add fs to check folder existence
const cors = require('cors');  // Import the cors package
const app = express();
const port = 3000;

// Define allowed front-end URLs (you can modify these)
const allowedOrigins = [
  'https://scratch-image-hoster.netlify.app', 
  'https://ubbload.netlify.app',    
  'https://krxzykrxzy.github.io/Image-Hoster',    
  'https://ubbload.github.io' 
];

// Set up CORS middleware to allow specific origins
const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);  // Allow the request if the origin is in the allowed list or if no origin is provided (for local requests)
    } else {
      callback(new Error('Not allowed by CORS'));  // Reject the request if the origin is not in the allowed list
    }
  },
  methods: ['GET', 'POST'], // Allow specific HTTP methods 
};

// Enable CORS with the options
app.use(cors(corsOptions));

// Ensure uploads folder exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up multer storage for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);  // Directory to store uploaded videos
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));  // Name the file with a timestamp
  }
});

const upload = multer({ storage: storage });

// Serve static files from the root directory and the uploads folder
app.use(express.static(__dirname));  // Serve everything from the root folder, including index.html
app.use('/uploads', express.static('uploads'));  // Serve uploaded videos

// Route to handle video file upload
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  console.log('Uploaded file:', req.file);  // Log the uploaded file details
  res.json({ filePath: `/uploads/${req.file.filename}` });  // Return the file path for the uploaded video
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
