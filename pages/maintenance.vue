<template>
  <div class="maintenance-page">
    <div class="maintenance-card">
      <h1 class="title">关服维护中</h1>
      <div class="divider"></div>
      <p class="line">服务器正在进行公测前数据清理与维护</p>
      <p class="line reopen">预计 <span class="date">2026 年 5 月 19 日</span> 重新开服</p>
      <p class="hint">届时将以全新数据公测，敬请期待</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: [] })
useHead({ title: '关服维护中 — 万界仙途' })
</script>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 30%, #1a1410 0%, #0a0807 100%);
  color: #d4b78e;
  font-family: '微软雅黑', sans-serif;
  padding: 24px;
}
.maintenance-card {
  max-width: 520px;
  text-align: center;
  border: 1px solid #5a4a36;
  background: rgba(20, 16, 12, 0.85);
  padding: 48px 32px;
  border-radius: 8px;
  box-shadow: 0 0 32px rgba(212, 183, 142, 0.08);
}
.title {
  font-size: 32px;
  letter-spacing: 8px;
  margin: 0 0 16px;
  color: #e8c98a;
}
.divider {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #d4b78e, transparent);
  margin: 0 auto 24px;
}
.line {
  font-size: 16px;
  line-height: 1.8;
  margin: 8px 0;
  color: #c0a878;
}
.reopen .date {
  color: #f0d29c;
  font-weight: bold;
  padding: 0 4px;
}
.hint {
  font-size: 13px;
  color: #8a7656;
  margin-top: 20px;
}
</style>
