const express = require('express');
const bodyParser = require('body-parser');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const app = express();
const git = simpleGit();

app.use(bodyParser.json());

app.post('/create-site', async (req, res) => {
    const { repoUrl } = req.body;

    if (!repoUrl) {
        return res.status(400).json({ message: 'Repository URL is required.' });
    }

    const siteFolder = path.join(__dirname, 'sites', Date.now().toString());

    try {
        await git.clone(repoUrl, siteFolder);

        const siteDestinationFolder = path.join(__dirname, 'websites', Date.now().toString());
        fs.mkdirSync(siteDestinationFolder, { recursive: true });

        const files = fs.readdirSync(siteFolder);
        files.forEach(file => {
            const filePath = path.join(siteFolder, file);
            const destPath = path.join(siteDestinationFolder, file);
            fs.copyFileSync(filePath, destPath);
        });

        fs.rmdirSync(siteFolder, { recursive: true });

        return res.status(200).json({ message: 'Website created successfully!', siteUrl: `/websites/${Date.now()}` });
    } catch (error) {
        console.error('Error creating website:', error);
        return res.status(500).json({ message: 'Error creating website.' });
    }
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
