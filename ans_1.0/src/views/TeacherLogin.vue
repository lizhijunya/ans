<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h2>教师端登录</h2>
        <p>请输入密码登录课堂抢答系统</p>
      </div>
      
      <div class="login-form">
        <a-form :model="formState" layout="vertical" @finish="handleLogin">
          <a-form-item
            label="密码"
            name="password"
            :rules="[{ required: true, message: '请输入密码' }]"
          >
            <a-input-password v-model:value="formState.password" placeholder="请输入密码" />
          </a-form-item>

          <a-form-item>
            <a-button type="primary" html-type="submit" :loading="loading" block>
              登录
            </a-button>
          </a-form-item>
        </a-form>
      </div>
      
      <div class="back-home">
        <a @click="goHome">返回首页</a>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import axios from 'axios'

export default {
  name: 'TeacherLogin',
  setup() {
    const router = useRouter()
    const loading = ref(false)
    const formState = reactive({
      password: ''
    })

    const handleLogin = () => {
      loading.value = true
      
      // 通过API验证密码
      axios.post('/api/teacher-login', { password: formState.password })
        .then(response => {
          if (response.data.success) {
            // 登录成功，存储登录状态
            localStorage.setItem('teacherLoggedIn', 'true')
            
            // 检查是否需要强制修改密码
            if (response.data.requirePasswordChange) {
              message.warning('检测到您正在使用默认密码，为了安全请立即修改密码')
              localStorage.setItem('requirePasswordChange', 'true')
            }
            
            message.success('登录成功')
            router.push('/teacher')
          } else {
            message.error(response.data.message || '登录失败')
          }
        })
        .catch(error => {
          message.error(error.response?.data?.message || '密码错误')
        })
        .finally(() => {
          loading.value = false
        })
    }

    const goHome = () => {
      router.push('/')
    }

    return {
      formState,
      loading,
      handleLogin,
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
  max-width: 400px;
  width: 100%;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  margin-bottom: 8px;
  color: #1890ff;
}

.login-header p {
  color: #666;
}

.back-home {
  text-align: center;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .login-card {
    padding: 24px;
  }
}
</style>