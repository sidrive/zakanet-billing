import { createApp } from 'vue'
// import './style.css'
import "./assets/style/base.css"
import "./assets/style/payment.css"
import App from './App.vue'
import router from "./router"

createApp(App).use(router).mount("#app")
