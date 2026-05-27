<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const learnGroupSize = ref(20)
const reviewGroupSize = ref(20)
const saved = ref(false)

onMounted(async () => {
  const settings = await window.electronAPI.getSettings()
  learnGroupSize.value = settings.learnGroupSize
  reviewGroupSize.value = settings.reviewGroupSize
})

function goBack(): void {
  router.push('/settings')
}

async function save(): Promise<void> {
  await window.electronAPI.updateSettings({
    learnGroupSize: learnGroupSize.value,
    reviewGroupSize: reviewGroupSize.value
  })
  saved.value = true
  setTimeout(() => {
    router.push('/settings')
  }, 800)
}
</script>

<template>
  <div class="settings-page">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回</button>
      <h1>每组单词数量</h1>
      <div class="placeholder"></div>
    </div>

    <div class="form-card">
      <div class="form-row">
        <label>学习组大小</label>
        <p class="form-hint">每次学习新词时每组的单词数</p>
        <input
          v-model.number="learnGroupSize"
          type="number"
          min="5"
          max="50"
          step="5"
          class="form-input"
        />
      </div>

      <div class="form-row">
        <label>复习组大小</label>
        <p class="form-hint">每次复习时每组的单词数</p>
        <input
          v-model.number="reviewGroupSize"
          type="number"
          min="5"
          max="50"
          step="5"
          class="form-input"
        />
      </div>

      <p class="range-hint">范围：5 ~ 50，默认 20</p>

      <button class="save-btn" :class="{ done: saved }" @click="save" :disabled="saved">
        {{ saved ? '已保存 ✓' : '保存' }}
      </button>
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

.form-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 28px 24px;
}

.form-row {
  margin-bottom: 24px;
}

.form-row label {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 4px;
}

.form-hint {
  font-size: 12px;
  color: #aaa;
  margin: 0 0 10px 0;
}

.form-input {
  width: 120px;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #4a90d9;
}

.range-hint {
  font-size: 12px;
  color: #bbb;
  margin: 0 0 24px 0;
}

.save-btn {
  width: 100%;
  padding: 12px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  background: #357abd;
}

.save-btn.done {
  background: #16a34a;
}

.save-btn:disabled {
  cursor: default;
  opacity: 0.9;
}
</style>
