<script setup>
import { computed } from "vue"

const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (v) => ["paid", "partial", "unpaid", "active", "inactive"].includes(v),
  },
  label: { type: String, default: "" },
})

const defaultLabels = {
  paid: "Lunas",
  partial: "Partial",
  unpaid: "Belum Bayar",
  active: "Aktif",
  inactive: "Nonaktif",
}

const text = computed(() => props.label || defaultLabels[props.variant])
</script>

<template>
  <span class="status-badge" :class="`status-badge--${variant}`">{{ text }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.status-badge--paid,
.status-badge--active {
  background: var(--color-green-tint);
  color: var(--color-green);
}

.status-badge--partial {
  background: var(--color-orange-tint);
  color: var(--color-orange-text);
}

.status-badge--unpaid {
  background: var(--color-red-tint);
  color: var(--color-red);
}

.status-badge--inactive {
  background: var(--color-chip-bg-inactive);
  color: var(--color-chip-text);
}
</style>
