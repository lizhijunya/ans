<template>
  <div class="home-container">
    <div class="header">
      <h1>课堂抢答系统</h1>
      <p>选择您的身份进入系统</p>
    </div>
    
    <div class="role-selection">
      <a-card class="role-card" hoverable @click="goToTeacher">
        <template #cover>
          <div class="card-icon">
            <UserOutlined style="font-size: 48px; color: #1890ff;" />
          </div>
        </template>
        <a-card-meta title="教师端" description="上传题目、管理抢答、查看排名" />
      </a-card>
      
      <a-card class="role-card" hoverable @click="showStudentInput">
        <template #cover>
          <div class="card-icon">
            <TeamOutlined style="font-size: 48px; color: #52c41a;" />
          </div>
        </template>
        <a-card-meta title="学生端" description="扫码进入、参与抢答" />
      </a-card>
    </div>
    
    <!-- 学生输入房间号模态框 -->
    <a-modal 
      v-model:open="studentModalVisible" 
      title="输入教室号" 
      @ok="goToStudent"
      @cancel="studentModalVisible = false"
    >
      <a-input 
        v-model:value="roomId" 
        placeholder="请输入教室号" 
        @pressEnter="goToStudent"
      />
    </a-modal>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UserOutlined, TeamOutlined } from '@ant-design/icons-vue'

export default {
  name: 'Home',
  components: {
    UserOutlined,
    TeamOutlined
  },
  setup() {
    const router = useRouter()
    const studentModalVisible = ref(false)
    const roomId = ref('')
    
    const goToTeacher = () => {
      // 判断是否已登录
      if (localStorage.getItem('teacherLoggedIn')) {
        // 已登录直接进入教师页面
        router.push('/teacher')
      } else {
        // 未登录进入登录页
        router.push('/teacher-login')
      }
    }
    
    const showStudentInput = () => {
      studentModalVisible.value = true
    }
    
    const goToStudent = () => {
      if (roomId.value.trim()) {
        router.push(`/student/${roomId.value.trim()}`)
        studentModalVisible.value = false
        roomId.value = ''
      }
    }
    
    return {
      studentModalVisible,
      roomId,
      goToTeacher,
      showStudentInput,
      goToStudent
    }
  }
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 60px;
  color: white;
}

.header h1 {
  font-size: 48px;
  margin-bottom: 16px;
  font-weight: 600;
}

.header p {
  font-size: 18px;
  opacity: 0.9;
}

.role-selection {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
  justify-content: center;
}

.role-card {
  width: 280px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
}

.role-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.card-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  background: #f8f9fa;
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 36px;
  }
  
  .role-selection {
    gap: 20px;
  }
  
  .role-card {
    width: 240px;
  }
}
</style>