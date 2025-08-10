import express from 'express'
import http from 'http'
import { Server as socketIo } from 'socket.io'
import cors from 'cors'
import bodyParser from 'body-parser'
import multer from 'multer'
import XLSX from 'xlsx'
import QRCode from 'qrcode'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = http.createServer(app)
const io = new socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// 微信配置
const WECHAT_CONFIG = {
  appId: 'wxa11cd0188baa9189',
  secret: '34fbc11bce9268c8664c12d269a55bad'
}

// 中间件
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')))

// 文件上传配置
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持Excel文件格式'))
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

// 内存存储
const rooms = new Map() // 房间数据
const students = new Map() // 学生数据
const answers = new Map() // 答题数据

// 初始化默认教师密码
let teacherPassword = '123456'
const defaultPassword = '123456'

// 教师登录验证
app.post('/api/teacher-login', (req, res) => {
  try {
    const { password } = req.body
    
    if (!password) {
      return res.status(400).json({ message: '密码不能为空' })
    }
    
    if (password === teacherPassword) {
      // 检查是否使用默认密码
      const isDefaultPassword = password === defaultPassword
      
      res.json({
        success: true,
        message: '登录成功',
        requirePasswordChange: isDefaultPassword
      })
    } else {
      res.status(401).json({ 
        success: false,
        message: '密码错误' 
      })
    }
  } catch (error) {
    console.error('教师登录失败:', error)
    res.status(500).json({ message: '登录失败: ' + error.message })
  }
})

// 修改教师密码
app.post('/api/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '当前密码和新密码不能为空' })
    }
    
    if (currentPassword !== teacherPassword) {
      return res.status(401).json({ message: '当前密码错误' })
    }
    
    // 更新密码
    teacherPassword = newPassword
    
    res.json({
      success: true,
      message: '密码修改成功'
    })
  } catch (error) {
    console.error('修改密码失败:', error)
    res.status(500).json({ message: '修改密码失败: ' + error.message })
  }
})

// API路由

// 上传并解析Excel文件
app.post('/api/upload-questions', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择文件' })
    }

    const workbook = XLSX.readFile(req.file.path)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    const questions = []
    
    // 跳过标题行，从第二行开始解析
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (row.length >= 3 && row[0]) {
        const question = row[0].toString().trim()
        
        // 检查所有选项列（从第2列开始，到倒数第2列结束）
        const options = []
        for (let j = 1; j < row.length - 1; j++) {
          if (row[j] !== undefined && row[j] !== null && row[j].toString().trim()) {
            options.push(row[j].toString().trim())
          }
        }
        
        // 获取正确答案（最后一列）
        const correctAnswer = row[row.length - 1] ? row[row.length - 1].toString().trim() : ''
        
        // 判断是否为多选题（正确答案包含多个选项，如"A,B"或"AB"）
        const isMultiple = correctAnswer.includes(',') || (correctAnswer.length > 1 && /^[A-Z]+$/.test(correctAnswer))
        
        if (options.length >= 2 && correctAnswer) {
          questions.push({
            id: uuidv4(),
            question,
            options,
            correctAnswer,
            isMultiple
          })
        }
      }
    }

    if (questions.length === 0) {
      return res.status(400).json({ message: '未找到有效题目，请检查Excel格式' })
    }

    // 清理上传的文件
    fs.unlinkSync(req.file.path)

    res.json({
      success: true,
      questions,
      message: `成功解析 ${questions.length} 道题目`
    })
  } catch (error) {
    console.error('解析Excel文件失败:', error)
    res.status(500).json({ message: '文件解析失败: ' + error.message })
  }
})

// 创建房间
app.post('/api/create-room', async (req, res) => {
  try {
    const { name, timeLimit, questions } = req.body
    
    if (!name || !questions || questions.length === 0) {
      return res.status(400).json({ message: '房间名称和题目不能为空' })
    }

    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase()
    const room = {
      id: roomId,
      name,
      timeLimit: timeLimit || 30,
      questions,
      createdAt: new Date(),
      status: 'waiting', // waiting, active, ended
      currentQuestionIndex: 0,
      students: [],
      answers: []
    }

    rooms.set(roomId, room)

    // 生成二维码
    const studentUrl = `https://chengshaogui.com/student/${roomId}`
    const qrCode = await QRCode.toString(studentUrl, {
      type: 'svg',
      width: 200,
      margin: 2
    })

    res.json({
      success: true,
      room: {
        roomId,
        name,
        timeLimit,
        studentUrl
      },
      qrCode
    })
  } catch (error) {
    console.error('创建房间失败:', error)
    res.status(500).json({ message: '创建房间失败: ' + error.message })
  }
})

