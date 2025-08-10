<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h2>微信授权登录</h2>
        <p>正在处理微信授权，请稍候...</p>
      </div>
      
      <div class="loading-section">
        <a-spin size="large" />
        <p class="loading-text">{{ loadingText }}</p>
      </div>
      
      <div v-if="error" class="error-section">
        <a-result
          status="error"
          title="授权失败"
          :sub-title="error"
        >
          <template #extra>
            <a-button type="primary" @click="retry">
              重试
            </a-button>
            <a-button @click="goHome">
              返回首页
            </a-button>
          </template>
        </a-result>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import axios from 'axios'

export default {
  name: 'Login',
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    const loadingText = ref('正在获取用户信息...')
    const error = ref('')
    const roomId = ref(route.params.roomId)
    
    const handleWechatCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        
        if (!code) {
          throw new Error('授权码不存在')
        }
        
        loadingText.value = '正在验证授权信息...'
        
        const response = await axios.post('/api/wechat-callback', {
          code,
          state,
          roomId: roomId.value
        })
        
        loadingText.value = '登录成功，正在跳转...'
        
        // 存储用户信息到localStorage
        localStorage.setItem('userInfo', JSON.stringify(response.data.userInfo))
        
        // 立即跳转到学生页面
        router.push(`/student/${roomId.value}`)
        
      } catch (err) {
        error.value = err.response?.data?.message || err.message || '授权失败'
        console.error('微信授权失败:', err)
      }
    }
    
    const retry = () => {
      error.value = ''
      loadingText.value = '正在重新获取用户信息...'
      handleWechatCallback()
    }
    
    const goHome = () => {
      router.push('/')
    }
    
    onMounted(() => {
      handleWechatCallback()
    })
    
    return {
      loadingText,
      error,
      roomId,
      retry,
      goHome
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
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
  margin-bottom: 32px;
}

.loading-section {
  padding: 40px 0;
}

.loading-text {
  margin-top: 16px;
  color: #666;
}

.error-section {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .login-card {
    padding: 24px;
  }
}
</style>