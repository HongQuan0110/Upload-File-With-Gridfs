const expres = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const fs = require('fs');

const app = expres();

// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'))

app.set('view engine', 'ejs');

// Mongo URI
const mongoURI = 'mongodb://localhost:27017/mongouploads';

// Mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs;

conn.once('open', () => {
    // Init stream
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('uploads');
})

// Create storage engine
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            })
        })
    }
})
const upload = multer({ storage })

// @route GET /
// @desc Loads form
app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            res.render('index', { files: false });
        }
        else {
            files.map(file => {
                if (file.contentType === 'image/jpg' || file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
                    file.isImage = true;
                }
                else {
                    file.isImage = false;
                }
            });
            res.render('index', { files: files })
        }
    })
})

// @route POST /upload
// @desc Uploads file to DB
app.post('/upload', upload.single('file'), (req, res) => {
    // res.json({file: req.file})
    res.redirect('/');
})

// @route GET /files
// @desc Display all files in JSON
app.get('/files', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            return res.status(404).json({
                err: 'No files exist'
            })
        }

        // File exist
        return res.json(files)
    })
})

// @route GET /files/:filename
// @desc Display single file object
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No files exist'
            })
        }

        // File exists
        return res.json(file);
    })
})

// @route GET /image/:filename
// @desc Display image
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No files exist'
            })
        }

        // File exists
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/jpg' || file.contentType === 'image/png') {
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        }
        else {
            res.status(404).json({
                err: 'Not an image'
            })
        }
    })
})

// @route GET /video/:filename
// @desc Play video
app.get('/video/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No files exist'
            })
        }

        if (file.contentType === 'video/mp4') {
            // res.writeHead(200, {'Content-Type': 'video/mp4'});
            // const readstream = gfs.createReadStream({_id: file._id});
            // readstream.pipe(res);
            // readstream.on('data', function(chunk){
            //     console.log(chunk.length);
            // })
            const fileSize = file.length;
            const range = req.headers.range;
            console.log(range);
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                
                const readstream = gfs.createReadStream(file.filename, { start, end});
                const head = {
                    //"Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": 'bytes',
                    //"Content-Length": chunksize,
                    "Content-Type": 'video/mp4'
                }
                res.writeHead(206, head);
                readstream.pipe(res);
                readstream.on('data', function (chunk) {
                    console.log(chunk.length);
                })
            }
            else {
                const head = {
                    //"Content-Length": fileSize,
                    "Content-Type": 'video/mp4'
                }
                res.writeHead(200, head)
                gfs.createReadStream(file.filename).pipe(res);
            }
        }
        else {
            res.status(404).json({
                err: 'Not an video'
            })
        }
    })
})

// @route DELETE /files/:id
// @desc Delete file
app.delete('/files/:id', (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
        if (err) return res.status(404).json({ err });
        return res.redirect('/')
    })
})

const port = 3001;

app.listen(port, () => {
    console.log('Server listening on port', port);
})
