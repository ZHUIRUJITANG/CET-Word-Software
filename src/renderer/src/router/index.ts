import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LearnView from '../views/LearnView.vue'
import ReviewView from '../views/ReviewView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/learn',
      name: 'learn',
      component: LearnView
    },
    {
      path: '/review',
      name: 'review',
      component: ReviewView
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/settings/group-size',
      name: 'settings-group-size',
      component: () => import('../views/GroupSizeSettings.vue')
    },
    {
      path: '/settings/trash',
      name: 'settings-trash',
      component: () => import('../views/TrashSettings.vue')
    },
    {
      path: '/settings/mastered',
      name: 'settings-mastered',
      component: () => import('../views/MasteredSettings.vue')
    },
    {
      path: '/settings/reset',
      name: 'settings-reset',
      component: () => import('../views/ResetSettings.vue')
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue')
    }
  ]
})

router.afterEach((to) => {
  const fullPath = to.fullPath
  const level = (to.query.level as string) || undefined
  window.electronAPI.saveAppState({ lastRoute: fullPath, lastLevel: level as 'cet4' | 'cet6' | null })
})

export default router