// 获取微信授权URL
app.get('/api/wechat-auth-url', (req, res) => {
  try {
    const { roomId } = req.query
    
    if (!roomId) {
      return res.status(400).json({ message: '房间号不能为空' })
    }

    const redirectUri = encodeURIComponent(`https://chengshaogui.com/login/${roomId}`)
    const state = uuidv4()
    
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${WECHAT_CONFIG.appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`
    
    res.json({
      success: true,
      authUrl
    })
  } catch (error) {
    console.error('生成微信授权URL失败:', error)
    res.status(500).json({ message: '生成授权链接失败: ' + error.message })
  }
})

// 微信授权回调
app.post('/api/wechat-callback', async (req, res) => {
  try {
    const { code, state, roomId } = req.body
    
    if (!code) {
      return res.status(400).json({ message: '授权码不能为空' })
    }

    // 获取access_token
    const tokenResponse = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.secret,
        code,
        grant_type: 'authorization_code'
      }
    })

    if (tokenResponse.data.errcode) {
      throw new Error(tokenResponse.data.errmsg || '获取access_token失败')
    }

    const { access_token, openid } = tokenResponse.data

    // 获取用户信息
    const userResponse = await axios.get('https://api.weixin.qq.com/sns/userinfo', {
      params: {
        access_token,
        openid,
        lang: 'zh_CN'
      }
    })

    if (userResponse.data.errcode) {
      throw new Error(userResponse.data.errmsg || '获取用户信息失败')
    }

    const userInfo = {
      id: openid,
      nickname: userResponse.data.nickname,
      avatar: userResponse.data.headimgurl,
      openid
    }

    res.json({
      success: true,
      userInfo
    })
  } catch (error) {
    console.error('微信授权回调失败:', error)
    res.status(500).json({ message: '授权失败: ' + error.message })
  }
})

// 获取房间信息
app.get('/api/room/:roomId', (req, res) => {
  try {
    const { roomId } = req.params
    const room = rooms.get(roomId)
    
    if (!room) {
      return res.status(404).json({ message: '房间不存在' })
    }

    res.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        status: room.status,
        studentCount: room.students.length
      }
    })
  } catch (error) {
    console.error('获取房间信息失败:', error)
    res.status(500).json({ message: '获取房间信息失败: ' + error.message })
  }
})

// Socket.IO连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id)

  // 加入房间
  socket.on('join-room', (data) => {
    const { roomId, role, userInfo } = data
    const room = rooms.get(roomId)
    
    if (!room) {
      socket.emit('room-not-found')
      return
    }

    socket.join(roomId)
    socket.roomId = roomId
    socket.role = role
    socket.userInfo = userInfo

    if (role === 'student' && userInfo) {
      // 学生加入
      const student = {
        id: userInfo.id,
        socketId: socket.id,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        joinTime: new Date().toLocaleTimeString(),
        score: 0,
        correctCount: 0,
        totalAnswers: 0,
        accuracy: 0
      }
      
      // 检查是否已存在
      const existingIndex = room.students.findIndex(s => s.id === userInfo.id)
      if (existingIndex >= 0) {
        room.students[existingIndex] = student
      } else {
        room.students.push(student)
      }
      
      students.set(socket.id, student)
      
      // 通知教师有学生加入
      socket.to(roomId).emit('student-joined', student)
      
      // 发送在线人数
      io.to(roomId).emit('online-count', room.students.length)
      
      // 发送用户统计信息给当前学生
      socket.emit('user-stats', {
        score: student.score,
        correctCount: student.correctCount,
        totalAnswers: student.totalAnswers,
        accuracy: student.accuracy,
        rank: room.students.findIndex(s => s.id === userInfo.id) + 1
      })
      
      // 同步当前房间状态给重连的学生
      if (room.status === 'active') {
        socket.emit('quiz-started')
        
        // 如果有正在进行的题目，同步题目状态
        if (room.currentQuestionIndex !== undefined && room.questions && room.questions[room.currentQuestionIndex]) {
          const currentQuestion = room.questions[room.currentQuestionIndex]
          socket.emit('question-started', {
            question: currentQuestion,
            questionIndex: room.currentQuestionIndex,
            timeLimit: room.timeLimit || 30
          })
          
          // 如果有当前答题排名，也发送给学生
          if (room.currentAnswers && room.currentAnswers.length > 0) {
            socket.emit('answer-ranking', room.currentAnswers)
          }
        }
      } else if (room.status === 'ended') {
        socket.emit('quiz-ended')
      }
      
      console.log(`学生 ${userInfo.nickname} 加入房间 ${roomId}`)
    } else if (role === 'teacher') {
      console.log(`教师加入房间 ${roomId}`)
    }
  })

  // 开始抢答
  socket.on('quiz-started', (data) => {
    const { roomId } = data
    const room = rooms.get(roomId)
    
    if (room && socket.role === 'teacher') {
      room.status = 'active'
      io.to(roomId).emit('quiz-started')
      console.log(`房间 ${roomId} 开始抢答`)
    }
  })

  // 开始题目
  socket.on('question-started', (data) => {
    const { roomId, question, questionIndex, timeLimit } = data
    const room = rooms.get(roomId)
    
    if (room && socket.role === 'teacher') {
      room.currentQuestionIndex = questionIndex
      room.currentAnswers = []
      
      io.to(roomId).emit('question-started', {
        question,
        questionIndex,
        timeLimit
      })
      
      console.log(`房间 ${roomId} 开始题目 ${questionIndex + 1}`)
    }
  })

  // 停止题目
  socket.on('question-stopped', (data) => {
    const { roomId, correctAnswer, showAnswer } = data
    const room = rooms.get(roomId)
    
    if (room && socket.role === 'teacher') {
      io.to(roomId).emit('question-stopped', {
        correctAnswer,
        showAnswer
      })
      console.log(`房间 ${roomId} 停止当前题目，正确答案: ${correctAnswer}`)
    }
  })

  // 下一题
  socket.on('next-question', (data) => {
    const { roomId, questionIndex, question } = data
    const room = rooms.get(roomId)
    
    if (room && socket.role === 'teacher') {
      room.currentQuestionIndex = questionIndex
      room.currentAnswers = []
      
      io.to(roomId).emit('next-question', {
        questionIndex,
        question
      })
      
      console.log(`房间 ${roomId} 切换到题目 ${questionIndex + 1}`)
    }
  })

  // 提交答案
  socket.on('submit-answer', (data) => {
    const { roomId, studentId, questionIndex, answer, answerText, responseTime, isCorrect, nickname, avatar } = data
    const room = rooms.get(roomId)
    
    if (room && socket.role === 'student') {
      const answerData = {
        studentId,
        questionIndex,
        answer,
        answerText,
        responseTime,
        isCorrect,
        nickname,
        avatar,
        timestamp: new Date()
      }
      
      // 检查是否已经回答过
      const existingAnswer = room.currentAnswers?.find(a => a.studentId === studentId)
      if (!existingAnswer) {
        if (!room.currentAnswers) room.currentAnswers = []
        room.currentAnswers.push(answerData)
        
        // 按响应时间排序
        room.currentAnswers.sort((a, b) => a.responseTime - b.responseTime)
        
        // 通知教师
        socket.to(roomId).emit('student-answer', answerData)
        
        // 发送当前排名给所有人
        io.to(roomId).emit('answer-ranking', room.currentAnswers)
        
        console.log(`学生 ${nickname} 提交答案: ${answer}, 用时: ${responseTime}ms`)
      }
    }
  })

  // 结束抢答
  socket.on('quiz-ended', (data) => {
    const { roomId } = data
    const room = rooms.get(roomId)
    
    if (room && socket.role === 'teacher') {
      room.status = 'ended'
      io.to(roomId).emit('quiz-ended')
      console.log(`房间 ${roomId} 结束抢答`)
    }
  })

  // 心跳检测
  socket.on('heartbeat', (data) => {
    // 响应心跳
    socket.emit('heartbeat-response', { timestamp: Date.now() })
  })

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id)
    
    if (socket.roomId && socket.role === 'student') {
      const room = rooms.get(socket.roomId)
      if (room) {
        // 移除学生（可选，或者保留但标记为离线）
        const studentIndex = room.students.findIndex(s => s.socketId === socket.id)
        if (studentIndex >= 0) {
          const student = room.students[studentIndex]
          console.log(`学生 ${student.nickname} 离开房间 ${socket.roomId}`)
          // 这里可以选择移除学生或保留
          // room.students.splice(studentIndex, 1)
        }
        
        // 更新在线人数
        const onlineCount = room.students.filter(s => s.socketId !== socket.id).length
        io.to(socket.roomId).emit('online-count', onlineCount)
      }
      
      students.delete(socket.id)
    }
  })
})

// 处理所有其他路由，返回前端应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error)
  res.status(500).json({ message: '服务器内部错误' })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`)
  console.log(`前端访问地址: http://localhost:${PORT}`)
  console.log(`API地址: http://localhost:${PORT}/api`)
})

export default app