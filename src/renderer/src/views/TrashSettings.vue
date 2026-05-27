<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const trashWords = ref<{ word: string; translation: string; level: string }[]>([])
const loading = ref(true)

function goBack(): void {
  router.push('/settings')
}

async function loadTrash(): Promise<void> {
  loading.value = true
  trashWords.value = await window.electronAPI.getTrashWords()
  loading.value = false
}

async function removeTrash(word: string, level: string): Promise<void> {
  await window.electronAPI.removeTrashMark(level, word)
  await loadTrash()
}

onMounted(() => {
  loadTrash()
})
</script>

<template>
  <div class="settings-page">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回</button>
      <h1>垃圾桶标记的单词</h1>
      <div class="placeholder"></div>
    </div>

    <div class="loading" v-if="loading">加载中...</div>

    <div class="empty" v-else-if="trashWords.length === 0">
      <div class="empty-icon">&#128465;</div>
      <p>暂无标记单词</p>
    </div>

    <div class="word-list" v-else>
      <div v-for="item in trashWords" :key="item.word" class="word-item">
        <div class="word-info">
          <span class="word-text">{{ item.word }}</span>
          <span class="word-translation">{{ item.translation }}</span>
          <span class="level-badge" :class="item.level">
            {{ item.level === 'cet4' ? '四级' : '六级' }}
          </span>
        </div>
        <button class="remove-btn" @click="removeTrash(item.word, item.level)">取消标记</button>
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
  margin-bottom: 24px;
}

.header h1 {
  color: #333;
  font-size: 20px;
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

.level-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}

.level-badge.cet4 {
  background: #e8f4fd;
  color: #4a90d9;
}

.level-badge.cet6 {
  background: #fde8ef;
  color: #d94a7c;
}

.remove-btn {
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

.remove-btn:hover {
  border-color: #4a90d9;
  color: #4a90d9;
}
</style>
