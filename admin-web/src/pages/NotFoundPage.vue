<template>
  <div class="not-found">
    <span>404</span>
    <h1>页面不存在</h1>
    <router-link to="/">返回运营概览</router-link>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: grid;
  align-content: center;
  justify-items: center;
  color: #2f2a23;
  background: #f6f1e7;
}

.not-found span {
  color: #c9b48f;
  font-family: "IBM Plex Mono", monospace;
  font-size: 80px;
}

.not-found h1 {
  font-family: "Source Han Serif SC", serif;
}

.not-found a {
  color: #a77d3f;
}
</style>
