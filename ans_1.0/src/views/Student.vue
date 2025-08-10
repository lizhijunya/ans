<template>
  <div class="student-container">
    <!-- 未登录状态 -->
    <div v-if="!isLoggedIn" class="login-prompt">
      <div class="login-card">
        <div class="login-header">
          <h2>课堂抢答系统</h2>
          <p>请使用微信授权登录参与抢答</p>
        </div>
        
        <div class="room-info" v-if="roomId">
          <p><strong>教室号:</strong> {{ roomId }}</p>
        </div>
        
        <a-button 
          type="primary" 
          size="large" 
          @click="wechatLogin"
          :loading="loginLoading"
          class="login-btn"
        >
          <WechatOutlined /> 微信授权登录
        </a-button>
      </div>
    </div>
    
    <!-- 已登录状态 -->
    <div v-else class="student-main">
      <!-- 刷新提示 -->
      <a-alert
        v-if="showRefreshHint"
        message="页面可能未同步"
        description="如果长时间没有收到新题目，请点击刷新页面"
        type="warning"
        show-icon
        closable
        @close="showRefreshHint = false"
        style="margin-bottom: 16px;"
      >
        <template #action>
          <a-button size="small" type="primary" @click="refreshPage">
            刷新页面
          </a-button>
        </template>
      </a-alert>
      
      <div class="student-header">
        <div class="user-info">
          <a-avatar :src="userInfo.avatar" :alt="userInfo.nickname">
            {{ userInfo.nickname?.charAt(0) }}
          </a-avatar>
          <span class="username">{{ userInfo.nickname }}</span>
        </div>
        <div class="room-info">
          <a-tag color="blue">教室: {{ roomId }}</a-tag>
        </div>
      </div>
      
      <!-- 等待开始 -->
      <div v-if="!quizStarted" class="waiting-state">
        <div class="waiting-card">
          <div class="waiting-icon">
            <ClockCircleOutlined style="font-size: 48px; color: #1890ff;" />
          </div>
          <h3>等待教师开始抢答</h3>
          <p>请耐心等待，抢答即将开始...</p>
          
          <div class="online-count">
            <a-statistic title="在线人数" :value="onlineCount" />
          </div>
        </div>
      </div>
      
      <!-- 抢答进行中 -->
      <div v-else-if="currentQuestion" class="quiz-active">
        <div class="question-card">
          <div class="question-header">
            <div class="question-number">
              题目 {{ questionIndex + 1 }}
            </div>
            <div class="countdown" v-if="timeLeft > 0">
              <a-progress 
                type="circle" 
                :percent="(timeLeft / totalTime) * 100" 
                :format="() => timeLeft + 's'"
                :stroke-color="timeLeft <= 10 ? '#ff4d4f' : '#52c41a'"
                :size="60"
              />
            </div>
          </div>
          
          <div class="question-content">
            <h3 class="question-text">{{ currentQuestion.question }}</h3>
            
            <div class="options-grid">
              <a-button
                v-for="(option, index) in currentQuestion.options"
                :key="index"
                :type="selectedAnswers.includes(String.fromCharCode(65 + index)) ? 'primary' : 'default'"
                :disabled="hasAnswered || timeLeft <= 0"
                @click="selectAnswer(String.fromCharCode(65 + index), option)"
                class="option-btn"
                size="large"
              >
                <div class="option-content">
                  <div class="option-label">{{ String.fromCharCode(65 + index) }}</div>
                  <div class="option-text">{{ option }}</div>
                </div>
              </a-button>
            </div>
            
            <!-- 多选题提交按钮 -->
            <div v-if="isMultipleChoice && selectedAnswers.length > 0 && !hasAnswered && timeLeft > 0" class="submit-section">
              <a-button 
                type="primary" 
                size="large" 
                @click="submitMultipleAnswer"
                class="submit-btn"
              >
                提交答案 (已选择 {{ selectedAnswers.length }} 项)
              </a-button>
            </div>
            
            <div v-if="hasAnswered" class="answer-feedback">
              <a-result
                :status="answerResult.isCorrect ? 'success' : 'error'"
                :title="answerResult.isCorrect ? '回答正确！' : '回答错误'"
                :sub-title="`您的答案: ${selectedAnswers.join(', ')} | 用时: ${answerResult.responseTime}ms`"
              >
                <template #icon>
                  <CheckCircleOutlined v-if="answerResult.isCorrect" style="color: #52c41a;" />
                  <CloseCircleOutlined v-else style="color: #ff4d4f;" />
                </template>
              </a-result>
            </div>
            
            <!-- 显示正确答案 -->
            <div v-if="currentQuestion.showCorrectAnswer" class="correct-answer-display">
              <a-alert
                message="正确答案"
                :description="`正确答案是: ${currentQuestion.correctAnswer}`"
                type="info"
                show-icon
                class="correct-answer-alert"
              />
            </div>
          </div>
        </div>
        
        <!-- 当前排名 -->
        <div class="current-ranking" v-if="currentRanking.length > 0">
          <h4>本题抢答排名</h4>
          <a-list :data-source="currentRanking.slice(0, 5)" size="small">
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
                    <a-tag v-if="item.studentId === userInfo.id" color="green">我</a-tag>
                  </template>
                  <template #description>
                    用时: {{ item.responseTime }}ms
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </div>
      
      <!-- 抢答结束 -->
      <div v-else-if="quizEnded" class="quiz-ended">
        <div class="result-card">
          <a-result
            status="success"
            title="抢答结束"
            sub-title="感谢您的参与！"
          >
            <template #extra>
              <div class="final-stats">
                <a-row :gutter="16">
                  <a-col :span="8">
                    <a-statistic title="总积分" :value="userStats.score || 0" />
                  </a-col>
                  <a-col :span="8">
                    <a-statistic title="正确率" :value="userStats.accuracy || 0" suffix="%" />
                  </a-col>
                  <a-col :span="8">
                    <a-statistic title="排名" :value="userStats.rank || '-'" />
                  </a-col>
                </a-row>
              </div>
            </template>
          </a-result>
        </div>
      </div>
      
      <!-- 等待下一题 -->
      <div v-else class="waiting-next">
        <div class="waiting-card">
          <div class="waiting-icon">
            <LoadingOutlined style="font-size: 48px; color: #1890ff;" />
          </div>
          <h3>等待下一题</h3>
          <p>请等待教师发布下一道题目...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import axios from 'axios'
