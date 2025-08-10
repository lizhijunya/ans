<template>
  <div class="teacher-container">
    <a-layout>
      <a-layout-header class="header">
        <div class="header-content">
          <h2>课堂抢答系统</h2>
          <div class="header-actions">
            <a-button type="link" @click="showChangePasswordModal">
              <KeyOutlined /> 修改密码
            </a-button>
            <a-button type="link" @click="handleLogout">
              <LogoutOutlined /> 退出登录
            </a-button>
          </div>
        </div>
      </a-layout-header>
      
      <a-layout-content class="content">
        <div class="main-content">
          <!-- 步骤指示器 -->
          <a-steps :current="currentStep" class="steps">
            <a-step title="上传题目" description="上传Excel文件" />
            <a-step title="生成教室" description="创建抢答教室" />
            <a-step title="开始抢答" description="管理抢答过程" />
          </a-steps>
          
          <!-- 步骤1: 上传Excel -->
          <a-card v-if="currentStep === 0" title="上传题目文件" class="step-card">
            <div class="upload-section">
              <a-upload-dragger
                :file-list="fileList"
                :before-upload="beforeUpload"
                @remove="handleRemove"
                accept=".xlsx,.xls"
              >
                <p class="ant-upload-drag-icon">
                  <InboxOutlined style="font-size: 48px; color: #1890ff;" />
                </p>
                <p class="ant-upload-text">点击或拖拽Excel文件到此区域上传</p>
                <p class="ant-upload-hint">
                  支持.xlsx和.xls格式，文件格式：第一列为题目，第二列为答案选项（用逗号分隔），第三列为正确答案
                </p>
              </a-upload-dragger>
              
              <div v-if="fileList.length > 0" class="upload-actions">
                <a-button type="primary" @click="uploadFile" :loading="uploading">
                  <UploadOutlined /> 解析题目
                </a-button>
              </div>
            </div>
            
            <!-- 题目解析成功提示 -->
            <div v-if="questions.length > 0" class="questions-success">
              <a-result
                status="success"
                :title="`成功解析 ${questions.length} 道题目`"
                sub-title="题目已准备就绪，可以创建抢答教室"
              >
                <template #extra>
                  <a-button type="primary" @click="nextStep">
                    创建教室 <ArrowRightOutlined />
                  </a-button>
                </template>
              </a-result>
            </div>
          </a-card>
          
          <!-- 步骤2: 生成房间 -->
          <a-card v-if="currentStep === 1" title="创建抢答教室" class="step-card">
            <div class="room-creation">
              <a-form layout="vertical">
                <a-form-item label="教室名称">
                  <a-input v-model:value="roomName" placeholder="请输入教室名称" />
                </a-form-item>
                <a-form-item label="每题答题时间(秒)">
                  <a-input-number v-model:value="timeLimit" :min="10" :max="300" style="width: 200px;" />
                </a-form-item>
              </a-form>
              
              <a-button type="primary" @click="createRoom" :loading="creatingRoom">
                <PlusOutlined /> 创建教室
              </a-button>
            </div>
            
            <!-- 房间信息和二维码 -->
            <div v-if="roomInfo" class="room-info">
              <a-row :gutter="24">
                <a-col :span="12">
                  <div class="room-details">
                    <h3>教室信息</h3>
                    <p><strong>教室号:</strong> {{ roomInfo.roomId }}</p>
                    <p><strong>教室名称:</strong> {{ roomInfo.name }}</p>
                    <p><strong>学生链接:</strong></p>
                    <a-input :value="studentUrl" readonly>
                      <template #suffix>
                        <a-button type="text" @click="copyUrl">
                          <CopyOutlined />
                        </a-button>
                      </template>
                    </a-input>
                  </div>
                </a-col>
                <a-col :span="12">
                  <div class="qr-code">
                    <h3>学生扫码入口</h3>
                    <div v-html="qrCodeSvg" class="qr-image"></div>
                  </div>
                </a-col>
              </a-row>
              
              <div class="step-actions">
                <a-button @click="prevStep">
                  <ArrowLeftOutlined /> 上一步
                </a-button>
                <a-button type="primary" @click="nextStep">
                  开始抢答 <ArrowRightOutlined />
                </a-button>
              </div>
            </div>
          </a-card>
          
          <!-- 步骤3: 抢答管理 -->
          <a-card v-if="currentStep === 2" title="抢答管理" class="step-card">
            <div class="quiz-control">
              <a-row :gutter="24">
                <!-- 左侧：题目控制 -->
                <a-col :span="12">
                  <div class="question-control">
                    <h3>当前题目 ({{ currentQuestionIndex + 1 }}/{{ questions.length }})</h3>
                    <div v-if="currentQuestion" class="current-question">
                      <div class="question-text">{{ currentQuestion.question }}</div>
                      <div class="question-options">
                        <a-tag v-for="(option, index) in currentQuestion.options" :key="index" color="blue">
                          {{ String.fromCharCode(65 + index) }}. {{ option }}
                        </a-tag>
                      </div>
                      <div v-if="!questionStarted && currentAnswers.length > 0" class="correct-answer" style="margin-top: 12px;">
                        <a-tag color="green" style="font-size: 16px; padding: 8px 16px;">
                          正确答案: {{ currentQuestion.correctAnswer }}
                        </a-tag>
                      </div>
                      
                      <!-- 二维码区域 - 供断连学生重新扫码进入 -->
                      <div v-if="roomInfo" class="qr-code-section" style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
                        <h4 style="margin-bottom: 12px; color: #666; font-size: 14px;">学生扫码入口 (断连重连)</h4>
                        <div class="qr-code-container" style="display: flex; align-items: center; gap: 16px;">
                          <div v-html="qrCodeSvg" class="qr-image" style="flex-shrink: 0;"></div>
                          <div class="room-info-text" style="flex: 1;">
                            <p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>教室号:</strong> {{ roomInfo.roomId }}</p>
                            <p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>在线人数:</strong> {{ onlineStudents.length }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="waiting-question">
                      <a-empty description="等待开始答题" />
                    </div>
                    
                    <div class="control-buttons">
                      <a-button 
                        v-if="!quizStarted" 
                        type="primary" 
                        size="large" 
                        @click="startQuiz"
                      >
                        <PlayCircleOutlined /> 开始抢答
                      </a-button>
                      
                      <template v-else>
                        <!-- 正在答题中 -->
                        <template v-if="questionStarted && timeLeft > 0">
                          <a-button 
                            type="danger" 
                            @click="stopQuestion"
                          >
                            <PauseCircleOutlined /> 停止抢答
                          </a-button>
                           <a-button 
                            @click="nextQuestion"
                            style="margin-left: 8px;"
                            type="default"
                          >
                            下一题 <ArrowRightOutlined />
                          </a-button>
                        </template>
                        
                        <!-- 未开始答题或答题结束 -->
                        <template v-else>
                          <a-button 
                            type="primary" 
                            size="large" 
                            @click="startQuestion"
                          >
                            开始本题
                          </a-button>
                          
                          <!-- v-if="currentQuestionIndex < questions.length - 1" -->
                          <a-button 
                            @click="nextQuestion"
                            style="margin-left: 8px;"
                            type="default"
                          >
                            下一题 <ArrowRightOutlined />
                          </a-button>
                          
                          <a-button @click="endQuiz" style="margin-left: 8px;" type="danger">
                            结束抢答
                          </a-button>
                        </template>
                      </template>
                    </div>
                    
                    <!-- 倒计时 -->
                    <div v-if="questionStarted && timeLeft > 0" class="countdown">
                      <a-progress 
                        type="circle" 
                        :percent="(timeLeft / timeLimit) * 100" 
                        :format="() => timeLeft + 's'"
                        :stroke-color="timeLeft <= 10 ? '#ff4d4f' : '#1890ff'"
                      />
                    </div>
                  </div>
                </a-col>
                
                <!-- 右侧：学生列表和排名 -->
                <a-col :span="12">
                  <div class="students-panel">
                    <a-tabs v-model:active-key="activeTabKey">
                      <a-tab-pane key="online" tab="在线学生">
                        <div class="online-students">
                          <h4>在线人数: {{ onlineStudents.length }}</h4>
                          <a-list :data-source="onlineStudents" size="small">
                            <template #renderItem="{ item }">
                              <a-list-item>
                                <a-list-item-meta>
                                  <template #avatar>
                                    <a-avatar :src="item.avatar" :alt="item.nickname">
                                      {{ item.nickname?.charAt(0) }}
                                    </a-avatar>
                                  </template>
                                  <template #title>
                                    {{ item.nickname }}
                                  </template>
                                  <template #description>
                                    {{ item.joinTime }}
                                  </template>
                                </a-list-item-meta>
                              </a-list-item>
                            </template>
                          </a-list>
                        </div>
                      </a-tab-pane>
                      
                      <a-tab-pane key="answers" tab="本题抢答">
                        <div class="current-answers">
                          <h4>抢答排名</h4>
                          <a-list :data-source="currentAnswers" size="small">
                            <template #renderItem="{ item, index }">
                              <a-list-item>
                                <a-list-item-meta>
                                  <template #avatar>
                                    <a-badge :count="index + 1" :number-style="{ backgroundColor: index < 3 ? ['#f5222d', '#fa8c16', '#fadb14'][index] : '#d9d9d9' }">
                                      <a-avatar :src="item.avatar" :alt="item.nickname">
                                        {{ item.nickname?.charAt(0) }}
                                      </a-avatar>
                                    </a-badge>
                                  </template>
                                  <template #title>
                                    {{ item.nickname }}
                                  </template>
                                  <template #description>
                                    答案: {{ item.answer }} | 用时: {{ item.responseTime }}ms
                                    <a-tag :color="item.isCorrect ? 'green' : 'red'" style="margin-left: 8px;">
                                      {{ item.isCorrect ? '正确' : '错误' }}
                                    </a-tag>
                                  </template>
                                </a-list-item-meta>
                              </a-list-item>
                            </template>
                          </a-list>
                        </div>
                      </a-tab-pane>
                      
                      <a-tab-pane key="ranking" tab="总排名">
                        <div class="total-ranking">
                          <h4>总积分排名</h4>
                          <a-list :data-source="totalRanking" size="small">
                            <template #renderItem="{ item, index }">
                              <a-list-item>
                                <a-list-item-meta>
                                  <template #avatar>
                                    <a-badge :count="index + 1" :number-style="{ backgroundColor: index < 3 ? ['#f5222d', '#fa8c16', '#fadb14'][index] : '#d9d9d9' }">
                                      <a-avatar :src="item.avatar" :alt="item.nickname">
                                        {{ item.nickname?.charAt(0) }}
                                      </a-avatar>
                                    </a-badge>
                                  </template>
                                  <template #title>
                                    {{ item.nickname }}
                                  </template>
                                  <template #description>
                                    积分: {{ item.score }} | 正确率: {{ item.accuracy }}%
                                  </template>
                                </a-list-item-meta>
                              </a-list-item>
                            </template>
                          </a-list>
                        </div>
                      </a-tab-pane>
                    </a-tabs>
                  </div>
                </a-col>
              </a-row>
            </div>
          </a-card>
        </div>
      </a-layout-content>
    </a-layout>
    
    <!-- 修改密码对话框 -->
    <a-modal 
      v-model:open="changePasswordVisible" 
      :title="requirePasswordChange ? '强制修改密码' : '修改密码'" 
      @ok="handleChangePassword"
      :confirmLoading="changePasswordLoading"
      @cancel="cancelChangePassword"
      :closable="!requirePasswordChange"
      :maskClosable="!requirePasswordChange"
    >
      <a-form :model="passwordForm" layout="vertical">
        <a-form-item 
          label="当前密码" 
          name="currentPassword"
          :rules="[{ required: true, message: '请输入当前密码' }]"
        >
          <a-input-password v-model:value="passwordForm.currentPassword" placeholder="请输入当前密码" />
        </a-form-item>
        
        <a-form-item 
          label="新密码" 
          name="newPassword"
          :rules="[{ required: true, message: '请输入新密码' }]"
        >
          <a-input-password v-model:value="passwordForm.newPassword" placeholder="请输入新密码" />
        </a-form-item>
        
        <a-form-item 
          label="确认新密码" 
          name="confirmPassword"
          :rules="[
            { required: true, message: '请确认新密码' },
            { validator: validatePasswordConfirm }
          ]"
        >
          <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="请再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import axios from 'axios'
