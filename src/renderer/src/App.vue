<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(async () => {
  try {
    const state = await window.electronAPI.getAppState()

    // Only restore non-learning/review routes (settings, etc.)
    // Learning/review recovery is handled by HomeView card clicks
    if (state.lastRoute && state.lastRoute !== '/' && !state.lastRoute.startsWith('/learn') && !state.lastRoute.startsWith('/review')) {
      router.push(state.lastRoute)
    }
  } catch (e) {
    console.error('[App] Failed to restore state:', e)
  }
})
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #333;
  min-height: 100vh;
}
</style>
