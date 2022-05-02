const express = require('express');
const app = express();
const port = 5500;
const multer = require('multer')
const upload = multer({
    dest: 'uploads/'
})
const fs = require("fs");
const child_process = require('child_process');
const path = require('path');

// 允许跨域
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Authorization,X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
    res.header('Allow', 'GET, POST, PATCH, OPTIONS, PUT, DELETE')
    next();
});

app.get('/', (req, res) => {
    res.send('Hello, this is FD Backend');
});

app.get('/api/city', (req, res) => {
    res.json({
        city: '上海',
    });
});

// 上传文件

let fileNameList = [];

// 允许直接访问静态文件
app.use('/uploads', express.static('uploads'));

app.use(upload.any())

app.post('/api/upload', (req, res) => {
    console.log(req.files);
    const file = req.files
    const resArr = []; // 返给前端做回显 link
    // 多图：修改文件后缀
    file.forEach((item) => {
        //以下代码得到文件后缀
        let name = item.originalname;
        const nameArray = name.split('');
        const suffixArray = [];
        let char = nameArray.pop();
        suffixArray.unshift(char);
        while (nameArray.length !== 0 && char !== '.') {
            char = nameArray.pop();
            suffixArray.unshift(char);
        }
        // suffix 是文件的后缀
        let suffix = suffixArray.join('');
        // 重命名文件 加上文件后缀
        // 这里的路径问题一定要注意：本瓜反复测试了很多才发现是“路径问题导致不能正常修改文件名”
        fs.rename('./uploads/' + item.filename, './uploads/' + item.filename + suffix, (err) => {
            if (err) {
                console.log(err)
            }
        });
        resArr.push(`/uploads/${item.filename + suffix}`)
    });
    fileNameList = resArr;
    res.send({
        code: 0,
        data: req.body,
        msg: resArr
    })
    // res.send(200, {
    //     'code': 1,
    //     message: resArr
    // })
})

app.get('/api/detect-video', (req, res) => {
    let workerProcess = child_process.exec('conda activate cuda113py36 && cd ..\\Human-Falling-Detect-Tracks\\ && python main.py -C ..\\fall-detection-backend' + fileNameList[0] + ' --save_out ..\\fall-detection-backend\\out\\out.mp4', function (error, stdout, stderr) {
        if (error) {
            console.log(error.stack);
            console.log('Error code: ' + error.code);
            console.log('Signal received: ' + error.signal);
        }
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
    });
    workerProcess.on('exit', function (code) {
        console.log('子进程已退出，退出码 ' + code);
        res.send({code: code});
    });
})

app.get('/api/video-result', (req, res) => {
    const videoPath = path.resolve(__dirname, './out/out.mp4');
    const readStream = fs.createReadStream(videoPath);
    readStream.pipe(res);
})

app.listen(port, () => {
    console.log(`Server is running on port: http://localhost:${port}`);
});

