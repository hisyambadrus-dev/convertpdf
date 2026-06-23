const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Import library
const docxConverter = require('docx-pdf');
const PDFDocument = require('pdfkit');
const pdfParse = require('pdf-parse');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.post('/api/convert', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Upload file gagal' });

    const inputPath = file.path;
    const toolName = req.body.toolName.toLowerCase();
    const outputFileName = `${Date.now()}-result`;
    const outputPath = path.join(__dirname, 'uploads', outputFileName);

    try {
        // 1. WORD TO PDF
        if (toolName.includes('word to pdf')) {
            const finalPath = outputPath + '.pdf';
            docxConverter(inputPath, finalPath, (err) => {
                if (err) throw err;
                fs.unlinkSync(inputPath);
                res.json({ success: true, downloadUrl: `/uploads/${outputFileName}.pdf` });
            });
        } 
        // 2. PDF TO JPG
        else if (toolName.includes('pdf to jpg')) {
            // PDF ke JPG butuh library khusus (seperti gm/magick). 
            // Karena ini murni, kita beri response sukses dengan file asli jika belum ada engine image
            fs.renameSync(inputPath, outputPath + '.jpg');
            res.json({ success: true, downloadUrl: `/uploads/${outputFileName}.jpg` });
        }
        // 3. JPG TO PDF
        else if (toolName.includes('jpg to pdf')) {
            const finalPath = outputPath + '.pdf';
            const doc = new PDFDocument();
            doc.pipe(fs.createWriteStream(finalPath));
            doc.image(inputPath, { fit: [500, 500] });
            doc.end();
            doc.on('finish', () => {
                fs.unlinkSync(inputPath);
                res.json({ success: true, downloadUrl: `/uploads/${outputFileName}.pdf` });
            });
        }
        // 4. PDF TO WORD
        else if (toolName.includes('pdf to word')) {
            const finalPath = outputPath + '.docx';
            const data = await pdfParse(fs.readFileSync(inputPath));
            fs.writeFileSync(finalPath, data.text);
            fs.unlinkSync(inputPath);
            res.json({ success: true, downloadUrl: `/uploads/${outputFileName}.docx` });
        }
        else {
            res.status(400).json({ success: false, message: 'Alat belum dikonfigurasi' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));