<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WordDetailCard from '../components/WordDetailCard.vue'

const route = useRoute()
const router = useRouter()
const level = ref((route.query.level as string) || 'cet4')
const title = ref(level.value === 'cet4' ? '四级词汇复习' : '六级词汇复习')

const sessionId = ref('')
const totalWords = ref(0)
const completedCount = ref(0)
const loading = ref(false)
const isComplete = ref(false)

const currentPhase = ref<1 | 2>(1)
const currentWord = ref('')
const currentPhonetic = ref('')
const currentTranslation = ref('')
const currentDefinition = ref('')
const reinforcementLabel = ref<'vague' | 'unknown' | null>(null)

type ReviewPhase =
  | 'initial'
  | 'detail'
  | 'reinforcementStep2'
  | 'reinforcementStep2Feedback'
  | 'reinforcementStep3'
  | 'reinforcementStep3Feedback'
  | 'spellingTest'
  | 'spellingFeedback'

const reviewPhase = ref<ReviewPhase>('initial')
const stepOptionItems = ref<OptionItem[]>([])
const pendingQuality = ref(5)
const selectedAnswer = ref('')
const showSuccessFlash = ref(false)
const currentWrongCount = ref(0)
const step3IsCorrect = ref(true)

const correctCount = ref(0)
const vagueCount = ref(0)
const wrongCount = ref(0)

const completedWords = ref<{ word: string; translation: string; result: string; wrongCount: number; phonetic: string; definition: string }[]>([])
const expandedWordIndex = ref<number | null>(null)

// Spelling test state
interface SpellingWord {
  word: string
  translation: string
  hadError: boolean
  spellingWrongCount: number
}

const showSpellingModal = ref(false)
const inSpellingTest = ref(false)
const spellingQueue = ref<SpellingWord[]>([])
const spellingIndex = ref(0)
const spellingInput = ref('')
const spellingResult = ref<'correct' | 'wrong' | null>(null)
const spellingRound = ref(1)
const spellingTotalRounds = ref(1)
const spellingFinalPassed = ref(0)
const showSpellingStats = ref(false)
const spellingInputRef = ref<HTMLInputElement | null>(null)

const phaseLabel = computed(() => currentPhase.value === 1 ? '阶段一：快速判断' : '阶段二：集中学习')

// NEXT button refs for Enter key support and auto-focus
const detailNextBtnRef = ref<HTMLButtonElement | null>(null)
const step2NextBtnRef = ref<HTMLButtonElement | null>(null)
const step3NextBtnRef = ref<HTMLButtonElement | null>(null)
const spellingNextBtnRef = ref<HTMLButtonElement | null>(null)

function handleGlobalKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter') return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  // Spelling test feedback NEXT / 重新输入
  if (inSpellingTest.value && reviewPhase.value === 'spellingFeedback') {
    e.preventDefault()
    if (spellingResult.value === 'correct') {
      handleSpellingNext()
    } else {
      handleSpellingRetry()
    }
    return
  }
  // Phase 2 Step 3 feedback NEXT
  if (reviewPhase.value === 'reinforcementStep3Feedback') {
    e.preventDefault()
    handleStep3Next()
    return
  }
  // Phase 2 Step 2 feedback NEXT
  if (reviewPhase.value === 'reinforcementStep2Feedback') {
    e.preventDefault()
    handleStep2Next()
    return
  }
  // Phase 1 detail NEXT (模糊 or 不认识)
  if (currentPhase.value === 1 && reviewPhase.value === 'detail') {
    e.preventDefault()
    handleDetailContinue(false)
    return
  }
}

// Auto-focus NEXT button when it appears
watch(
  () => currentPhase.value === 1 && reviewPhase.value === 'detail',
  (visible) => {
    if (visible) {
      nextTick(() => detailNextBtnRef.value?.focus())
      setTimeout(() => detailNextBtnRef.value?.focus(), 50)
    }
  }
)
watch(
  () => reviewPhase.value === 'reinforcementStep2Feedback',
  (visible) => {
    if (visible) {
      nextTick(() => step2NextBtnRef.value?.focus())
      setTimeout(() => step2NextBtnRef.value?.focus(), 50)
    }
  }
)
watch(
  () => reviewPhase.value === 'reinforcementStep3Feedback',
  (visible) => {
    if (visible) {
      nextTick(() => step3NextBtnRef.value?.focus())
      setTimeout(() => step3NextBtnRef.value?.focus(), 50)
    }
  }
)
watch(
  () => inSpellingTest.value && reviewPhase.value === 'spellingFeedback',
  (visible) => {
    if (visible) {
      nextTick(() => spellingNextBtnRef.value?.focus())
      setTimeout(() => spellingNextBtnRef.value?.focus(), 50)
    }
  }
)

