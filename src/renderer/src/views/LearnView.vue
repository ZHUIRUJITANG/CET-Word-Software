<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WordDetailCard from '../components/WordDetailCard.vue'

const route = useRoute()
const router = useRouter()
const level = ref((route.query.level as string) || 'cet4')
const title = ref(level.value === 'cet4' ? '四级词汇学习' : '六级词汇学习')

const sessionId = ref('')
const loading = ref(false)
const isComplete = ref(false)

const currentWord = ref('')
const currentStep = ref<1 | 2 | 3 | 4>(1)
const currentPhonetic = ref('')
const currentTranslation = ref('')
const currentDefinition = ref('')
const options = ref<string[]>([])
const meaningOptions = ref<string[]>([])
const optionItems = ref<OptionItem[]>([])

const masteredCount = ref(0)
const totalCount = ref(0)

const feedbackCorrect = ref(false)
const feedbackWrong = ref(false)
const feedbackAnswer = ref('')
const showFeedback = ref(false)
const spellingInput = ref('')
const spellingResult = ref<'correct' | 'wrong' | null>(null)
const spellingCorrectAnswer = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function focusInput(): void {
  nextTick(() => inputRef.value?.focus())
  setTimeout(() => inputRef.value?.focus(), 50)
  setTimeout(() => inputRef.value?.focus(), 150)
  setTimeout(() => inputRef.value?.focus(), 300)
}

const finalStats = ref<SessionStats | null>(null)

interface WordResult {
  word: string
  phonetic: string
  translation: string
  definition: string
  wrongCount: number
}

const wordResults = ref<Map<string, WordResult>>(new Map())
const wordResultsList = ref<WordResult[]>([])
const expandedWordIndex = ref<number | null>(null)

const showNextButton = ref(false)

// Detail page state: shown after step 1-3 answer, before advancing
const detailState = ref<{ step: 1 | 2 | 3; answer: string; buttonLabel: string } | null>(null)
const detailNextBtnRef = ref<HTMLButtonElement | null>(null)
const spellingNextBtnRef = ref<HTMLButtonElement | null>(null)

// NEXT button refs for Enter key support and auto-focus
const feedbackNextBtnRef = ref<HTMLButtonElement | null>(null)

function handleGlobalKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter') return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  // Detail page NEXT (steps 1-3)
  if (detailState.value) {
    e.preventDefault()
    handleDetailContinue()
    return
  }
  // Step 4 spelling correct → next word
  if (currentStep.value === 4 && spellingResult.value === 'correct') {
    e.preventDefault()
    handleSpellingNext()
    return
  }
  // Steps 2-3 wrong answer feedback NEXT
  if (showFeedback.value && showNextButton.value) {
    e.preventDefault()
    handleNextFromFeedback()
    return
  }
}

