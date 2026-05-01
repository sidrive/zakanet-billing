import { ref } from "vue"
import {
  getMonthSummary,
  getDailyTrend,
  getMonthlyTrend,
  getPackageDistribution,
  getTopDepositCustomers,
  getDetailedInvoices
} from "@/services/reportService"

export function useReports() {
  const loading = ref(false)
  const error = ref(null)
  const reportData = ref(null)
  const detailRows = ref([])
  const selectedMonth = ref(new Date().toISOString().slice(0, 7))

  const loadReports = async (month) => {
    loading.value = true
    error.value = null

    try {
      const [summary, dailyTrend, monthlyTrend, packageDist, topCustomers, detail] = await Promise.all([
        getMonthSummary(month),
        getDailyTrend(month),
        getMonthlyTrend(),
        getPackageDistribution(),
        getTopDepositCustomers(5),
        getDetailedInvoices(month)
      ])

      reportData.value = { summary, dailyTrend, monthlyTrend, packageDist, topCustomers }
      detailRows.value = detail
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  const setMonth = (month) => {
    selectedMonth.value = month
    loadReports(month)
  }

  return { loading, error, reportData, detailRows, selectedMonth, loadReports, setMonth }
}
