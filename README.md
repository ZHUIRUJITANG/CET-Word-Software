# CET 单词软件离线版

一款**完全离线**的 CET-4 / CET-6 背单词桌面应用，融合四遍学习法与 SM-2 间隔重复算法，帮你高效记忆单词。

## ✨ 主要功能

- **四六级独立词库**：内置 ECDICT 开源词库，支持四级 / 六级独立学习与复习
- **四遍渐进式学习**：认识判断 → 看释义选单词 → 看单词选释义 → 听音拼写，层层强化
- **科学复习算法**：基于 SM-2 算法自动安排复习计划，支持认识 / 模糊 / 不认识三档评分
- **拼写测试**：复习后可选拼写加深记忆，错误自动轮回直到一次正确
- **垃圾桶标记**：学习时可快速标记已掌握的单词，支持设置中管理
- **学习统计仪表盘**：可视化每日学习量、复习量、连续天数等数据
- **记忆恢复**：关闭应用后自动保存进度，下次打开无缝衔接
- **完全离线**：所有数据本地存储，无需网络，无需登录

## 🛠️ 技术栈

- **框架**：Electron + Vue 3 + Vite + TypeScript
- **数据库**：SQLite (ECDICT 词库)
- **发音**：Web Speech API（系统自带英文语音包）
- **打包**：electron-builder

## 📦 下载安装

前往 前往 [Releases](https://github.com/ZHUIRUJITANG/CET-Word-Software/releases) 页面下载最新版 `.exe` 安装包，双击安装即可使用。

## 🚀 本地开发

```bash
# 克隆仓库
git clone https://github.com/ZHUIRUJITANG/CET-Word-Software.git
cd cd CET-Word-Software

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打包为 Windows 安装包
npm run build:win