function goBack(): void {
  router.push('/')
}

function speak(text: string): void {
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  utterance.pitch = 1.0
  const voices = window.speechSynthesis.getVoices()
  const enVoice = voices.find((v) => v.lang.startsWith('en'))
  if (enVoice) utterance.voice = enVoice
  window.speechSynthesis.speak(utterance)
}

async function startReviewSession(recoverSessionId?: string): Promise<void> {
  loading.value = true
  isComplete.value = false
  completedCount.value = 0
  correctCount.value = 0
  vagueCount.value = 0
  wrongCount.value = 0
  completedWords.value = []

  try {
    if (recoverSessionId) {
      sessionId.value = recoverSessionId
      totalWords.value = 0
      // Check which phase we're in
      const phase = await window.electronAPI.getReviewPhase(recoverSessionId)
      currentPhase.value = phase
      const next = await window.electronAPI.getNextReviewWord(recoverSessionId)
      if (next.done) {
        if (phase === 1) {
          // Phase 1 queue empty — check if reinforcement words pending (app closed mid-transition)
          const reinResult = await window.electronAPI.getFirstReinforcementWord(recoverSessionId)
          if (!reinResult.done && reinResult.nextWord) {
            currentPhase.value = 2
            completedCount.value = 0
            totalWords.value = reinResult.reinforcementCount || 0
            loadWordFromResult(reinResult.nextWord)
          } else {
            isComplete.value = true
            window.electronAPI.saveAppState({ activeSession: null })
          }
        } else {
          isComplete.value = true
          window.electronAPI.saveAppState({ activeSession: null })
        }
      } else {
        loadWordFromResult(next)
      }
    } else {
      const session = await window.electronAPI.createReviewSession(level.value)
      sessionId.value = session.sessionId
      totalWords.value = session.totalWords
      currentPhase.value = 1

      if (session.totalWords === 0) {
        isComplete.value = true
        loading.value = false
        window.electronAPI.saveAppState({ activeSession: null })
        return
      }

      const next = await window.electronAPI.getNextReviewWord(session.sessionId)
      if (next.done) {
        isComplete.value = true
      } else {
        loadWordFromResult(next)
      }
    }
  } catch (e) {
    console.error('[Review] Failed to start session:', e)
    isComplete.value = true
  }

  loading.value = false
}

function loadWordFromResult(result: ReviewWordResult): void {
  if (result.done || !result.word) {
    finishSession(result.stats)
    return
  }

  currentWord.value = result.word
  currentPhonetic.value = result.phonetic || ''
  currentTranslation.value = result.translation || ''
  currentDefinition.value = result.definition || ''
  stepOptionItems.value = result.optionItems || []
  reinforcementLabel.value = result.reinforcementLabel || null
  pendingQuality.value = 5
  selectedAnswer.value = ''
  showSuccessFlash.value = false
  currentWrongCount.value = 0
  step3IsCorrect.value = true

  // Phase 2: auto-enter quiz directly (skip "开始练习" page)
  if (currentPhase.value === 2 && reinforcementLabel.value) {
    if (reinforcementLabel.value === 'unknown') {
      reviewPhase.value = 'reinforcementStep2'
    } else {
      reviewPhase.value = 'reinforcementStep3'
    }
    return
  }

  reviewPhase.value = 'initial'

  // Phase 1: auto-pronounce. Phase 2: don't auto-pronounce (matches learning mode)
  if (currentPhase.value === 1) {
    try {
      speak(currentWord.value)
    } catch {
      // auto-play blocked
    }
  }
}

function finishSession(stats?: { correct: number; vague: number; wrong: number }): void {
  window.electronAPI.saveAppState({ activeSession: null })
  if (stats) {
    correctCount.value = stats.correct
    vagueCount.value = stats.vague
    wrongCount.value = stats.wrong
  }
  // Show spelling test modal before results
  showSpellingModal.value = true
}

// Phase 1: initial answer
async function handleInitialAnswer(choice: 'know' | 'vague' | 'unknown'): Promise<void> {
  if (choice === 'know') {
    pendingQuality.value = 5
    showSuccessFlash.value = true
    await new Promise((resolve) => setTimeout(resolve, 800))
    showSuccessFlash.value = false
    await completePhase1AndAdvance('know')
  } else {
    pendingQuality.value = choice === 'vague' ? 3 : 1
    reviewPhase.value = 'detail'
  }
}