import io from 'socket.io-client'
import {
  WechatOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'

export default {
  name: 'Student',
  components: {
    WechatOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const socket = ref(null)
    
    const roomId = ref(route.params.roomId)
    const isLoggedIn = ref(false)
    const loginLoading = ref(false)
    const userInfo = ref({})
    
    // 抢答状态
    const quizStarted = ref(false)
    const quizEnded = ref(false)
    const currentQuestion = ref(null)
    const questionIndex = ref(0)
    const timeLeft = ref(0)
    const totalTime = ref(30)
    const timer = ref(null)
    
    // 答题状态
    const selectedAnswers = ref([])
    const hasAnswered = ref(false)
    const answerResult = ref({})
    const questionStartTime = ref(0)
    const isMultipleChoice = computed(() => {
      return currentQuestion.value?.isMultiple || false
    })
    
    // 排名数据
    const onlineCount = ref(0)
    const currentRanking = ref([])
    const userStats = ref({})
    
    // 心跳检测
    const heartbeatTimer = ref(null)
    const lastHeartbeat = ref(Date.now())
    
    // 页面状态检查
    const pageStateTimer = ref(null)
    const lastQuestionUpdate = ref(Date.now())
    const showRefreshHint = ref(false)
    
    // 方法
    const wechatLogin = async () => {
      loginLoading.value = true
      try {
        // 获取微信授权URL
        const response = await axios.get(`/api/wechat-auth-url?roomId=${roomId.value}`)
        window.location.href = response.data.authUrl
      } catch (error) {
        message.error('获取授权链接失败: ' + (error.response?.data?.message || error.message))
        loginLoading.value = false
      }
    }
    

    
    const joinRoom = () => {
      if (!roomId.value) {
        message.error('教室号不能为空')
        return
      }
      
      // 连接Socket.IO - 动态获取服务器地址
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.hostname
      const port = window.location.hostname === 'localhost' ? ':3001' : ''
      const socketUrl = `${protocol}//${host}${port}`
      console.log('正在连接Socket.IO服务器:', socketUrl)
      console.log('用户信息:', userInfo.value)
      
      // 配置Socket.IO选项，包括自动重连
      socket.value = io(socketUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 10,
        timeout: 20000,
        forceNew: true
      })
      
      // 监听连接事件
      socket.value.on('connect', () => {
        console.log('Socket.IO连接成功，Socket ID:', socket.value.id)
        lastHeartbeat.value = Date.now()
        
        // 重新加入房间
        socket.value.emit('join-room', {
          roomId: roomId.value,
          role: 'student',
          userInfo: userInfo.value
        })
        
        // 启动心跳检测
        startHeartbeat()
        
        // 启动页面状态检查
        startPageStateCheck()
      })
      
      socket.value.on('reconnect', (attemptNumber) => {
        console.log('Socket.IO重连成功，尝试次数:', attemptNumber)
        message.success('连接已恢复')
        
        // 重连成功后重新加入房间以同步状态
        socket.value.emit('join-room', {
          roomId: roomId.value,
          role: 'student',
          userInfo: userInfo.value
        })
        
        // 重新启动心跳检测
        startHeartbeat()
        
        // 重新启动页面状态检查
        startPageStateCheck()
      })
      
      socket.value.on('reconnect_attempt', (attemptNumber) => {
        console.log('Socket.IO尝试重连，第', attemptNumber, '次')
      })
      
      socket.value.on('reconnect_error', (error) => {
        console.error('Socket.IO重连失败:', error)
      })
      
      socket.value.on('reconnect_failed', () => {
        console.error('Socket.IO重连失败，已达到最大重试次数')
        message.error('连接断开，请刷新页面重试')
      })
      
      socket.value.on('connect_error', (error) => {
        console.error('Socket.IO连接失败:', error)
        message.error('连接服务器失败，正在尝试重连...')
      })
      
      socket.value.on('disconnect', (reason) => {
        console.log('Socket.IO连接断开:', reason)
        stopHeartbeat()
        if (reason === 'io server disconnect') {
          // 服务器主动断开连接，需要手动重连
          socket.value.connect()
        }
      })
      
      console.log('Socket.IO配置完成，教室ID:', roomId.value)
      
      // 监听房间相关事件
      socket.value.on('room-not-found', () => {
        console.error('教室不存在:', roomId.value)
        message.error('教室不存在')
        router.push('/')
      })
      
      socket.value.on('student-joined', (student) => {
        console.log('有学生加入教室:', student)
      })
      
      // 监听事件
      socket.value.on('quiz-started', () => {
        quizStarted.value = true
        message.success('抢答开始！')
      })
      
      socket.value.on('question-started', (data) => {
        currentQuestion.value = data.question
        questionIndex.value = data.questionIndex
        totalTime.value = data.timeLimit
        timeLeft.value = data.timeLimit
        hasAnswered.value = false
        selectedAnswers.value = []
        answerResult.value = {}
        currentRanking.value = []
        questionStartTime.value = Date.now()
        lastQuestionUpdate.value = Date.now()
        showRefreshHint.value = false // 隐藏刷新提示
        
        // 开始倒计时
        timer.value = setInterval(() => {
          timeLeft.value--
          if (timeLeft.value <= 0) {
            clearInterval(timer.value)
            timer.value = null
          }
        }, 1000)
        
        console.log('收到新题目:', data.questionIndex + 1, data.question)
        message.info('新题目已发布！')
      })
      
      socket.value.on('question-stopped', (data) => {
        if (timer.value) {
          clearInterval(timer.value)
          timer.value = null
        }
        timeLeft.value = 0
        
        // 如果有正确答案信息，显示给学生
        if (data && data.showAnswer && data.correctAnswer) {
          // 更新当前题目的正确答案显示
          if (currentQuestion.value) {
            currentQuestion.value.showCorrectAnswer = true
            currentQuestion.value.correctAnswer = data.correctAnswer
          }
          message.info(`正确答案是: ${data.correctAnswer}`)
        }
      })
      
      socket.value.on('next-question', (data) => {
        // 完全重置题目状态
        currentQuestion.value = data.question
        questionIndex.value = data.questionIndex
        hasAnswered.value = false
        selectedAnswers.value = []
        answerResult.value = {}
        currentRanking.value = []
        
        // 清除之前题目的显示状态
        if (currentQuestion.value) {
          currentQuestion.value.showCorrectAnswer = false
        }
        
        if (timer.value) {
          clearInterval(timer.value)
          timer.value = null
        }
        timeLeft.value = 0
        totalTime.value = 30 // 重置为默认时间
        
        // 更新时间戳并隐藏刷新提示
        lastQuestionUpdate.value = Date.now()
        showRefreshHint.value = false
        
        // 强制更新页面显示
        console.log('切换到新题目:', data.questionIndex + 1, data.question)
        message.info(`已切换到第${data.questionIndex + 1}题`)
      })
      
      socket.value.on('quiz-ended', () => {
        quizEnded.value = true
        currentQuestion.value = null
        if (timer.value) {
          clearInterval(timer.value)
          timer.value = null
        }
        message.info('抢答结束')
      })
      
      socket.value.on('answer-ranking', (ranking) => {
        currentRanking.value = ranking
      })
      
      socket.value.on('online-count', (count) => {
        console.log('收到在线人数更新:', count)
        onlineCount.value = count
      })
      
      socket.value.on('user-stats', (stats) => {
        console.log('收到用户统计信息:', stats)
        userStats.value = stats
      })
      
      // 心跳响应
      socket.value.on('heartbeat-response', () => {
        lastHeartbeat.value = Date.now()
      })
      
      socket.value.on('room-not-found', () => {
        message.error('教室不存在')
        router.push('/')
      })
    }
    
    const selectAnswer = (answerKey, answerText) => {
      if (hasAnswered.value || timeLeft.value <= 0) {
        return
      }
      
      if (isMultipleChoice.value) {
        // 多选题逻辑
        const index = selectedAnswers.value.indexOf(answerKey)
        if (index > -1) {
          // 如果已选择，则取消选择
          selectedAnswers.value.splice(index, 1)
        } else {
          // 如果未选择，则添加选择
          selectedAnswers.value.push(answerKey)
        }
      } else {
        // 单选题逻辑 - 直接提交
        selectedAnswers.value = [answerKey]
        submitAnswer(answerKey, answerText)
      }
    }
    
    const submitMultipleAnswer = () => {
      if (selectedAnswers.value.length === 0) {
        message.warning('请至少选择一个答案')
        return
      }
      
      const answerKey = selectedAnswers.value.sort().join('')
      const answerText = selectedAnswers.value.map(key => {
        const index = key.charCodeAt(0) - 65
        return currentQuestion.value.options[index]
      }).join(', ')
      
      submitAnswer(answerKey, answerText)
    }
    
    const submitAnswer = (answerKey, answerText) => {
      hasAnswered.value = true
      
      const responseTime = Date.now() - questionStartTime.value
      const isCorrect = answerKey === currentQuestion.value.correctAnswer
      
      answerResult.value = {
        isCorrect,
        responseTime
      }
      
      // 发送答案到服务器
      socket.value?.emit('submit-answer', {
        roomId: roomId.value,
        studentId: userInfo.value.id,
        questionIndex: questionIndex.value,
        answer: answerKey,
        answerText,
        responseTime,
        isCorrect,
        nickname: userInfo.value.nickname,
        avatar: userInfo.value.avatar
      })
      
      message.success('答案已提交')
    }
    
    // 心跳检测函数
    const startHeartbeat = () => {
      // 清除之前的心跳定时器
      if (heartbeatTimer.value) {
        clearInterval(heartbeatTimer.value)
      }
      
      heartbeatTimer.value = setInterval(() => {
        if (socket.value && socket.value.connected) {
          // 发送心跳
          socket.value.emit('heartbeat', { timestamp: Date.now() })
          
          // 检查是否超时（30秒无响应）
          if (Date.now() - lastHeartbeat.value > 30000) {
            console.log('心跳超时，尝试重连')
            socket.value.disconnect()
            socket.value.connect()
          }
        }
      }, 10000) // 每10秒发送一次心跳
    }
    
    const stopHeartbeat = () => {
      if (heartbeatTimer.value) {
        clearInterval(heartbeatTimer.value)
        heartbeatTimer.value = null
      }
    }
    
    // 页面状态检查函数
    const startPageStateCheck = () => {
      if (pageStateTimer.value) {
        clearInterval(pageStateTimer.value)
      }
      
      pageStateTimer.value = setInterval(() => {
        // 如果抢答已开始但长时间没有题目更新（超过2分钟），显示刷新提示
        if (quizStarted.value && !currentQuestion.value && 
            Date.now() - lastQuestionUpdate.value > 120000) {
          showRefreshHint.value = true
          console.log('检测到可能的页面同步问题，显示刷新提示')
        }
        
        // 如果页面隐藏超过30秒后重新可见，主动检查连接
        if (!document.hidden && socket.value && isLoggedIn.value) {
          if (!socket.value.connected) {
            console.log('定期检查发现连接断开，尝试重连')
            socket.value.connect()
          }
        }
      }, 30000) // 每30秒检查一次
    }
    
    const stopPageStateCheck = () => {
      if (pageStateTimer.value) {
        clearInterval(pageStateTimer.value)
        pageStateTimer.value = null
      }
    }
    
    const refreshPage = () => {
      window.location.reload()
    }
    
    // 页面可见性检测
    const handleVisibilityChange = () => {
      if (!document.hidden && socket.value && isLoggedIn.value) {
        // 页面变为可见时检查连接状态
        if (!socket.value.connected) {
          console.log('页面重新可见，检测到连接断开，尝试重连')
          socket.value.connect()
        } else {
          console.log('页面重新可见，连接正常')
          // 更新心跳时间
          lastHeartbeat.value = Date.now()
        }
      }
    }
    
    // 检查URL参数中的授权码或localStorage中的用户信息
    onMounted(() => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      
      // 添加页面可见性监听
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      // 添加页面焦点监听（移动端兼容）
      window.addEventListener('focus', handleVisibilityChange)
      
      if (code && state) {
        // 处理微信授权回调
        handleWechatCallback(code, state)
      } else {
        // 检查localStorage中是否有用户信息
        const savedUserInfo = localStorage.getItem('userInfo')
        if (savedUserInfo) {
          try {
            userInfo.value = JSON.parse(savedUserInfo)
            isLoggedIn.value = true
            joinRoom()
            message.success('欢迎回来！')
          } catch (error) {
            console.error('解析用户信息失败:', error)
            localStorage.removeItem('userInfo')
          }
        } else if (!roomId.value) {
          message.error('教室号不能为空')
          router.push('/')
        }
      }
    })
    
    const handleWechatCallback = async (code, state) => {
      try {
        const response = await axios.post('/api/wechat-callback', {
          code,
          state,
          roomId: roomId.value
        })
        
        userInfo.value = response.data.userInfo
        isLoggedIn.value = true
        joinRoom()
        
        // 清除URL参数
        window.history.replaceState({}, document.title, window.location.pathname)
        
        message.success('微信授权登录成功')
      } catch (error) {
        message.error('授权失败: ' + (error.response?.data?.message || error.message))
      }
    }
    
    onUnmounted(() => {
      if (timer.value) {
        clearInterval(timer.value)
      }
      
      // 停止心跳检测
      stopHeartbeat()
      
      // 停止页面状态检查
      stopPageStateCheck()
      
      if (socket.value) {
        socket.value.disconnect()
      }
      
      // 移除事件监听器
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    })
    
    return {
      roomId,
      isLoggedIn,
      loginLoading,
      userInfo,
      quizStarted,
      quizEnded,
      currentQuestion,
      questionIndex,
      timeLeft,
      totalTime,
      selectedAnswers,
      hasAnswered,
      answerResult,
      onlineCount,
      currentRanking,
      userStats,
      isMultipleChoice,
      showRefreshHint,
      wechatLogin,
      selectAnswer,
      submitMultipleAnswer,
      refreshPage
    }
  }
}
</script>

