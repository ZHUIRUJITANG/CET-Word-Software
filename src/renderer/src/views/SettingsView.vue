<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack(): void {
  router.push('/')
}

function goTo(path: string): void {
  router.push(path)
}
</script>

<template>
  <div class="settings-page">
    <div class="header">
      <button class="back-btn" @click="goBack">&larr; 返回首页</button>
      <h1>设置</h1>
      <div class="placeholder"></div>
    </div>

    <div class="menu-list">
      <div class="menu-item" @click="goTo('/settings/group-size')">
        <div class="menu-icon">&#128203;</div>
        <div class="menu-content">
          <div class="menu-title">每组单词数量</div>
          <div class="menu-desc">设置学习和复习时每组的单词数</div>
        </div>
        <div class="menu-arrow">&#8250;</div>
      </div>

      <div class="menu-item" @click="goTo('/settings/trash')">
        <div class="menu-icon">&#128465;</div>
        <div class="menu-content">
          <div class="menu-title">垃圾桶标记</div>
          <div class="menu-desc">管理被标记为跳过的单词</div>
        </div>
        <div class="menu-arrow">&#8250;</div>
      </div>

      <div class="menu-item" @click="goTo('/settings/mastered')">
        <div class="menu-icon">&#9989;</div>
        <div class="menu-content">
          <div class="menu-title">已掌握单词</div>
          <div class="menu-desc">查看和管理已掌握的单词</div>
        </div>
        <div class="menu-arrow">&#8250;</div>
      </div>

      <div class="menu-item" @click="goTo('/settings/reset')">
        <div class="menu-icon">&#128260;</div>
        <div class="menu-content">
          <div class="menu-title">重置学习数据</div>
          <div class="menu-desc">清空指定范围的学习记录</div>
        </div>
        <div class="menu-arrow">&#8250;</div>
      </div>

      <div class="menu-item" @click="goTo('/stats')">
        <div class="menu-icon">&#128200;</div>
        <div class="menu-content">
          <div class="menu-title">学习统计</div>
          <div class="menu-desc">查看每日学习/复习量和错误趋势</div>
        </div>
        <div class="menu-arrow">&#8250;</div>
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

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 18px 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.menu-icon {
  font-size: 24px;
  margin-right: 16px;
  width: 36px;
  text-align: center;
}

.menu-content {
  flex: 1;
}

.menu-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.menu-desc {
  font-size: 13px;
  color: #999;
}

.menu-arrow {
  font-size: 22px;
  color: #ccc;
  margin-left: 8px;
}
</style>
