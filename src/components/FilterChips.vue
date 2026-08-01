<script setup>
defineProps({
  options: { type: Array, required: true }, // [{ key, label }]
  modelValue: { type: String, required: true },
})

defineEmits(["update:modelValue"])
</script>

<template>
  <div class="filter-chips">
    <button
      v-for="opt in options"
      :key="opt.key"
      type="button"
      class="filter-chip"
      :class="{ 'filter-chip--active': modelValue === opt.key }"
      @click="$emit('update:modelValue', opt.key)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}

.filter-chip {
  flex-shrink: 0;
  padding: 7px 16px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  border: 1px solid var(--color-card-border);
  background: var(--color-card-bg);
  color: var(--color-text-quaternary);
  cursor: pointer;
  transition: 0.15s;
}

.filter-chip--active {
  border-color: var(--color-dark-surface);
  background: var(--color-dark-surface);
  color: #FFFFFF;
}
</style>
