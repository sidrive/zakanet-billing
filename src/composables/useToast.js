import { reactive } from "vue"

const state = reactive({
  message: "",
  visible: false,
})

let hideTimer = null

export function useToast() {
  function showToast(message, duration = 2200) {
    clearTimeout(hideTimer)
    state.message = message
    state.visible = true
    hideTimer = setTimeout(() => {
      state.visible = false
    }, duration)
  }

  return { toastState: state, showToast }
}
