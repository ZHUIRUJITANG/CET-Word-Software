<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const masteredWords = ref<{ word: string; translation: string; level: string; masteredBy: string }[]>([])
const loading = ref(true)

function goBack(): void {
  router.push('/settings')
}

async function loadMastered(): Promise<void> {
  loading.value = true
  masteredWords.value = await window.electronAPI.getMasteredWords()
  loading.value = false
}

async function resetWord(word: string, level: string): Promise<void> {
  await window.electronAPI.resetWord(level, word)
  await loadMastered()
}

async function resetAll(): Promise<void> {
  const confirmed = window.confirm('将把所有已掌握单词重置为未学习，是否继续？')
  if (!confirmed) return
  await window.electronAPI.resetMasteredWords()
  await loadMastered()
}

onMounted(() => {
  loadMastered()
})
</script>

<template>
  <div class="settings-page">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回</button>
      <h1>已掌握单词（共 {{ masteredWords.length }} 个）</h1>
      <div class="placeholder"></div>
    </div>

    <div class="toolbar" v-if="masteredWords.length > 0">
      <button class="reset-all-btn" @click="resetAll">一键重学</button>
    </div>

    <div class="loading" v-if="loading">加载中...</div>

    <div class="empty" v-else-if="masteredWords.length === 0">
      <div class="empty-icon">&#9989;</div>
      <p>暂无已掌握单词</p>
    </div>

    <div class="word-list" v-else>
      <div v-for="item in masteredWords" :key="item.word" class="word-item">
        <div class="word-info">
          <span class="word-text">{{ item.word }}</span>
          <span class="word-translation">{{ item.translation }}</span>
          <span class="mastered-badge" :class="item.masteredBy">
            {{ item.masteredBy === 'trash' ? '🗑️ 垃圾桶' : '正常掌握' }}
          </span>
        </div>
        <button class="reset-btn" @click="resetWord(item.word, item.level)">重学</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header h1 {
  color: #333;
  font-size: 18px;
  margin: 0;
}

.placeholder {
  width: 80px;
}

.back-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #eee;
  color: #333;
}

.toolbar {
  margin-bottom: 16px;
  text-align: right;
}

.reset-all-btn {
  padding: 8px 18px;
  border: 1px solid #fca5a5;
  background: #fff;
  color: #dc2626;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-all-btn:hover {
  background: #fee2e2;
}

.loading {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.empty {
  text-align: center;
  color: #bbb;
  padding: 60px 0;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty p {
  font-size: 15px;
  margin: 0;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.word-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

.word-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.word-text {
  font-weight: 600;
  color: #333;
  font-size: 15px;
}

.word-translation {
  color: #888;
  font-size: 13px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mastered-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}

.mastered-badge.normal {
  background: #dcfce7;
  color: #16a34a;
}

.mastered-badge.trash {
  background: #fef3c7;
  color: #d97706;
}

.reset-btn {
  padding: 6px 14px;
  border: 1px solid #ddd;
  background: #fff;
  color: #888;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 12px;
}

.reset-btn:hover {
  border-color: #dc2626;
  color: #dc2626;
}
</style>