// Phase 1: show detail card after 模糊/不认识
// (detail phase is handled by template showing WordDetailCard)

// Phase 1: continue from detail card
async function handleDetailContinue(markAsUnknown = false): Promise<void> {
  const label = pendingQuality.value >= 3 ? 'vague' : 'unknown'
  if (markAsUnknown && label === 'vague') {
    // Change reinforcement label from vague to unknown after moving to queue
    await completePhase1AndAdvance(label, true)
  } else {
    await completePhase1AndAdvance(label)
  }
}

async function completePhase1AndAdvance(label: 'know' | 'vague' | 'unknown', markAsUnknown = false): Promise<void> {
  const result = await window.electronAPI.completePhase1Word(
    sessionId.value,
    currentWord.value,
    label
  )

  // If "记错了" was clicked for a vague word, change its label to unknown
  if (markAsUnknown && label === 'vague') {
    await window.electronAPI.changeReinforcementLabel(sessionId.value, currentWord.value, 'unknown')
  }

  // Track completed word
  const labelMap = { know: '认识', vague: '模糊', unknown: '不认识' }
  completedWords.value.push({
    word: currentWord.value,
    translation: currentTranslation.value,
    result: labelMap[label],
    wrongCount: currentWrongCount.value,
    phonetic: currentPhonetic.value,
    definition: currentDefinition.value
  })
  completedCount.value++

  if (result.done) {
    finishSession(result.stats)
    return
  }

  // Phase 1 queue empty but reinforcement words pending — transition to phase 2
  if (!result.nextWord && result.reinforcementCount && result.reinforcementCount > 0) {
    const reinResult = await window.electronAPI.getFirstReinforcementWord(sessionId.value)
    if (reinResult.done) {
      finishSession(reinResult.stats)
      return
    }
    currentPhase.value = 2
    completedCount.value = 0
    totalWords.value = reinResult.reinforcementCount || 0
    if (reinResult.nextWord) {
      loadWordFromResult(reinResult.nextWord)
    }
    return
  }

  if (result.nextWord) {
    loadWordFromResult(result.nextWord)
  } else {
    const next = await window.electronAPI.getNextReviewWord(sessionId.value)
    loadWordFromResult(next)
  }
}

// Phase 2: step 2 answer
function handleStep2Answer(selectedWord: string): void {
  selectedAnswer.value = selectedWord
  speak(currentWord.value)

  const isCorrect = selectedWord.toLowerCase() === currentWord.value.toLowerCase()
  if (!isCorrect) {
    pendingQuality.value = Math.min(pendingQuality.value, 1)
    currentWrongCount.value++
  }
  reviewPhase.value = 'reinforcementStep2Feedback'
}

function handleStep2Next(): void {
  reviewPhase.value = 'reinforcementStep3'
  selectedAnswer.value = ''
}

// Phase 2: step 3 answer
function handleStep3Answer(selectedTranslation: string): void {
  selectedAnswer.value = selectedTranslation
  speak(currentWord.value)

  const isCorrect = selectedTranslation === currentTranslation.value
  step3IsCorrect.value = isCorrect
  if (!isCorrect) {
    if (pendingQuality.value >= 3) {
      pendingQuality.value = 2
    } else {
      pendingQuality.value = Math.min(pendingQuality.value, 1)
    }
    currentWrongCount.value++
  }
  reviewPhase.value = 'reinforcementStep3Feedback'
}

async function handleStep3Next(): Promise<void> {
  if (step3IsCorrect.value) {
    // Correct: mark word as completed, SM-2 update, progress +1
    const result = await window.electronAPI.completeReinforcementWord(
      sessionId.value,
      currentWord.value,
      pendingQuality.value
    )

    const qualityLabel = pendingQuality.value >= 5 ? '认识' : pendingQuality.value >= 3 ? '模糊' : '不认识'
    completedWords.value.push({
      word: currentWord.value,
      translation: currentTranslation.value,
      result: qualityLabel,
      wrongCount: currentWrongCount.value,
      phonetic: currentPhonetic.value,
      definition: currentDefinition.value
    })
    completedCount.value++

    if (result.done) {
      finishSession(result.stats)
      return
    }

    if (result.nextWord) {
      loadWordFromResult(result.nextWord)
    } else {
      const next = await window.electronAPI.getNextReviewWord(sessionId.value)
      loadWordFromResult(next)
    }
  } else {
    // Wrong: re-queue word to end of reinforcement queue, no progress change
    const result = await window.electronAPI.requeueReinforcementWord(
      sessionId.value,
      currentWord.value
    )

    if (result.done) {
      finishSession(result.stats)
      return
    }

    if (result.nextWord) {
      loadWordFromResult(result.nextWord)
    } else {
      const next = await window.electronAPI.getNextReviewWord(sessionId.value)
      loadWordFromResult(next)
    }
  }
}

