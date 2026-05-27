<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const successMsg = ref('')

function goBack(): void {
  router.push('/settings')
}

async function clearTrashMarks(): Promise<void> {
  if (!window.confirm('确定要清空所有垃圾桶标记吗？这些单词将重新进入词库。')) return
  const count = await window.electronAPI.clearTrashMarks()
  successMsg.value = `已清空 ${count} 个垃圾桶标记`
  setTimeout(() => router.push('/settings'), 1000)
}

async function resetLevel(level: 'cet4' | 'cet6'): Promise<void> {
  const label = level === 'cet4' ? '四级' : '六级'
  if (!window.confirm(`确定要重置${label}的所有学习进度吗？已掌握的单词也将重新学习。`)) return
  const count = await window.electronAPI.resetLevel(level)
  successMsg.value = `已重置 ${count} 个${label}单词`
  setTimeout(() => router.push('/settings'), 1000)
}

async function resetAll(): Promise<void> {
  if (!window.confirm('⚠️ 确定要重置全部学习数据吗？所有学习进度将永久丢失，此操作不可撤销。')) return
  await window.electronAPI.resetAll()
  successMsg.value = '已重置全部学习数据'
  setTimeout(() => router.push('/settings'), 1000)
}
</script>

<template>
  <div class="settings-page">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回</button>
      <h1>重置学习数据</h1>
      <div class="placeholder"></div>
    </div>

    <div v-if="successMsg" class="success-toast">{{ successMsg }}</div>

    <div class="reset-list">
      <!-- 1. Clear trash marks -->
      <div class="reset-card">
        <div class="reset-info">
          <div class="reset-title">清空垃圾桶标记</div>
          <div class="reset-desc">仅清除被垃圾桶标记的单词，恢复为未学习状态。其他学习数据不受影响。</div>
        </div>
        <button class="reset-btn" @click="clearTrashMarks">清空垃圾桶标记</button>
      </div>

      <!-- 2. Reset level progress -->
      <div class="reset-card">
        <div class="reset-info">
          <div class="reset-title">重置当前级别进度</div>
          <div class="reset-desc">清空指定级别的所有学习记录（包括掌握、学习中、复习中的单词），恢复为初始状态。不删除词库数据。</div>
        </div>
        <div class="reset-btn-group">
          <button class="reset-btn" @click="resetLevel('cet4')">重置四级进度</button>
          <button class="reset-btn" @click="resetLevel('cet6')">重置六级进度</button>
        </div>
      </div>

      <!-- 3. Reset all -->
      <div class="reset-card danger">
        <div class="reset-info">
          <div class="reset-title">重置全部数据</div>
          <div class="reset-desc">清空所有学习记录（四级+六级），恢复为初始状态。此操作不可撤销。</div>
        </div>
        <button class="reset-btn danger-btn" @click="resetAll">重置全部数据</button>
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
  margin-bottom: 32px;
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

.success-toast {
  background: #dcfce7;
  color: #16a34a;
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 20px;
}

.reset-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reset-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reset-card.danger {
  border: 1px solid #fca5a5;
}

.reset-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reset-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.reset-desc {
  font-size: 13px;
  color: #888;
  line-height: 1.5;
}

.reset-btn-group {
  display: flex;
  gap: 12px;
}

.reset-btn {
  padding: 10px 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #555;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.reset-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.danger-btn {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fca5a5;
}

.danger-btn:hover {
  background: #fecaca;
  border-color: #f87171;
}
</style>
