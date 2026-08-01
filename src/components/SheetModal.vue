<script setup>
const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
})

const emit = defineEmits(["update:modelValue"])

function close() {
  emit("update:modelValue", false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
        <Transition name="sheet-slide" appear>
          <div class="sheet-panel">
            <div class="sheet-panel__handle"></div>
            <div class="sheet-panel__body">
              <div v-if="title" class="sheet-panel__title">{{ title }}</div>
              <div v-if="subtitle" class="sheet-panel__subtitle">{{ subtitle }}</div>
              <slot />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 19, 24, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-panel {
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-card-bg);
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  box-sizing: border-box;
}

.sheet-panel__handle {
  width: 36px;
  height: 4px;
  background: var(--color-divider-strong);
  border-radius: var(--radius-pill);
  margin: 10px auto;
}

.sheet-panel__body {
  padding: 8px 20px 24px;
}

.sheet-panel__title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.sheet-panel__subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 18px;
}

@media (min-width: 769px) {
  .sheet-backdrop {
    align-items: center;
  }

  .sheet-panel {
    width: 100%;
    max-width: 440px;
    border-radius: var(--radius-card-lg);
  }

  .sheet-panel__handle {
    display: none;
  }
}

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active {
  transition: transform 0.25s ease;
}

.sheet-slide-enter-from {
  transform: translateY(100%);
}

@media (min-width: 769px) {
  .sheet-slide-enter-from {
    transform: translateY(16px);
  }
}
</style>