function isCorrectOption(item: OptionItem): boolean {
  if (reviewPhase.value === 'reinforcementStep2Feedback') {
    return item.word.toLowerCase() === currentWord.value.toLowerCase()
  }
  if (reviewPhase.value === 'reinforcementStep3Feedback') {
    return item.translation === currentTranslation.value
  }
  return false
}

function isWrongSelected(item: OptionItem): boolean {
  if (reviewPhase.value === 'reinforcementStep2Feedback') {
    return item.word === selectedAnswer.value && item.word.toLowerCase() !== currentWord.value.toLowerCase()
  }
  if (reviewPhase.value === 'reinforcementStep3Feedback') {
    return item.translation === selectedAnswer.value && item.translation !== currentTranslation.value
  }
  return false
}

// Spelling test: skip
function handleSpellingSkip(): void {
  showSpellingModal.value = false
  isComplete.value = true
}

// Spelling test: start
function handleSpellingStart(): void {
  showSpellingModal.value = false
  spellingQueue.value = completedWords.value.map((w) => ({
    word: w.word,
    translation: w.translation,
    hadError: false,
    spellingWrongCount: 0
  }))
  spellingIndex.value = 0
  spellingRound.value = 1
  spellingTotalRounds.value = 1
  spellingFinalPassed.value = 0
  showSpellingStats.value = false
  inSpellingTest.value = true
  spellingInput.value = ''
  spellingResult.value = null
  reviewPhase.value = 'spellingTest'
  nextTick(() => {
    spellingInputRef.value?.focus()
    setTimeout(() => speak(spellingQueue.value[0].word), 300)
  })
}

// Spelling test: submit
function handleSpellingSubmit(): void {
  if (!spellingInput.value.trim()) return
  const current = spellingQueue.value[spellingIndex.value]
  if (spellingInput.value.trim().toLowerCase() === current.word.toLowerCase()) {
    spellingResult.value = 'correct'
  } else {
    spellingResult.value = 'wrong'
    current.hadError = true
    current.spellingWrongCount++
  }
  reviewPhase.value = 'spellingFeedback'
}

// Spelling test: retry same word (after wrong)
function handleSpellingRetry(): void {
  spellingInput.value = ''
  spellingResult.value = null
  reviewPhase.value = 'spellingTest'
  nextTick(() => {
    spellingInputRef.value?.focus()
  })
}

// Spelling test: next word (after correct)
function handleSpellingNext(): void {
  spellingIndex.value++
  if (spellingIndex.value >= spellingQueue.value.length) {
    // Round finished — collect words that had errors
    const retryWords = spellingQueue.value.filter((w) => w.hadError)
    if (retryWords.length === 0) {
      // All passed cleanly — done
      spellingFinalPassed.value = spellingQueue.value.length
      showSpellingStats.value = true
      return
    }
    // Start next round with retry words
    spellingQueue.value = retryWords.map((w) => ({
      word: w.word,
      translation: w.translation,
      hadError: false,
      spellingWrongCount: w.spellingWrongCount
    }))
    spellingIndex.value = 0
    spellingRound.value++
    spellingTotalRounds.value++
  }
  spellingInput.value = ''
  spellingResult.value = null
  reviewPhase.value = 'spellingTest'
  nextTick(() => {
    spellingInputRef.value?.focus()
    setTimeout(() => speak(spellingQueue.value[spellingIndex.value].word), 200)
  })
}

// Spelling test: finish and show review results
function handleSpellingFinish(): void {
  inSpellingTest.value = false
  showSpellingStats.value = false
  isComplete.value = true
}