<style scoped>
.student-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-prompt {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.login-header h2 {
  margin-bottom: 8px;
  color: #1890ff;
}

.login-header p {
  color: #666;
  margin-bottom: 24px;
}

.room-info {
  background: #f0f2f5;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 24px;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
}

.student-main {
  max-width: 800px;
  margin: 0 auto;
}

.student-header {
  background: white;
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-weight: 600;
  font-size: 16px;
}

.waiting-state,
.waiting-next {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.waiting-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.waiting-icon {
  margin-bottom: 24px;
}

.waiting-card h3 {
  margin-bottom: 12px;
  color: #1890ff;
}

.waiting-card p {
  color: #666;
  margin-bottom: 24px;
}

.online-count {
  margin-top: 24px;
}

.quiz-active {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.question-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.question-number {
  background: #1890ff;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
}

.question-text {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 24px;
  line-height: 1.6;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.correct-answer-display {
  margin-top: 20px;
}

.correct-answer-alert {
  border-radius: 8px;
}

.option-btn {
  height: auto;
  padding: 16px;
  text-align: left;
  border-radius: 8px;
  transition: all 0.3s ease;
  background-color: #e8f4ff;  /* 加深背景色 */
  border: 2px solid #1890ff;  /* 添加明显的蓝色边框 */
}

.option-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background-color: #d0e8ff;  /* 加深悬停背景色 */
}

.option-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.option-label {
  background: #1890ff;
  color: white;
  width: 44px;  /* 进一步增大选项标签尺寸 */
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;  /* 增大选项标签字体 */
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);  /* 添加轻微阴影增强立体感 */
}

.option-text {
  flex: 1;
  font-size: 24px;  /* 进一步增大字体尺寸 */
  line-height: 1.6;  /* 增加行高改善可读性 */
  color: #000;
  font-weight: 900;  /* 使用最大粗细 */
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);  /* 增强文字阴影 */
  letter-spacing: 0.5px;  /* 增加字间距 */
}

/* 增强选中状态的视觉效果 */
.ant-btn-primary {
  background-color: #1890ff !important;
  border-color: #1890ff !important;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.5) !important;
}

.ant-btn-primary .option-label {
  background: #52c41a;
  color: white;
  box-shadow: 0 2px 6px rgba(82, 196, 26, 0.3);
}

.ant-btn-primary .option-text {
  color: #fff;
  font-weight: 700;
}

.answer-feedback {
  margin-top: 24px;
}

.current-ranking {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.current-ranking h4 {
  margin-bottom: 16px;
  color: #1890ff;
}

.quiz-ended {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.result-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
}

.final-stats {
  margin-top: 24px;
}

.submit-section {
  margin-top: 20px;
  text-align: center;
}

.submit-btn {
  min-width: 200px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(24, 144, 255, 0.4);
}

@media (max-width: 768px) {
  .student-container {
    padding: 12px;
  }
  
  .login-card {
    padding: 24px;
  }
  
  .student-header {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  
  .question-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .question-text {
    font-size: 16px;
  }
  
  .option-content {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  
  .option-text {
    font-size: 22px;  /* 移动端也增大字体，但略小于桌面版 */
    text-align: center;
    font-weight: 900;  /* 保持最大粗细 */
  }
}
</style>