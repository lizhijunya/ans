import { createRouter, createWebHistory } from 'vue-router'
import Teacher from '../views/Teacher.vue'
import Student from '../views/Student.vue'
import Login from '../views/Login.vue'
import TeacherLogin from '../views/TeacherLogin.vue'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/teacher',
    name: 'Teacher',
    component: Teacher,
    meta: { requiresAuth: true }
  },
  {
    path: '/teacher-login',
    name: 'TeacherLogin',
    component: TeacherLogin
  },
  {
    path: '/student/:roomId?',
    name: 'Student',
    component: Student,
    props: true
  },
  {
    path: '/login/:roomId',
    name: 'Login',
    component: Login,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  console.log('路由导航:', to.path)
  
  // 检查路由是否需要教师身份验证
  if (to.matched.some(record => record.meta.requiresAuth)) {
    console.log('需要认证的路由')
    // 检查本地存储中是否有教师登录标记
    if (!localStorage.getItem('teacherLoggedIn')) {
      console.log('未登录，跳转到登录页')
      // 未登录，跳转到登录页
      next({
        path: '/teacher-login',
        query: { redirect: to.fullPath }
      })
    } else {
      console.log('已登录，允许访问')
      // 已登录，允许访问
      next()
    }
  } else {
    console.log('公共路由，直接放行')
    // 不需要验证的路由，直接放行
    next()
  }
})

export default router