// Results: toggle word detail expand
function handleWordExpand(index: number): void {
  if (expandedWordIndex.value === index) {
    expandedWordIndex.value = null
  } else {
    expandedWordIndex.value = index
    speak(completedWords.value[index].word)
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown)
  const state = await window.electronAPI.getAppState()
  if (state.activeSession?.type === 'review') {
    level.value = state.activeSession.level as string
    title.value = level.value === 'cet4' ? '四级词汇复习' : '六级词汇复习'
    await startReviewSession(state.activeSession.sessionId)
  } else {
    await startReviewSession()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="review">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回首页</button>
      <h1>{{ title }}</h1>
      <div class="header-right">
        <div class="phase-badge" v-if="!loading && !isComplete">{{ phaseLabel }}</div>
        <div class="progress-info" v-if="!loading && !isComplete && totalWords > 0">
          {{ completedCount }} / {{ totalWords }}
        </div>
      </div>
    </div>

    <div class="loading" v-if="loading">
      <p>加载中...</p>
    </div>

    <div class="empty-state" v-else-if="isComplete && totalWords === 0">
      <div class="empty-icon">&#127881;</div>
      <h2>暂无待复习单词</h2>
      <p>继续学习新单词，系统会在合适的时间安排复习。</p>
      <button class="restart-btn" @click="goBack">返回首页</button>
    </div>

    <!-- Results screen -->
    <div class="results" v-else-if="isComplete">
      <div class="complete-icon">&#10003;</div>
      <h2>复习完成</h2>
      <div class="session-stats">
        <div class="stat">
          <span class="stat-value">{{ correctCount + vagueCount + wrongCount }}</span>
          <span class="stat-label">总复习</span>
        </div>
        <div class="stat">
          <span class="stat-value correct-color">{{ correctCount }}</span>
          <span class="stat-label">认识</span>
        </div>
        <div class="stat">
          <span class="stat-value vague-color">{{ vagueCount }}</span>
          <span class="stat-label">模糊</span>
        </div>
        <div class="stat">
          <span class="stat-value wrong-color">{{ wrongCount }}</span>
          <span class="stat-label">不认识</span>
        </div>
      </div>
      <div class="word-results-list" v-if="completedWords.length > 0">
        <div class="word-result-item" v-for="(item, i) in completedWords" :key="i">
          <div class="wr-row" @click="handleWordExpand(i)">
            <span class="wr-word">{{ item.word }}</span>
            <span class="wr-wrong" v-if="item.wrongCount > 0">错{{ item.wrongCount }}次</span>
            <span class="wr-wrong wr-ok" v-else>&#10003;</span>
            <span class="wr-arrow" :class="{ 'wr-arrow-open': expandedWordIndex === i }">&#9654;</span>
          </div>
          <div class="wr-detail" v-if="expandedWordIndex === i">
            <p class="wr-phonetic" v-if="item.phonetic">/{{ item.phonetic }}/</p>
            <p class="wr-def">{{ item.translation }}</p>
            <p class="wr-def-en" v-if="item.definition">{{ item.definition }}</p>
          </div>
        </div>
      </div>
      <button class="restart-btn" @click="goBack">返回首页</button>
    </div>

    <!-- Phase 1 Detail: WordDetailCard after 模糊/不认识 -->
    <div class="detail-view" v-else-if="currentPhase === 1 && reviewPhase === 'detail'">
      <WordDetailCard
        :word="currentWord"
        mode="review"
        :level="level"
        :showActions="false"
      />
      <div class="detail-continue">
        <div class="detail-buttons" v-if="pendingQuality >= 3">
          <!-- 模糊: 记错了重新学习 + NEXT -->
          <button class="next-btn secondary" @click="handleDetailContinue(true)">
            记错了重新学习
          </button>
          <button ref="detailNextBtnRef" class="next-btn" @click="handleDetailContinue(false)">
            NEXT &#8594;
          </button>
        </div>
        <div class="detail-buttons" v-else>
          <!-- 不认识: only NEXT -->
          <button ref="detailNextBtnRef" class="next-btn" @click="handleDetailContinue(false)">
            NEXT &#8594;
          </button>
        </div>
      </div>
    </div>

    <!-- Phase 2: Step 2 (pick English from Chinese) — 不认识 path -->
    <div class="card-container" v-else-if="reviewPhase === 'reinforcementStep2' || reviewPhase === 'reinforcementStep2Feedback'">
      <div class="word-card">
        <p class="step-hint">选出正确的单词</p>
        <div class="meaning-display">
          <p class="meaning-text">{{ currentTranslation }}</p>
        </div>
        <div class="options-grid">
          <button
            v-for="(item, i) in stepOptionItems"
            :key="i"
            class="option-btn word-option"
            :class="{
              'option-correct': reviewPhase === 'reinforcementStep2Feedback' && isCorrectOption(item),
              'option-wrong': reviewPhase === 'reinforcementStep2Feedback' && isWrongSelected(item)
            }"
            @click="handleStep2Answer(item.word)"
            :disabled="reviewPhase === 'reinforcementStep2Feedback'"
          >
            <span v-if="reviewPhase === 'reinforcementStep2Feedback'">{{ item.word }} {{ item.translation }}</span>
            <span v-else>{{ item.word }}</span>
          </button>
        </div>
      </div>

      <div class="next-area" v-if="reviewPhase === 'reinforcementStep2Feedback'">
        <button ref="step2NextBtnRef" class="next-btn" @click="handleStep2Next">
          NEXT &#8594;
        </button>
      </div>
    </div>

    <!-- Phase 2: Step 3 (pick Chinese from English) — both vague and unknown paths -->
    <div class="card-container" v-else-if="reviewPhase === 'reinforcementStep3' || reviewPhase === 'reinforcementStep3Feedback'">
      <div class="word-card">
        <p class="step-hint">选择正确的中文释义</p>
        <div class="word-main">
          <h2 class="word-text">{{ currentWord }}</h2>
          <button class="speak-btn" @click="speak(currentWord)" title="朗读单词">
            &#128266;
          </button>
        </div>
        <div class="options-grid meaning-grid">
          <button
            v-for="(item, i) in stepOptionItems"
            :key="i"
            class="option-btn meaning-option"
            :class="{
              'option-correct': reviewPhase === 'reinforcementStep3Feedback' && isCorrectOption(item),
              'option-wrong': reviewPhase === 'reinforcementStep3Feedback' && isWrongSelected(item)
            }"
            @click="handleStep3Answer(item.translation)"
            :disabled="reviewPhase === 'reinforcementStep3Feedback'"
          >
            <span v-if="reviewPhase === 'reinforcementStep3Feedback'">{{ item.word }} {{ item.translation }}</span>
            <span v-else>{{ item.translation }}</span>
          </button>
        </div>
      </div>

      <div class="next-area" v-if="reviewPhase === 'reinforcementStep3Feedback'">
        <button ref="step3NextBtnRef" class="next-btn" @click="handleStep3Next">
          NEXT &#8594;
        </button>
      </div>
    </div>

    <!-- Spelling Test Stats -->
    <div class="results" v-else-if="inSpellingTest && showSpellingStats">
      <div class="complete-icon">&#9997;</div>
      <h2>拼写测试完成</h2>
      <div class="session-stats">
        <div class="stat">
          <span class="stat-value">{{ spellingTotalRounds }}</span>
          <span class="stat-label">总轮次</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ spellingFinalPassed }}</span>
          <span class="stat-label">总单词</span>
        </div>
        <div class="stat">
          <span class="stat-value correct-color">{{ spellingFinalPassed }}</span>
          <span class="stat-label">全部通过</span>
        </div>
      </div>
      <p class="spelling-round-hint" v-if="spellingTotalRounds > 1">
        经过 {{ spellingTotalRounds }} 轮拼写，所有单词均已一次正确拼写通过
      </p>
      <button class="restart-btn" @click="handleSpellingFinish">查看复习结果</button>
    </div>

    <!-- Spelling Test: Input -->
    <div class="card-container" v-else-if="inSpellingTest && reviewPhase === 'spellingTest'">
      <div class="word-card">
        <p class="step-hint">第{{ spellingRound }}轮，当前单词 {{ spellingIndex + 1 }}/{{ spellingQueue.length }}</p>
        <button class="speak-btn large" @click="speak(spellingQueue[spellingIndex].word)" title="再听一次">
          &#128266; 再听一次
        </button>
        <div class="spelling-section">
          <input
            ref="spellingInputRef"
            v-model="spellingInput"
            type="text"
            class="spelling-input"
            placeholder="请输入单词..."
            @keyup.enter="handleSpellingSubmit"
          />
          <button
            class="submit-btn"
            @click="handleSpellingSubmit"
            :disabled="!spellingInput.trim()"
          >
            提交
          </button>
        </div>
      </div>
    </div>

    <!-- Spelling Test: Feedback -->
    <div class="card-container" v-else-if="inSpellingTest && reviewPhase === 'spellingFeedback'">
      <div class="word-card">
        <p class="step-hint">第{{ spellingRound }}轮，当前单词 {{ spellingIndex + 1 }}/{{ spellingQueue.length }}</p>
        <button class="speak-btn large" @click="speak(spellingQueue[spellingIndex].word)" title="再听一次">
          &#128266; 再听一次
        </button>
        <div class="spelling-section">
          <input
            v-model="spellingInput"
            type="text"
            class="spelling-input"
            disabled
          />
          <button class="submit-btn" disabled>提交</button>
        </div>
        <div class="spelling-feedback" v-if="spellingResult === 'correct'">
          <span class="fb-correct">&#10003; 正确!</span>
        </div>
        <div class="spelling-feedback" v-else-if="spellingResult === 'wrong'">
          <span class="fb-wrong">&#10007; 正确拼写: {{ spellingQueue[spellingIndex].word }}</span>
        </div>
      </div>
      <div class="next-area">
        <button ref="spellingNextBtnRef" class="next-btn" v-if="spellingResult === 'correct'" @click="handleSpellingNext">
          NEXT &#8594;
        </button>
        <button ref="spellingNextBtnRef" class="next-btn secondary" v-else @click="handleSpellingRetry">
          重新输入
        </button>
      </div>
    </div>

    <!-- Phase 1/Phase 2 Initial: word display + action -->
    <div class="card-container" v-else-if="currentWord">
      <div class="word-card">
        <div class="word-main">
          <h2 class="word-text">{{ currentWord }}</h2>
          <button class="speak-btn" @click="speak(currentWord)" title="朗读单词">
            &#128266;
          </button>
        </div>

        <p class="phonetic" v-if="currentPhonetic">/{{ currentPhonetic }}/</p>

        <!-- Green flash for 认识 -->
        <div class="success-flash" v-if="showSuccessFlash">
          <span>&#10003; 复习通过</span>
        </div>
      </div>

      <!-- Phase 1: 3 buttons -->
      <div class="answer-buttons" v-if="currentPhase === 1 && !showSuccessFlash">
        <button class="answer-btn wrong" @click="handleInitialAnswer('unknown')">
          不认识
        </button>
        <button class="answer-btn vague" @click="handleInitialAnswer('vague')">
          模糊
        </button>
        <button class="answer-btn correct" @click="handleInitialAnswer('know')">
          认识
        </button>
      </div>

    </div>

    <!-- Spelling Test Modal -->
    <div class="modal-overlay" v-if="showSpellingModal">
      <div class="modal-content">
        <h3 class="modal-title">是否进行拼写测试，加深记忆？</h3>
        <div class="modal-actions">
          <button class="modal-btn primary" @click="handleSpellingStart">必须的</button>
          <button class="modal-btn secondary" @click="handleSpellingSkip">算了吧</button>
        </div>
        <p class="modal-warning">&#9888;&#65039; 放弃后本次复习的单词将不再进入拼写测试，下次点击无法再次进入。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phase-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 10px;
  background: #e8f4fd;
  color: #4a90d9;
  font-weight: 500;
}