import io from 'socket.io-client'
import {
  InboxOutlined,
  UploadOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  LogoutOutlined,
  KeyOutlined
} from '@ant-design/icons-vue'

export default {
  name: 'Teacher',
  components: {
    InboxOutlined,
    UploadOutlined,
    ArrowRightOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    CopyOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    LogoutOutlined,
    KeyOutlined
  },
  setup() {
    const router = useRouter()
    const socket = ref(null)
    
    // 步骤控制
    const currentStep = ref(0)
    
    // 文件上传
    const fileList = ref([])
    const uploading = ref(false)
    const questions = ref([])
    
    // 房间创建
    const roomName = ref('课堂抢答')
    const timeLimit = ref(30)
    const creatingRoom = ref(false)
    const roomInfo = ref(null)
    const qrCodeSvg = ref('')
    
    // 抢答控制
    const quizStarted = ref(false)
    const questionStarted = ref(false)
    const currentQuestionIndex = ref(0)
    const timeLeft = ref(0)
    const timer = ref(null)
    
    // 学生数据
    const onlineStudents = ref([])
    const currentAnswers = ref([])
    const totalRanking = ref([])
    const activeTabKey = ref('online')
    
    const currentQuestion = computed(() => {
      return questions.value[currentQuestionIndex.value]
    })
    
    const studentUrl = computed(() => {
      if (roomInfo.value) {
        return `${window.location.origin}/student/${roomInfo.value.roomId}`
      }
      return ''
    })
    
    // 方法
    const beforeUpload = (file) => {
      fileList.value = [file]
      return false
    }
    
    const handleRemove = () => {
      fileList.value = []
    }
    
    const uploadFile = async () => {
      if (fileList.value.length === 0) {
        message.error('请选择文件')
        return
      }
      
      uploading.value = true
      const formData = new FormData()
      formData.append('file', fileList.value[0])
      
      try {
        const response = await axios.post('/api/upload-questions', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        
        questions.value = response.data.questions
        message.success(`成功解析 ${questions.value.length} 道题目`)
      } catch (error) {
        message.error('文件解析失败: ' + (error.response?.data?.message || error.message))
      } finally {
        uploading.value = false
      }
    }
    
    const createRoom = async () => {
      if (!roomName.value.trim()) {
        message.error('请输入教室名称')
        return
      }
      
      creatingRoom.value = true
      try {
        const response = await axios.post('/api/create-room', {
          name: roomName.value,
          timeLimit: timeLimit.value,
          questions: questions.value
        })
        
        roomInfo.value = response.data.room
        qrCodeSvg.value = response.data.qrCode
        
        // 连接Socket.IO
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
        const host = window.location.hostname
        const port = window.location.hostname === 'localhost' ? ':3001' : ''
        const socketUrl = `${protocol}//${host}${port}`
        console.log('正在连接Socket.IO服务器:', socketUrl)
        socket.value = io(socketUrl)
        socket.value.emit('join-room', { roomId: roomInfo.value.roomId, role: 'teacher' })
        
        // 监听学生连接
        socket.value.on('student-joined', (student) => {
          onlineStudents.value.push(student)
          message.info(`${student.nickname} 加入了教室`)
        })
        
        // 监听学生答题
        socket.value.on('student-answer', (answerData) => {
          currentAnswers.value.push(answerData)
          currentAnswers.value.sort((a, b) => a.responseTime - b.responseTime)
        })
        
        message.success('教室创建成功')
      } catch (error) {
        message.error('教室创建失败: ' + (error.response?.data?.message || error.message))
      } finally {
        creatingRoom.value = false
      }
    }
    
    const copyUrl = () => {
      navigator.clipboard.writeText(studentUrl.value)
      message.success('链接已复制到剪贴板')
    }
    
    const startQuiz = () => {
      quizStarted.value = true
      activeTabKey.value = 'answers'
      socket.value?.emit('quiz-started', { roomId: roomInfo.value.roomId })
      // 开始抢答，但不自动开始第一题，等待教师手动点击
      message.success('抢答开始！请点击"开始本题"开始第一题')
    }
    
    const startQuestion = () => {
      questionStarted.value = true
      timeLeft.value = timeLimit.value
      currentAnswers.value = []
      
      socket.value?.emit('question-started', {
        roomId: roomInfo.value.roomId,
        question: currentQuestion.value,
        questionIndex: currentQuestionIndex.value,
        timeLimit: timeLimit.value
      })
      
      // 开始倒计时
      timer.value = setInterval(() => {
        timeLeft.value--
        if (timeLeft.value <= 0) {
          clearInterval(timer.value)
          timer.value = null
          questionStarted.value = false
          
          // 自动显示答案
          socket.value?.emit('question-stopped', { 
            roomId: roomInfo.value.roomId,
            correctAnswer: currentQuestion.value.correctAnswer,
            showAnswer: true
          })
          
          // 计算积分
          currentAnswers.value.forEach((answer, index) => {
            const student = onlineStudents.value.find(s => s.id === answer.studentId)
            if (student) {
              if (!student.score) student.score = 0
              if (!student.correctCount) student.correctCount = 0
              if (!student.totalAnswers) student.totalAnswers = 0
              
              student.totalAnswers++
              if (answer.isCorrect) {
                student.correctCount++
                // 每题1分
                student.score += 1
              }
              student.accuracy = Math.round((student.correctCount / student.totalAnswers) * 100)
            }
          })
          
          // 更新总排名
          totalRanking.value = [...onlineStudents.value]
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
          
          message.success('时间到！答案已公布')
        }
      }, 1000)
      
      message.success('题目已发布')
    }
    
    const stopQuestion = () => {
      questionStarted.value = false
      timeLeft.value = 0 // 确保在停止时重置时间
      if (timer.value) {
        clearInterval(timer.value)
        timer.value = null
      }
      
      // 发送答案给学生端
      socket.value?.emit('question-stopped', { 
        roomId: roomInfo.value.roomId,
        correctAnswer: currentQuestion.value.correctAnswer,
        showAnswer: true
      })
      
      // 计算积分
      currentAnswers.value.forEach((answer, index) => {
        const student = onlineStudents.value.find(s => s.id === answer.studentId)
        if (student) {
          if (!student.score) student.score = 0
          if (!student.correctCount) student.correctCount = 0
          if (!student.totalAnswers) student.totalAnswers = 0
          
          student.totalAnswers++
          if (answer.isCorrect) {
            student.correctCount++
            // 每题1分
            student.score += 1
          }
          student.accuracy = Math.round((student.correctCount / student.totalAnswers) * 100)
        }
      })
      
      // 更新总排名
      totalRanking.value = [...onlineStudents.value]
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
      
      message.success('本题结束，答案已公布')
    }
    
    const nextQuestion = () => {
      if (currentQuestionIndex.value < questions.value.length - 1) {
        currentQuestionIndex.value++
        questionStarted.value = false
        timeLeft.value = 0
        currentAnswers.value = []
        
        // 通知所有客户端切换到下一题
        socket.value?.emit('next-question', {
          roomId: roomInfo.value.roomId,
          questionIndex: currentQuestionIndex.value,
          question: currentQuestion.value
        })
        
        message.success(`已切换到第${currentQuestionIndex.value + 1}题`)
      } else {
        message.info('已是最后一题，可以结束抢答')
      }
    }
    
    const endQuiz = () => {
      quizStarted.value = false
      questionStarted.value = false
      if (timer.value) {
        clearInterval(timer.value)
        timer.value = null
      }
      
      socket.value?.emit('quiz-ended', { roomId: roomInfo.value.roomId })
      message.success('抢答结束')
    }
    
    const nextStep = () => {
      currentStep.value++
    }
    
    const prevStep = () => {
      currentStep.value--
    }

    const handleLogout = () => {
      // 清除本地存储中的登录状态
      localStorage.removeItem('teacherLoggedIn')
      message.success('退出登录成功！')
      router.push('/teacher-login')
    }
    
    // 修改密码相关
    const changePasswordVisible = ref(false)
    const changePasswordLoading = ref(false)
    const passwordForm = reactive({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    
    // 检查是否需要强制修改密码
    const requirePasswordChange = computed(() => {
      return localStorage.getItem('requirePasswordChange') === 'true'
    })

    // 验证确认密码
    const validatePasswordConfirm = async (rule, value) => {
      if (value !== passwordForm.newPassword) {
        return Promise.reject('两次输入的密码不一致')
      }
      return Promise.resolve()
    }

    // 显示修改密码对话框
    const showChangePasswordModal = () => {
      changePasswordVisible.value = true
      passwordForm.currentPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    }

    // 取消修改密码
    const cancelChangePassword = () => {
      // 如果是强制修改密码，不允许取消
      const requirePasswordChange = localStorage.getItem('requirePasswordChange')
      if (requirePasswordChange === 'true') {
        message.warning('为了安全，必须修改默认密码后才能继续使用系统')
        return
      }
      changePasswordVisible.value = false
    }

    // 处理修改密码
    const handleChangePassword = () => {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        message.error('请填写完整信息')
        return
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        message.error('两次输入的新密码不一致')
        return
      }

      changePasswordLoading.value = true
      
      // 通过API修改密码
      axios.post('/api/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
        .then(response => {
          if (response.data.success) {
            message.success('密码修改成功')
            changePasswordVisible.value = false
            // 清除强制修改密码标记
            localStorage.removeItem('requirePasswordChange')
          } else {
            message.error(response.data.message || '修改密码失败')
          }
        })
        .catch(error => {
          message.error(error.response?.data?.message || '修改密码失败')
        })
        .finally(() => {
          changePasswordLoading.value = false
        })
    }
    
    onMounted(() => {
      // 检查是否需要强制修改密码
      const requirePasswordChange = localStorage.getItem('requirePasswordChange')
      if (requirePasswordChange === 'true') {
        // 延迟显示对话框，确保页面已完全加载
        setTimeout(() => {
          showChangePasswordModal()
          message.warning('检测到您正在使用默认密码，为了安全请立即修改密码', 5)
        }, 500)
      }
    })
    
    onUnmounted(() => {
      if (timer.value) {
        clearInterval(timer.value)
      }
      if (socket.value) {
        socket.value.disconnect()
      }
    })
    
    return {
      currentStep,
      fileList,
      uploading,
      questions,
      roomName,
      timeLimit,
      creatingRoom,
      roomInfo,
      qrCodeSvg,
      quizStarted,
      questionStarted,
      currentQuestionIndex,
      timeLeft,
      onlineStudents,
      currentAnswers,
      totalRanking,
      activeTabKey,
      currentQuestion,
      studentUrl,
      beforeUpload,
      handleRemove,
      uploadFile,
      createRoom,
      copyUrl,
      startQuiz,
      startQuestion,
      stopQuestion,
      nextQuestion,
      endQuiz,
      nextStep,
      prevStep,
      handleLogout,
      
      // 修改密码相关
      changePasswordVisible,
      changePasswordLoading,
      passwordForm,
      requirePasswordChange,
      showChangePasswordModal,
      cancelChangePassword,
      handleChangePassword,
      validatePasswordConfirm
    }
  }
}
</script>

<style scoped>
.teacher-container {
  min-height: 100vh;
}

.header {
  background: #1890ff;
  padding: 0 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}

.header-content h2 {
  margin: 0;
  color: white;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.content {
  padding: 24px;
  background: #f0f2f5;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
}

.steps {
  margin-bottom: 32px;
}

.step-card {
  margin-bottom: 24px;
}

.upload-section {
  margin-bottom: 24px;
}

.upload-actions {
  text-align: center;
  margin-top: 16px;
}

.questions-preview {
  margin-top: 24px;
}

.question-item {
  width: 100%;
}

.question-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.question-options {
  color: #666;
  margin-bottom: 4px;
}

.question-answer {
  color: #52c41a;
  font-weight: 500;
}

.step-actions {
  text-align: center;
  margin-top: 24px;
}

.room-creation {
  margin-bottom: 24px;
}

.room-info {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.room-details h3,
.qr-code h3 {
  margin-bottom: 16px;
}

.qr-image {
  text-align: center;
}

.qr-image :deep(svg) {
  max-width: 200px;
  height: auto;
}

.qr-code-section {
  border: 1px solid #e8e8e8;
}

.qr-code-section .qr-image :deep(svg) {
  max-width: 120px;
  height: auto;
}

.qr-code-container {
  align-items: flex-start;
}

.room-info-text p {
  line-height: 1.4;
}

.quiz-control {
  min-height: 600px;
}

.question-control {
  padding-right: 12px;
}

.current-question {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.question-text {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.question-options .ant-tag {
  margin-bottom: 8px;
  margin-right: 8px;
}

.control-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.countdown {
  text-align: center;
}

.students-panel {
  padding-left: 12px;
  height: 500px;
  overflow-y: auto;
}

.online-students h4,
.current-answers h4,
.total-ranking h4 {
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .content {
    padding: 16px;
  }
  
  .control-buttons {
    flex-direction: column;
  }
  
  .control-buttons .ant-btn {
    width: 100%;
  }
  
  .qr-code-container {
    flex-direction: column;
    text-align: center;
  }
  
  .qr-code-section .qr-image :deep(svg) {
    max-width: 100px;
  }
  
  .room-info-text {
    margin-top: 8px;
  }
}
</style>