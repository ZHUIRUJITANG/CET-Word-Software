<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WordDetailCard from '../components/WordDetailCard.vue'

const router = useRouter()
const cet4Stats = ref<WordStats>({ total: 0, mastered: 0, learning: 0, review: 0, new: 0 })
const cet6Stats = ref<WordStats>({ total: 0, mastered: 0, learning: 0, review: 0, new: 0 })
const cet4ReviewCount = ref(0)
const cet6ReviewCount = ref(0)

const searchKeyword = ref('')
const searchResults = ref<SearchResult[]>([])
const hasSearched = ref(false)
const selectedSearchWord = ref<string | null>(null)
const noVoiceHint = ref(false)

onMounted(async () => {
  cet4Stats.value = await window.electronAPI.getStats('cet4')
  cet6Stats.value = await window.electronAPI.getStats('cet6')
  cet4ReviewCount.value = await window.electronAPI.getReviewCount('cet4')
  cet6ReviewCount.value = await window.electronAPI.getReviewCount('cet6')
})

async function goToLearn(level: string): Promise<void> {
  router.push({ path: '/learn', query: { level } })
}

async function goToReview(level: string): Promise<void> {
  const active = await window.electronAPI.getActiveSession(level)
  if (active?.type === 'review') {
    await window.electronAPI.restoreReviewSession(active.sessionId)
  }
  router.push({ path: '/review', query: { level } })
}

function getProgressPercent(mastered: number, total: number): number {
  if (total === 0) return 0
  return Math.round((mastered / total) * 100)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function doSearch(): Promise<void> {
  const kw = searchKeyword.value.trim()
  if (!kw) {
    searchResults.value = []
    hasSearched.value = false
    selectedSearchWord.value = null
    return
  }
  hasSearched.value = true
  selectedSearchWord.value = null
  try {
    const results = await window.electronAPI.searchAllWords(kw)
    searchResults.value = results || []
  } catch (error) {
    console.error('[Frontend] Search error:', error)
    searchResults.value = []
  }
}

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    hasSearched.value = false
    selectedSearchWord.value = null
    return
  }
  searchTimer = setTimeout(() => {
    doSearch()
  }, 300)
}

function selectSearchWord(word: string): void {
  selectedSearchWord.value = word
}

function closeDetail(): void {
  selectedSearchWord.value = null
}

function getLevelLabel(tag: string | null | undefined): string {
  if (!tag) return ''
  const labels: string[] = []
  if (tag.includes('cet4')) labels.push('四级')
  if (tag.includes('cet6')) labels.push('六级')
  return labels.join(' / ')
}

function speak(text: string): void {
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  utterance.pitch = 1.0

  const voices = window.speechSynthesis.getVoices()
  const enVoice = voices.find((v) => v.lang.startsWith('en'))
  if (enVoice) {
    utterance.voice = enVoice
    noVoiceHint.value = false
  } else {
    noVoiceHint.value = true
  }

  window.speechSynthesis.speak(utterance)
}
</script>

<template>
  <div class="home">
    <div class="home-header">
      <div></div>
      <div class="title-area">
        <h1>CET单词软件离线版</h1>
        <p class="subtitle">选择词库开始学习</p>
      </div>
      <div class="header-actions">
        <button class="settings-btn" @click="router.push('/settings')" title="学习设置">&#9881;</button>
      </div>
    </div>

    <div class="search-bar">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="输入单词前缀搜索..."
        class="search-input"
        @input="onSearchInput"
      />
    </div>

    <transition name="cards-fade">
      <div class="cards" v-if="!searchKeyword.trim()">
      <div class="card cet4">
        <div class="card-icon">4</div>
        <h2>四级词库</h2>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-value">{{ cet4Stats.total }}</span>
            <span class="stat-label">总单词数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ cet4Stats.mastered }}</span>
            <span class="stat-label">已掌握</span>
            <span class="stats-link" @click.stop="router.push('/stats?level=cet4')">查看统计 &gt;</span>
          </div>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: getProgressPercent(cet4Stats.mastered, cet4Stats.total) + '%' }"
          ></div>
        </div>
        <div class="progress-text">
          {{ getProgressPercent(cet4Stats.mastered, cet4Stats.total) }}%
        </div>
        <div class="card-buttons">
          <button class="card-btn learn-btn" @click.stop="goToLearn('cet4')">开始学习</button>
          <button class="card-btn review-btn" @click.stop="goToReview('cet4')">
            开始复习
            <span class="review-badge" v-if="cet4ReviewCount > 0">{{ cet4ReviewCount }}</span>
          </button>
        </div>
      </div>

      <div class="card cet6">
        <div class="card-icon">6</div>
        <h2>六级词库</h2>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-value">{{ cet6Stats.total }}</span>
            <span class="stat-label">总单词数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ cet6Stats.mastered }}</span>
            <span class="stat-label">已掌握</span>
            <span class="stats-link" @click.stop="router.push('/stats?level=cet6')">查看统计 &gt;</span>
          </div>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: getProgressPercent(cet6Stats.mastered, cet6Stats.total) + '%' }"
          ></div>
        </div>
        <div class="progress-text">
          {{ getProgressPercent(cet6Stats.mastered, cet6Stats.total) }}%
        </div>
        <div class="card-buttons">
          <button class="card-btn learn-btn" @click.stop="goToLearn('cet6')">开始学习</button>
          <button class="card-btn review-btn" @click.stop="goToReview('cet6')">
            开始复习
            <span class="review-badge" v-if="cet6ReviewCount > 0">{{ cet6ReviewCount }}</span>
          </button>
        </div>
      </div>
    </div>
    </transition>

    <div class="search-detail-container" v-if="hasSearched && selectedSearchWord">
      <WordDetailCard
        :word="selectedSearchWord"
        mode="search"
        @close="closeDetail"
      />
    </div>

    <div class="search-results" v-else-if="hasSearched && !selectedSearchWord">
      <div class="result-header">
        <span>找到 {{ searchResults.length }} 个单词</span>
        <span class="voice-hint" v-if="noVoiceHint">如果无法发音，请检查系统语音设置</span>
      </div>

      <div v-if="searchResults.length === 0" class="empty">没有匹配的单词</div>

      <div v-for="item in searchResults" :key="item.word" class="result-item">
        <div class="word-row" @click="selectSearchWord(item.word)">
          <span class="word-text">{{ item.word }}</span>
          <span class="level-tag" v-if="getLevelLabel(item.tag)">{{ getLevelLabel(item.tag) }}</span>
          <button class="speak-btn" @click.stop="speak(item.word)" title="朗读单词">
            &#128266;
          </button>
          <span class="expand-icon">&#9654;</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.home {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 40px 20px;
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.title-area {
  flex: 1;
  text-align: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #f5f5f5;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.settings-btn:hover {
  background: #eee;
  color: #333;
}

