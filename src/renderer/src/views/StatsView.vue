<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const router = useRouter()
const route = useRoute()

const currentLevel = ref<'all' | 'cet4' | 'cet6'>(
  (route.query.level as 'cet4' | 'cet6') || 'all'
)

const summary = ref({
  totalWords: 0,
  mastered: 0,
  learning: 0,
  review: 0,
  newWords: 0,
  totalErrors: 0,
  streakDays: 0
})

const dailyData = ref<{ date: string; learned: number; reviewed: number; errors: number }[]>([])
const loading = ref(true)

async function loadData(): Promise<void> {
  loading.value = true
  const level = currentLevel.value === 'all' ? undefined : currentLevel.value
  const [s, d] = await Promise.all([
    window.electronAPI.getStatsSummary(level),
    window.electronAPI.getDailyStats(30)
  ])
  summary.value = s
  dailyData.value = d
  loading.value = false
}

function goBack(): void {
  router.push('/')
}

function switchLevel(level: 'all' | 'cet4' | 'cet6'): void {
  currentLevel.value = level
}

watch(currentLevel, () => {
  loadData()
})

onMounted(() => {
  loadData()
})

const chartData = ref({
  labels: dailyData.value.map((d) => d.date.slice(5)),
  datasets: [
    {
      label: '学习新词',
      backgroundColor: '#4a90d9',
      data: dailyData.value.map((d) => d.learned)
    },
    {
      label: '复习单词',
      backgroundColor: '#16a34a',
      data: dailyData.value.map((d) => d.reviewed)
    }
  ]
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    },
    title: {
      display: true,
      text: '最近30天学习/复习量'
    }
  },
  scales: {
    x: {
      grid: { display: false }
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 }
    }
  }
}

watch(dailyData, (data) => {
  chartData.value = {
    labels: data.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: '学习新词',
        backgroundColor: '#4a90d9',
        data: data.map((d) => d.learned)
      },
      {
        label: '复习单词',
        backgroundColor: '#16a34a',
        data: data.map((d) => d.reviewed)
      }
    ]
  }
})

const errorChartData = ref({
  labels: [] as string[],
  datasets: [{ label: '错误次数', backgroundColor: '#dc2626', data: [] as number[] }]
})

watch(dailyData, (data) => {
  errorChartData.value = {
    labels: data.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: '错误次数',
        backgroundColor: '#dc2626',
        data: data.map((d) => d.errors)
      }
    ]
  }
})

const errorChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    title: { display: true, text: '最近30天错误次数' }
  },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { stepSize: 1 } }
  }
}
</script>

<template>
  <div class="stats-page">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回首页</button>
      <h1>学习统计</h1>
      <div class="placeholder"></div>
    </div>

    <!-- Level switcher -->
    <div class="level-tabs">
      <button
        class="tab-btn"
        :class="{ active: currentLevel === 'all' }"
        @click="switchLevel('all')"
      >全部</button>
      <button
        class="tab-btn"
        :class="{ active: currentLevel === 'cet4' }"
        @click="switchLevel('cet4')"
      >四级</button>
      <button
        class="tab-btn"
        :class="{ active: currentLevel === 'cet6' }"
        @click="switchLevel('cet6')"
      >六级</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <!-- Summary cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">{{ summary.totalWords }}</div>
          <div class="summary-label">总单词数</div>
        </div>
        <div class="summary-card">
          <div class="summary-value mastered">{{ summary.mastered }}</div>
          <div class="summary-label">已掌握</div>
        </div>
        <div class="summary-card">
          <div class="summary-value streak">{{ summary.streakDays }}</div>
          <div class="summary-label">连续学习(天)</div>
        </div>
        <div class="summary-card">
          <div class="summary-value errors">{{ summary.totalErrors }}</div>
          <div class="summary-label">总错误次数</div>
        </div>
      </div>

      <!-- Bar chart: learned + reviewed -->
      <div class="chart-card">
        <div class="chart-container">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Bar chart: errors -->
      <div class="chart-card">
        <div class="chart-container">
          <Bar :data="errorChartData" :options="errorChartOptions" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 20px;
  max-width: 700px;
  margin: 0 auto;
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
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

.level-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.tab-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

.tab-btn:hover:not(.active) {
  background: #f0f0f0;
}

.loading {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 15px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.summary-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 20px 12px;
  text-align: center;
}

.summary-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.summary-value.mastered {
  color: #16a34a;
}

.summary-value.streak {
  color: #e67e22;
}

.summary-value.errors {
  color: #dc2626;
}

.summary-label {
  font-size: 12px;
  color: #999;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 20px;
  margin-bottom: 20px;
}

.chart-container {
  height: 260px;
}
</style>
