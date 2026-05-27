<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  word: string
  mode: 'learn' | 'review' | 'search'
  level?: string
  showActions?: boolean
}>(), {
  showActions: true
})

const emit = defineEmits<{
  next: []
  close: []
  markWrong: []
}>()

const loading = ref(true)
const phonetic = ref('')
const translation = ref('')
const definition = ref('')
const exchange = ref('')
const tag = ref('')
const detail = ref('')
const exampleEn = ref('')
const exampleZh = ref('')
const noVoiceHint = ref(false)

const exchangeLabels: Record<string, string> = {
  '0': '原形',
  '1': '比较级',
  '2': '最高级',
  '3': '第三人称单数',
  'p': '现在分词',
  'd': '过去式',
  'i': '过去分词',
  's': '复数',
  'r': '比较级',
  't': '最高级'
}

interface ExchangeItem {
  label: string
  value: string
}

const exchangeItems = ref<ExchangeItem[]>([])

function parseExchange(raw: string): ExchangeItem[] {
  if (!raw) return []
  return raw
    .split('|')
    .map((part) => {
      const idx = part.indexOf(':')
      if (idx === -1) return null
      const key = part.substring(0, idx)
      const value = part.substring(idx + 1)
      if (!value || value === props.word) return null
      const label = exchangeLabels[key] || key
      return { label, value }
    })
    .filter((item): item is ExchangeItem => item !== null)
}

function parseExampleFromDetail(raw: string): void {
  exampleEn.value = ''
  exampleZh.value = ''
  if (!raw) return
  try {
    const obj = JSON.parse(raw)
    if (obj.sentence && obj.sentence.length > 0) {
      exampleEn.value = obj.sentence[0].split('\t')[0] || ''
      exampleZh.value = obj.sentence[0].split('\t')[1] || ''
    } else if (obj.example) {
      exampleEn.value = obj.example.en || obj.example || ''
      exampleZh.value = obj.example.zh || ''
    }
  } catch {
    // Not valid JSON — no example data
  }
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

function getLevelLabel(): string {
  const t = tag.value || props.level || ''
  const labels: string[] = []
  if (t.includes('cet4')) labels.push('四级')
  if (t.includes('cet6')) labels.push('六级')
  return labels.join(' / ')
}

async function loadDetail(): Promise<void> {
  loading.value = true
  try {
    const data = await window.electronAPI.queryWord(props.word)
    if (data) {
      phonetic.value = (data.phonetic as string) || ''
      translation.value = (data.translation as string) || ''
      definition.value = (data.definition as string) || ''
      exchange.value = (data.exchange as string) || ''
      tag.value = (data.tag as string) || ''
      detail.value = (data.detail as string) || ''
      exchangeItems.value = parseExchange(exchange.value)

      // Try to extract example sentence from detail JSON (some ECDICT versions)
      parseExampleFromDetail(detail.value)
    }
  } catch (e) {
    console.error('[WordDetailCard] Failed to load detail:', e)
  }
  loading.value = false

  try {
    speak(props.word)
  } catch {
    // auto-play blocked
  }
}

onMounted(() => {
  loadDetail()
})

watch(
  () => props.word,
  () => {
    loadDetail()
  }
)
</script>

<template>
  <div class="detail-card">
    <div class="loading" v-if="loading">加载中...</div>

    <div class="detail-content" v-else>
      <div class="word-header">
        <h1 class="word-title">{{ word }}</h1>
        <button class="speak-btn" @click="speak(word)" title="朗读单词">&#128266;</button>
        <span class="level-badge" v-if="getLevelLabel()">{{ getLevelLabel() }}</span>
      </div>

      <p class="phonetic" v-if="phonetic">/{{ phonetic }}/</p>

      <div class="section" v-if="translation">
        <h3 class="section-title">中文释义</h3>
        <p class="section-text">{{ translation }}</p>
      </div>

      <div class="section" v-if="definition">
        <h3 class="section-title">英文释义</h3>
        <p class="section-text english">{{ definition }}</p>
      </div>

      <div class="section">
        <h3 class="section-title">例句</h3>
        <div v-if="exampleEn" class="example-content">
          <div class="example-row">
            <p class="section-text english example-en">{{ exampleEn }}</p>
            <button class="speak-btn small" @click="speak(exampleEn)" title="朗读例句">&#128266;</button>
          </div>
          <p class="section-text example-zh" v-if="exampleZh">{{ exampleZh }}</p>
        </div>
        <p class="section-text empty-hint" v-else>暂无例句</p>
      </div>

      <div class="section" v-if="exchangeItems.length > 0">
        <h3 class="section-title">词形变化</h3>
        <div class="exchange-list">
          <div class="exchange-item" v-for="item in exchangeItems" :key="item.label + item.value">
            <span class="exchange-label">{{ item.label }}</span>
            <span class="exchange-value">{{ item.value }}</span>
          </div>
        </div>
      </div>

      <div class="section" v-if="exchangeItems.length === 0 && !exchange">
        <h3 class="section-title">词形变化</h3>
        <p class="section-text empty-hint">暂无词形变化</p>
      </div>

      <!-- Buttons managed externally by parent component -->
    </div>
  </div>
</template>

<style scoped>
.detail-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 15px;
}

.detail-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.word-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.word-title {
  font-size: 32px;
  color: #333;
  margin: 0;
}

.speak-btn {
  padding: 8px 12px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: background 0.2s;
}

.speak-btn:hover {
  background: #e0e0e0;
}

.level-badge {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  background: #e8f4fd;
  color: #4a90d9;
  font-weight: 500;
}

.phonetic {
  color: #888;
  font-style: italic;
  font-size: 18px;
  margin: 0 0 20px 0;
}

.section {
  background: #f9fafb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}

.section-title {
  margin: 0 0 8px 0;
  color: #888;
  font-size: 13px;
  font-weight: normal;
}

.section-text {
  margin: 0;
  line-height: 1.6;
  color: #444;
  font-size: 15px;
  white-space: pre-wrap;
}

.section-text.english {
  color: #666;
  font-size: 14px;
}

.example-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.example-en {
  flex: 1;
  margin: 0;
}

.example-zh {
  color: #888;
  font-size: 14px;
}

.speak-btn.small {
  font-size: 16px;
  padding: 4px 8px;
  flex-shrink: 0;
}

.section-text.empty-hint {
  color: #bbb;
  font-size: 14px;
  font-style: italic;
}

.exchange-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.exchange-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 6px 10px;
}

.exchange-label {
  font-size: 12px;
  color: #999;
}

.exchange-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}
</style>