.progress-info {
  font-size: 14px;
  color: #888;
  min-width: 60px;
  text-align: right;
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

.loading,
.complete,
.empty-state,
.results {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.empty-state h2 {
  color: #333;
  margin-bottom: 8px;
}

.empty-state p {
  color: #888;
  margin-bottom: 24px;
}

.complete-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.results h2 {
  color: #333;
  margin-bottom: 20px;
}

.session-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #4a90d9;
}

.stat-value.correct-color {
  color: #16a34a;
}

.stat-value.vague-color {
  color: #f59e0b;
}

.stat-value.wrong-color {
  color: #dc2626;
}

.stat-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

.word-results-list {
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
  border: 1px solid #eee;
  border-radius: 10px;
}

.word-result-item {
  border-bottom: 1px solid #f0f0f0;
}

.word-result-item:last-child {
  border-bottom: none;
}

.wr-word {
  font-weight: 600;
  color: #333;
  min-width: 100px;
}

.wr-translation {
  flex: 1;
  font-size: 13px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wr-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  flex-shrink: 0;
}

.wr-badge.wr-know {
  background: #dcfce7;
  color: #16a34a;
}

.wr-badge.wr-vague {
  background: #fef3c7;
  color: #d97706;
}

.wr-badge.wr-unknown {
  background: #fee2e2;
  color: #dc2626;
}

.restart-btn {
  padding: 12px 32px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  transition: background 0.2s;
}

.restart-btn:hover {
  background: #357abd;
}

.detail-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-continue {
  padding-top: 12px;
  text-align: center;
}

.detail-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.card-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.word-card {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin-bottom: 24px;
}

.word-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.word-text {
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

.phonetic {
  color: #888;
  font-style: italic;
  font-size: 18px;
  margin-bottom: 24px;
}

.step-hint {
  font-size: 15px;
  color: #666;
  margin-bottom: 16px;
  font-weight: 500;
}

.meaning-display {
  background: #f0f7ff;
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 12px;
  width: 100%;
}

.meaning-text {
  font-size: 18px;
  color: #333;
  line-height: 1.6;
  margin: 0;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.meaning-grid {
  grid-template-columns: 1fr;
}

.option-btn {
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
  color: #333;
  transition: all 0.2s;
  text-align: center;
}

.option-btn:hover:not(:disabled) {
  border-color: #4a90d9;
  background: #f0f7ff;
}

.option-btn:disabled {
  cursor: default;
}

.option-btn.word-option {
  font-weight: 600;
  text-transform: capitalize;
}

.option-btn.meaning-option {
  font-size: 14px;
  text-align: left;
  line-height: 1.5;
}

.option-btn.option-correct {
  border-color: #16a34a;
  background: #dcfce7;
  color: #16a34a;
}

.option-btn.option-wrong {
  border-color: #dc2626;
  background: #fee2e2;
  color: #dc2626;
}

.answer-buttons {
  display: flex;
  gap: 12px;
}

.answer-btn {
  flex: 1;
  padding: 16px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 500;
  transition: all 0.2s;
}

.answer-btn.wrong {
  background: #fee2e2;
  color: #dc2626;
}

.answer-btn.wrong:hover {
  background: #fecaca;
}

.answer-btn.vague {
  background: #fef3c7;
  color: #d97706;
}

.answer-btn.vague:hover {
  background: #fde68a;
}

.answer-btn.correct {
  background: #dcfce7;
  color: #16a34a;
}

.answer-btn.correct:hover {
  background: #bbf7d0;
}

.answer-btn.primary {
  background: #4a90d9;
  color: #fff;
}

.answer-btn.primary:hover {
  background: #357abd;
}

.success-flash {
  background: #dcfce7;
  color: #16a34a;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  margin-top: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.next-area {
  text-align: center;
  margin-top: 8px;
}

.next-btn {
  padding: 14px 48px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background 0.2s;
}

.next-btn:hover {
  background: #357abd;
}

.next-btn.secondary {
  background: #fff;
  color: #d97706;
  border: 2px solid #d97706;
}

.next-btn.secondary:hover {
  background: #fef3c7;
}

/* Spelling test */
.speak-btn.large {
  font-size: 18px;
  padding: 12px 24px;
  margin-bottom: 24px;
}

.spelling-section {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 400px;
}

.spelling-input {
  flex: 1;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 18px;
  outline: none;
  transition: border-color 0.2s;
}

.spelling-input:focus {
  border-color: #4a90d9;
}

.spelling-input:disabled {
  background: #f9fafb;
  color: #666;
}

.submit-btn {
  padding: 14px 24px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #357abd;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: default;
}

.spelling-feedback {
  margin-top: 20px;
  font-size: 20px;
  font-weight: 600;
}

.fb-correct {
  color: #16a34a;
}

.fb-wrong {
  color: #dc2626;
}

.spelling-round-hint {
  font-size: 14px;
  color: #888;
  margin-bottom: 20px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 18px;
  color: #333;
  margin: 0 0 24px 0;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-btn {
  padding: 12px 28px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
}

.modal-btn.primary {
  background: #4a90d9;
  color: #fff;
}

.modal-btn.primary:hover {
  background: #357abd;
}

.modal-btn.secondary {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
}

.modal-btn.secondary:hover {
  background: #eee;
}

.modal-warning {
  margin-top: 16px;
  font-size: 12px;
  color: #d97706;
  line-height: 1.5;
}

.wr-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  gap: 8px;
  user-select: none;
}

.wr-row:hover {
  background: #f9fafb;
}

.wr-wrong {
  font-size: 12px;
  color: #dc2626;
  font-weight: 500;
}

.wr-wrong.wr-ok {
  color: #16a34a;
}

.wr-arrow {
  margin-left: auto;
  font-size: 10px;
  color: #bbb;
  transition: transform 0.2s;
}

.wr-arrow-open {
  transform: rotate(90deg);
}

.wr-detail {
  padding: 0 16px 12px;
  border-top: 1px solid #f0f0f0;
}

.wr-phonetic {
  color: #888;
  font-style: italic;
  font-size: 14px;
  margin: 8px 0 4px;
}

.wr-def {
  font-size: 14px;
  color: #444;
  margin: 2px 0;
  line-height: 1.5;
}

.wr-def-en {
  font-size: 13px;
  color: #888;
  margin: 2px 0;
  line-height: 1.5;
}
</style>
