<script setup>
import { useToast } from "@/composables/useToast"

const { toastState } = useToast()
</script>

<template>
  <Transition name="toast-fade">
    <div v-if="toastState.visible" class="toast">{{ toastState.message }}</div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 94px;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  background: var(--color-dark-surface);
  color: #FFFFFF;
  padding: 12px 16px;
  border-radius: var(--radius-card);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  z-index: 300;
  box-shadow: var(--shadow-md);
}

@media (min-width: 769px) {
  .toast {
    bottom: 32px;
  }
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