h1 {
  color: #333;
  margin-bottom: 8px;
  font-size: 28px;
}

.subtitle {
  color: #888;
  margin-bottom: 24px;
  font-size: 16px;
}

.search-bar {
  display: flex;
  gap: 0;
  margin-bottom: 32px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #4a90d9;
}

.cards-fade-enter-active,
.cards-fade-leave-active {
  transition: opacity 0.25s ease;
}

.cards-fade-enter-from,
.cards-fade-leave-to {
  opacity: 0;
}

.cards {
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 32px;
}

.card {
  border-radius: 16px;
  padding: 28px 24px;
  width: 280px;
  position: relative;
  overflow: hidden;
  color: #fff;
}

.card.cet4 {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
}

.card.cet6 {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 20px rgba(245, 87, 108, 0.3);
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  font-size: 26px;
  font-weight: bold;
}

.card h2 {
  margin: 0 0 18px;
  font-size: 20px;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 36px;
  margin-bottom: 18px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 22px;
  font-weight: bold;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.stats-link {
  font-size: 11px;
  opacity: 0.85;
  margin-top: 4px;
  cursor: pointer;
  text-decoration: underline;
  transition: opacity 0.2s;
}

.stats-link:hover {
  opacity: 1;
}

.progress-bar {
  height: 5px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 18px;
}

.card-buttons {
  display: flex;
  gap: 10px;
}

.card-btn {
  flex: 1;
  padding: 10px 12px;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.learn-btn {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.learn-btn:hover {
  background: rgba(255, 255, 255, 0.4);
}

.review-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.review-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.review-badge {
  display: inline-block;
  background: #ff6b6b;
  color: #fff;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 9px;
  text-align: center;
  margin-left: 4px;
  padding: 0 4px;
}

.search-results {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  text-align: left;
  max-width: 600px;
  margin: 0 auto;
}

.result-header {
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #eee;
  font-size: 13px;
  color: #888;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.voice-hint {
  color: #e67e22;
  font-size: 12px;
}

.empty {
  padding: 40px;
  text-align: center;
  color: #999;
}

.result-item {
  border-bottom: 1px solid #f0f0f0;
}

.result-item:last-child {
  border-bottom: none;
}

.word-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.word-row:hover {
  background: #f9fafb;
}

.word-text {
  flex: 1;
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.level-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-right: 8px;
  background: #e8f4fd;
  color: #4a90d9;
}

.speak-btn {
  padding: 4px 8px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: background 0.2s;
  margin-right: 8px;
}

.speak-btn:hover {
  background: #e0e0e0;
}

.expand-icon {
  font-size: 12px;
  color: #999;
  width: 20px;
  text-align: center;
}

.word-detail {
  padding: 0 16px 16px 16px;
  background: #fafbfc;
  border-top: 1px solid #f0f0f0;
}

.phonetic {
  color: #666;
  font-style: italic;
  margin: 12px 0;
  font-size: 15px;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section h4 {
  margin: 0 0 4px 0;
  color: #888;
  font-size: 12px;
  font-weight: normal;
}

.detail-section p {
  margin: 0;
  line-height: 1.6;
  color: #444;
  font-size: 14px;
}

.search-detail-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 24px;
  text-align: left;
  max-width: 600px;
  margin: 0 auto;
}

</style>
