const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const NodeMediaServer = require("node-media-server");
const config = require("./nms-config");
const kill = require("tree-kill");

const app = express();
const port = 5500;

const upload = multer({
  dest: "uploads/",
});

// 允许跨域
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Authorization,X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PATCH, PUT, DELETE"
  );
  res.header("Allow", "GET, POST, PATCH, OPTIONS, PUT, DELETE");
  next();
});

// 测试

app.get("/", (req, res) => {
  res.send("Hello, this is FD Backend");
});

app.get("/api/city", (req, res) => {
  res.json({
    city: "上海",
  });
});

// 上传文件

let fileNameList = [];

// 允许直接访问静态文件
app.use("/uploads", express.static("uploads"));

app.use(upload.any());

app.post("/api/upload", (req, res) => {
  console.log(req.files);
  const file = req.files;
  const resArr = []; // 返给前端做回显 link
  // 多图：修改文件后缀
  file.forEach((item) => {
    //以下代码得到文件后缀
    let name = item.originalname;
    const nameArray = name.split("");
    const suffixArray = [];
    let char = nameArray.pop();
    suffixArray.unshift(char);
    while (nameArray.length !== 0 && char !== ".") {
      char = nameArray.pop();
      suffixArray.unshift(char);
    }
    // suffix 是文件的后缀
    let suffix = suffixArray.join("");
    // 重命名文件 加上文件后缀
    // 注意这里的路径设置是否正确，常有路径设置错误导致不能正常修改文件名”
    fs.rename(
      "./uploads/" + item.filename,
      "./uploads/" + item.filename + suffix,
      (err) => {
        if (err) {
          console.log(err);
        }
      }
    );
    resArr.push(`/uploads/${item.filename + suffix}`);
  });
  fileNameList = resArr;
  res.send({
    code: 0,
    data: req.body,
    msg: resArr,
  });
});

// 检测程序是否在运行

const processObj = {
  cameraProcess: null, // 摄像头推流进程
  detectProcess: null, // 检测程序进程
};

function showSTD(error, stdout, stderr) {
  if (error) {
    console.log(error.stack);
    console.log("Error code: " + error.code);
    console.log("Signal received: " + error.signal);
  }
  console.log("stdout: " + stdout);
  console.log("stderr: " + stderr);
}

// 摄像头推流地址
const cameraRTMP = "rtmp://localhost/live/FD-Camera";

// 检测程序推流地址
const FDRTMP = "rtmp://localhost/live/FD";

// 视频检测命令
const videoDetectCommand =
  "conda activate cuda113py36 && cd ..\\Human-Falling-Detect-Tracks\\ && python main.py -C ..\\fall-detection-backend" +
  fileNameList[0] +
  " --save_out ..\\fall-detection-backend\\out\\out.mp4";

// 摄像头检测命令
const cameraDetectCommand =
  "conda activate cuda113py36 && cd ..\\Human-Falling-Detect-Tracks\\ && python main.py -C " +
  cameraRTMP +
  " --stream_out " +
  FDRTMP;

// 摄像头推流命令
const streamStartCommand =
  'ffmpeg -f dshow -i video="HD Pro Webcam C920" -vcodec libx264 -f flv ' +
  cameraRTMP;

// 查看当前是否有子进程
app.get("/api/taskList", (req, res) => {
  res.send({ processObj });
});

// 开启摄像头推流
app.get("/api/camera/open", (req, res) => {
  processObj.cameraProcess = exec(streamStartCommand, showSTD);
  res.send({ code: 0 }); // 应该返回直播地址
});

// 关闭摄像头推流
app.get("/api/camera/close", (req, res) => {
  if (processObj.cameraProcess) {
    processObj.cameraProcess.on("exit", function (code) {
      console.log("摄像头推流进程已退出，退出码 " + code);
      res.send({ code: code, msg: "摄像头推流进程退出" });
    });
    kill(processObj.cameraProcess.pid, (err) => {
      if (err !== null) {
        console.log("结束进程发生错误：" + err);
      }
    });
    processObj.cameraProcess = null;
  } else {
    res.send({ code: 1, msg: "error: no camera process" });
  }
});

// 运行摄像头检测程序
app.get("/api/FD/camera", (req, res) => {
  processObj.detectProcess = exec(cameraDetectCommand, showSTD);
  res.send({ code: 0 });
});

// 运行视频检测程序
app.get("/api/FD/video", (req, res) => {
  const workerProcess = exec(videoDetectCommand, showSTD);
  workerProcess.on("exit", function (code) {
    console.log("子进程已退出，退出码 " + code);
    res.send({ code: code });
  });
});

// 关闭检测程序
app.get("/api/FD/close", (req, res) => {
  if (processObj.detectProcess) {
    processObj.detectProcess.on("close", function (code) {
      console.log("FD进程已退出，退出码 " + code);
      res.send({ code: code, msg: "FD进程退出" });
    });
    kill(processObj.detectProcess.pid, (err) => {
      if (err !== null) {
        console.log("结束进程发生错误：" + err);
      }
    });
    processObj.detectProcess = null;
  } else {
    res.send({ code: 1, msg: "error: no detect process" });
  }
});

// 获得视频结果
app.get("/api/result/video", (req, res) => {
  const videoPath = path.resolve(__dirname, "./out/out.mp4");
  const readStream = fs.createReadStream(videoPath);
  readStream.pipe(res);
});

// 获得图片结果
app.get("/api/result/img", (req, res) => {
  res.send({ code: 0 });
});

app.listen(port, () => {
  console.log(`Server is running on port: http://localhost:${port}`);
});

// node-media-server
const nms = new NodeMediaServer(config);
nms.run();