// Auto-focus NEXT button when it appears
watch(
  () => currentStep.value === 4 && spellingResult.value === 'correct',
  (visible) => {
    if (visible) {
      nextTick(() => spellingNextBtnRef.value?.focus())
      setTimeout(() => spellingNextBtnRef.value?.focus(), 50)
    }
  }
)
// Re-focus spelling input when step 4 is active and input should be enabled
watch(
  () => currentStep.value === 4 && spellingResult.value !== 'correct',
  (shouldFocus) => {
    if (shouldFocus) {
      focusInput()
    }
  }
)
watch(
  () => showFeedback.value && showNextButton.value,
  (visible) => {
    if (visible) {
      nextTick(() => feedbackNextBtnRef.value?.focus())
      setTimeout(() => feedbackNextBtnRef.value?.focus(), 50)
    }
  }
)
watch(
  () => !!detailState.value,
  (visible) => {
    if (visible) {
      nextTick(() => detailNextBtnRef.value?.focus())
      setTimeout(() => detailNextBtnRef.value?.focus(), 50)
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

async function startLearning(recoverSessionId?: string): Promise<void> {
  loading.value = true
  isComplete.value = false
  finalStats.value = null
  wordResults.value = new Map()
  wordResultsList.value = []
  expandedWordIndex.value = null

  try {
    if (recoverSessionId) {
      sessionId.value = recoverSessionId
      masteredCount.value = 0
      totalCount.value = 0
      await loadNextWord()
    } else {
      const session = await window.electronAPI.createSession(level.value)
      sessionId.value = session.sessionId
      totalCount.value = session.words.length
      masteredCount.value = 0
      await loadNextWord()
    }
  } catch (e) {
    console.error('[Learn] Failed to create session:', e)
  }

  loading.value = false
}

async function loadNextWord(): Promise<void> {
  if (!sessionId.value) return

  const result = await window.electronAPI.getNextWord(sessionId.value)

  if (result.done) {
    buildWordResultsList()
    isComplete.value = true
    finalStats.value = result.stats || null
    currentWord.value = ''
    window.electronAPI.saveAppState({ activeSession: null })
    return
  }

  applyWordResult(result)
}

function applyWordResult(result: NextWordResult): void {
  currentWord.value = result.word || ''
  currentStep.value = result.step || 1
  currentPhonetic.value = result.phonetic || ''
  currentTranslation.value = result.translation || ''
  currentDefinition.value = result.definition || ''

  // Track word for results list
  if (currentWord.value && !wordResults.value.has(currentWord.value)) {
    wordResults.value.set(currentWord.value, {
      word: currentWord.value,
      phonetic: currentPhonetic.value,
      translation: currentTranslation.value,
      definition: currentDefinition.value,
      wrongCount: 0
    })
  }
  options.value = result.options || []
  meaningOptions.value = result.meaningOptions || []
  optionItems.value = result.optionItems || []
  masteredCount.value = result.masteredCount || 0
  totalCount.value = result.totalCount || 0
  showFeedback.value = false
  feedbackCorrect.value = false
  feedbackWrong.value = false
  feedbackAnswer.value = ''
  spellingInput.value = ''
  spellingResult.value = null
  spellingCorrectAnswer.value = ''
  showNextButton.value = false
  detailState.value = null

  if (currentStep.value === 4) {
    focusInput()
  }

  if (currentWord.value && (currentStep.value === 1 || currentStep.value === 4)) {
    setTimeout(() => {
      try { speak(currentWord.value) } catch { /* auto-play blocked */ }
    }, 200)
  }
}

async function advanceToNextWord(result: SubmitResult): Promise<void> {
  if (result.nextWord) {
    applyWordResult(result.nextWord)
  } else {
    await loadNextWord()
  }
}

async function submitStep(answer: string): Promise<void> {
  if (!currentWord.value || !sessionId.value) return

  if (currentStep.value === 2 || currentStep.value === 3) {
    speak(currentWord.value)
  }

  const result = await window.electronAPI.submitAnswer(
    sessionId.value,
    currentWord.value,
    answer
  )

  if (result.correct) {
    feedbackCorrect.value = true
    feedbackWrong.value = false
    showFeedback.value = true

    if (result.mastered) {
      feedbackAnswer.value = '掌握!'
    } else {
      feedbackAnswer.value = `第 ${result.currentStep} 遍通过`
    }

    // Step 4: always show NEXT button even on correct
    if (currentStep.value === 4) {
      spellingResult.value = 'correct'
      showNextButton.value = true
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 800))

    if (result.isDone) {
      const stats = await window.electronAPI.endSession(sessionId.value)
      finalStats.value = stats
      buildWordResultsList()
      isComplete.value = true
      return
    }

    await advanceToNextWord(result)
  } else {
    feedbackCorrect.value = false
    feedbackWrong.value = true
    showFeedback.value = true
    feedbackAnswer.value = result.correctAnswer || ''

    // Track wrong count for this word
    const entry = wordResults.value.get(currentWord.value)
    if (entry) entry.wrongCount++

    if (currentStep.value === 4) {
      spellingResult.value = 'wrong'
      spellingCorrectAnswer.value = result.correctAnswer || ''
    }

    if (currentStep.value === 1 || currentStep.value === 4) {
      speak(currentWord.value)
    }

    if (result.isDone) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const stats = await window.electronAPI.endSession(sessionId.value)
      finalStats.value = stats
      buildWordResultsList()
      isComplete.value = true
      return
    }

    showNextButton.value = true
  }
}

async function handleNextFromFeedback(): Promise<void> {
  showNextButton.value = false
  showFeedback.value = false
  await loadNextWord()
}

function handleKnow(): void {
  detailState.value = { step: 1, answer: 'know', buttonLabel: '继续学习' }
}

function handleDontKnow(): void {
  detailState.value = { step: 1, answer: 'unknown', buttonLabel: '继续学习' }
}

async function handleOptionClick(option: string): Promise<void> {
  const result = await window.electronAPI.submitAnswer(sessionId.value, currentWord.value, option)
  if (result.correct) {
    detailState.value = { step: currentStep.value as 2 | 3, answer: option, buttonLabel: '继续学习' }
  } else {
    const entry = wordResults.value.get(currentWord.value)
    if (entry) entry.wrongCount++
    feedbackCorrect.value = false
    feedbackWrong.value = true
    showFeedback.value = true
    feedbackAnswer.value = result.correctAnswer || ''
    showNextButton.value = true
    speak(currentWord.value)
  }
}

async function handleMeaningClick(meaning: string): Promise<void> {
  const result = await window.electronAPI.submitAnswer(sessionId.value, currentWord.value, meaning)
  if (result.correct) {
    detailState.value = { step: currentStep.value as 2 | 3, answer: meaning, buttonLabel: '继续学习' }
  } else {
    const entry = wordResults.value.get(currentWord.value)
    if (entry) entry.wrongCount++
    feedbackCorrect.value = false
    feedbackWrong.value = true
    showFeedback.value = true
    feedbackAnswer.value = result.correctAnswer || ''
    showNextButton.value = true
    speak(currentWord.value)
  }
}

async function handleSpellingSubmit(): Promise<void> {
  if (!spellingInput.value.trim()) return
  const answer = spellingInput.value
  spellingInput.value = ''
  console.log('[Step4] Submitting:', answer, 'spellingResult before:', spellingResult.value)
  const result = await window.electronAPI.submitAnswer(sessionId.value, currentWord.value, answer)
  console.log('[Step4] Result:', result.correct, 'currentStep:', currentStep.value)

  if (result.correct) {
    spellingResult.value = 'correct'
    setTimeout(() => speak(currentWord.value), 100)
    if (result.isDone) {
      setTimeout(async () => {
        const stats = await window.electronAPI.endSession(sessionId.value)
        finalStats.value = stats
        buildWordResultsList()
        isComplete.value = true
      }, 500)
    }
  } else {
    spellingResult.value = 'wrong'
    spellingCorrectAnswer.value = result.correctAnswer || ''
    const entry = wordResults.value.get(currentWord.value)
    if (entry) entry.wrongCount++
    console.log('[Step4] Wrong — spellingResult:', spellingResult.value, 'disabled will be:', spellingResult.value === 'correct')
    setTimeout(() => speak(currentWord.value), 100)
    focusInput()
  }
}

async function handleSpellingNext(): Promise<void> {
  spellingResult.value = null
  spellingCorrectAnswer.value = ''
  await loadNextWord()
}

async function handleDetailContinue(): Promise<void> {
  if (!detailState.value) return
  const { step, answer } = detailState.value
  detailState.value = null
  if (step === 1) {
    // Step 1: answer not yet submitted to backend
    await window.electronAPI.submitAnswer(sessionId.value, currentWord.value, answer)
    await loadNextWord()
  } else {
    // Steps 2-3: answer already submitted in click handler, just advance
    await loadNextWord()
  }
}

async function handleMarkWrong(): Promise<void> {
  if (!currentWord.value || !level.value) return
  await window.electronAPI.markAsWrong(currentWord.value, level.value, 'learn')
  showFeedback.value = false
  showNextButton.value = false
  await loadNextWord()
}

function buildWordResultsList(): void {
  wordResultsList.value = Array.from(wordResults.value.values())
}

function handleWordExpand(index: number): void {
  if (expandedWordIndex.value === index) {
    expandedWordIndex.value = null
  } else {
    expandedWordIndex.value = index
    speak(wordResultsList.value[index].word)
  }
}

async function handleRestart(): Promise<void> {
  if (sessionId.value) {
    await window.electronAPI.endSession(sessionId.value)
  }
  await startLearning()
}

async function handleTrashClick(): Promise<void> {
  if (!currentWord.value) return
  const confirmed = window.confirm('确定要将该单词标记为已掌握吗？它将不再出现在学习和复习中。')
  if (!confirmed) return

  await window.electronAPI.markMasteredTrash(level.value, currentWord.value)

  if (sessionId.value) {
    const result = await window.electronAPI.getNextWord(sessionId.value)
    if (result.done) {
      buildWordResultsList()
      isComplete.value = true
      finalStats.value = result.stats || null
      currentWord.value = ''
      const stats = await window.electronAPI.endSession(sessionId.value)
      finalStats.value = stats
    } else {
      applyWordResult(result)
    }
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown)
  const state = await window.electronAPI.getAppState()
  if (state.activeSession?.type === 'learn') {
    level.value = state.activeSession.level as string
    title.value = level.value === 'cet4' ? '四级词汇学习' : '六级词汇学习'
    await startLearning(state.activeSession.sessionId)
  } else {
    await startLearning()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="learn">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回首页</button>
      <h1>{{ title }}</h1>
      <div class="header-right">
        <div class="progress-info" v-if="totalCount > 0 && !isComplete">
          已掌握: {{ masteredCount }}/{{ totalCount }}
        </div>
        <button
          class="trash-btn"
          v-if="currentWord && !isComplete"
          @click="handleTrashClick"
          title="跳过此单词（标记为已掌握）"
        >
          &#128465;
        </button>
      </div>
    </div>

    <div class="loading" v-if="loading">
      <p>加载中...</p>
    </div>

    <div class="complete" v-else-if="isComplete">
      <div class="complete-icon">&#10003;</div>
      <h2>今日学习已完成</h2>
      <div class="session-stats" v-if="finalStats">
        <div class="stat">
          <span class="stat-value">{{ finalStats.totalWords }}</span>
          <span class="stat-label">学习单词</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ finalStats.errorCount }}</span>
          <span class="stat-label">错误次数</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ finalStats.masteredCount }}</span>
          <span class="stat-label">已掌握</span>
        </div>
      </div>
      <div class="word-results-list" v-if="wordResultsList.length > 0">
        <div class="word-result-item" v-for="(item, i) in wordResultsList" :key="i">
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
      <div class="result-actions">
        <button class="restart-btn" @click="handleRestart">重新开始</button>
        <button class="restart-btn secondary" @click="goBack">返回首页</button>
      </div>
    </div>

    <div class="card-container" v-else-if="currentWord">
      <div class="step-indicator">
        第 {{ currentStep }}/4 遍
      </div>

      <!-- Detail page: shown after steps 1-3 answer -->
      <template v-if="detailState">
        <WordDetailCard
          :word="currentWord"
          mode="learn"
          :level="level"
          :showActions="false"
        />
        <div class="detail-actions">
          <button ref="detailNextBtnRef" class="next-btn" @click="handleDetailContinue">
            {{ detailState.buttonLabel }}
          </button>
        </div>
      </template>

      <!-- Step 1: Recognition -->
      <div class="word-card" v-if="!detailState && currentStep === 1">
        <div class="word-main">
          <h2 class="word-text">{{ currentWord }}</h2>
          <button class="speak-btn" @click="speak(currentWord)" title="朗读单词">
            &#128266;
          </button>
        </div>
        <p class="phonetic" v-if="currentPhonetic">/{{ currentPhonetic }}/</p>
      </div>

      <!-- Step 2: Meaning shown, pick correct word -->
      <div class="word-card" v-else-if="!detailState && currentStep === 2">
        <p class="step-hint">选出正确的单词</p>
        <div class="meaning-display">
          <p class="meaning-text">{{ currentTranslation }}</p>
        </div>
        <button class="speak-btn" @click="speak(currentWord)" title="朗读单词">
          &#128266;
        </button>
        <div class="options-grid">
          <button
            v-for="(item, i) in optionItems"
            :key="i"
            class="option-btn word-option"
            :class="{
              'option-correct': showFeedback && item.word.toLowerCase() === currentWord.toLowerCase(),
              'option-wrong': showFeedback && feedbackWrong && item.word.toLowerCase() !== currentWord.toLowerCase()
            }"
            @click="handleOptionClick(item.word)"
            :disabled="showFeedback"
          >
            <span v-if="showFeedback">{{ item.word }} {{ item.translation }}</span>
            <span v-else>{{ item.word }}</span>
          </button>
        </div>
      </div>

      <!-- Step 3: Meaning selection -->
      <div class="word-card" v-else-if="!detailState && currentStep === 3">
        <p class="step-hint">选择正确的中文释义</p>
        <div class="word-main">
          <h2 class="word-text">{{ currentWord }}</h2>
          <button class="speak-btn" @click="speak(currentWord)" title="朗读单词">
            &#128266;
          </button>
        </div>
        <div class="options-grid meaning-grid">
          <button
            v-for="(item, i) in optionItems"
            :key="i"
            class="option-btn meaning-option"
            :class="{
              'option-correct': showFeedback && item.translation === currentTranslation,
              'option-wrong': showFeedback && feedbackWrong && item.translation !== currentTranslation
            }"
            @click="handleMeaningClick(item.translation)"
            :disabled="showFeedback"
          >
            <span v-if="showFeedback">{{ item.word }} {{ item.translation }}</span>
            <span v-else>{{ item.translation }}</span>
          </button>
        </div>
      </div>

      <!-- Step 4: Spelling loop (no detail page, no step regression) -->
      <div class="word-card" v-else-if="!detailState && currentStep === 4">
        <p class="step-hint">听发音，拼写单词</p>
        <button class="speak-btn large" @click="speak(currentWord)" title="再听一次">
          &#128266; 再听一次
        </button>
        <div class="spelling-section">
          <input
            ref="inputRef"
            v-model="spellingInput"
            type="text"
            class="spelling-input"
            placeholder="请输入单词..."
            @keyup.enter="handleSpellingSubmit"
            :disabled="spellingResult === 'correct'"
          />
          <button
            class="submit-btn"
            @click="handleSpellingSubmit"
            :disabled="!spellingInput.trim() || spellingResult === 'correct'"
          >
            提交
          </button>
        </div>
        <div class="spelling-feedback" v-if="spellingResult === 'correct'">
          <span class="fb-correct">&#10003; 正确!</span>
          <div class="spelling-confirm">
            <p class="confirm-word">{{ currentWord }}</p>
            <p class="confirm-phonetic" v-if="currentPhonetic">/{{ currentPhonetic }}/</p>
            <p class="confirm-translation">{{ currentTranslation }}</p>
          </div>
          <button ref="spellingNextBtnRef" class="next-btn" @click="handleSpellingNext">
            下一个单词
          </button>
        </div>
        <div class="spelling-feedback" v-else-if="spellingResult === 'wrong'">
          <span class="fb-wrong">&#10007; 正确拼写: {{ spellingCorrectAnswer }}</span>
        </div>
      </div>

      <!-- Feedback overlay (steps 2-3 wrong answer) -->
      <div class="feedback" v-if="!detailState && showFeedback && currentStep !== 4">
        <div class="feedback-inner" :class="{ correct: feedbackCorrect, wrong: feedbackWrong }">
          <span v-if="feedbackCorrect">&#10003; {{ feedbackAnswer }}</span>
          <span v-else>&#10007; 正确答案: {{ feedbackAnswer }}</span>
        </div>
        <button ref="feedbackNextBtnRef" class="next-btn" v-if="showNextButton" @click="handleNextFromFeedback">
          NEXT &#8594;
        </button>
      </div>

      <!-- Step 1 buttons -->
      <div class="answer-buttons" v-if="!detailState && currentStep === 1 && !showFeedback">
        <button class="answer-btn wrong" @click="handleDontKnow">不认识</button>
        <button class="answer-btn correct" @click="handleKnow">认识</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learn {
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
  margin-bottom: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trash-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.trash-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.header h1 {
  color: #333;
  font-size: 20px;
  margin: 0;
}

.progress-info {
  font-size: 14px;
  color: #888;
  min-width: 120px;
  text-align: right;
}

.placeholder {
  width: 120px;
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
.complete {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
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

.complete h2 {
  color: #333;
  margin-bottom: 24px;
}

.session-stats {
  display: flex;
  gap: 32px;
  margin-bottom: 32px;
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

.stat-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
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

.card-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.step-indicator {
  text-align: center;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 12px;
}

.word-card {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin-bottom: 20px;
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

.speak-btn.large {
  font-size: 16px;
  padding: 10px 20px;
  margin-bottom: 20px;
}

.phonetic {
  color: #888;
  font-style: italic;
  font-size: 18px;
  margin-bottom: 8px;
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

.step-hint {
  font-size: 15px;
  color: #666;
  margin-bottom: 16px;
  font-weight: 500;
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

.spelling-section {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  margin-top: 8px;
}

.spelling-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 18px;
  outline: none;
  transition: border-color 0.2s;
  text-transform: lowercase;
}

.spelling-input:focus {
  border-color: #4a90d9;
}

.spelling-input:disabled {
  background: #f9fafb;
  cursor: default;
}

.submit-btn {
  padding: 12px 24px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #357abd;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.spelling-feedback {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 600;
}

.fb-correct {
  color: #16a34a;
}

.fb-wrong {
  color: #dc2626;
}

.spelling-confirm {
  margin-top: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  text-align: center;
}

.confirm-word {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
}

.confirm-phonetic {
  color: #888;
  font-style: italic;
  font-size: 16px;
  margin: 0 0 8px;
}

.confirm-translation {
  font-size: 15px;
  color: #555;
  margin: 0;
  line-height: 1.5;
}

.feedback {
  margin-top: 12px;
  text-align: center;
}

.feedback-inner {
  display: inline-block;
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 500;
}

.feedback-inner.correct {
  background: #dcfce7;
  color: #16a34a;
}

.feedback-inner.wrong {
  background: #fee2e2;
  color: #dc2626;
}

.feedback-actions {
  margin-top: 8px;
}

.mark-wrong-btn {
  padding: 6px 16px;
  background: #fff;
  color: #e67e22;
  border: 1px solid #e67e22;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.mark-wrong-btn:hover {
  background: #fef5e7;
}

.answer-buttons {
  display: flex;
  gap: 16px;
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

.answer-btn.correct {
  background: #dcfce7;
  color: #16a34a;
}

.answer-btn.correct:hover {
  background: #bbf7d0;
}

.next-btn {
  display: block;
  margin: 16px auto 0;
  padding: 12px 40px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background 0.2s;
}

.next-btn:hover {
  background: #357abd;
}

.detail-actions {
  text-align: center;
  margin-top: 12px;
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

.wr-word {
  font-weight: 600;
  color: #333;
  min-width: 100px;
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

.result-actions {
  display: flex;
  gap: 12px;
}

.restart-btn.secondary {
  background: #fff;
  color: #555;
  border: 1px solid #ddd;
}

.restart-btn.secondary:hover {
  background: #f5f5f5;
}
</style>
