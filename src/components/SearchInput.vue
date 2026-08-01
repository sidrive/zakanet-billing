<script setup>
import { PhMagnifyingGlass } from "@phosphor-icons/vue"

defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "Cari..." },
})

defineEmits(["update:modelValue"])
</script>

<template>
  <div class="search-input">
    <PhMagnifyingGlass size="15" class="search-input__icon" />
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      :placeholder="placeholder"
      type="text"
    />
  </div>
</template>

<style scoped>
.search-input {
  position: relative;
  flex: 1;
}

.search-input__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
  pointer-events: none;
}

.search-input input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px 10px 34px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: var(--color-card-bg);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.search-input input:focus {
  border-color: var(--color-green);
}
</style>
