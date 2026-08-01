<template>
 <div class="card">
   <slot />
 </div>
</template>

<style scoped>
.card {
 background: var(--color-card-bg);
 padding: 16px;
 border: 1px solid var(--color-card-border);
 border-radius: var(--radius-card);
}
</style>
