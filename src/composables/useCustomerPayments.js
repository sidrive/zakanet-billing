// ============================================================
// Composable: Laporan Pembayaran per Pelanggan
//
// Menyimpan state halaman (loading, error, data) supaya view hanya
// mengurus tampilan. Pola sama dengan useReports.js.
// ============================================================
import { ref } from "vue"
import {
  getCustomerPaymentSummary,
  getCustomerPaymentHistory
} from "@/services/customerReportService"

export function useCustomerPayments() {
  const loading = ref(false)
  const loadingHistory = ref(false)
  const error = ref(null)

  const customers = ref([])
  const selectedCustomer = ref(null)
  const historyRows = ref([])
  const historyTotals = ref(null)

  async function loadCustomers() {
    loading.value = true
    error.value = null

    try {
      customers.value = await getCustomerPaymentSummary()
    } catch (e) {
      error.value = e.message || String(e)
    } finally {
      loading.value = false
    }
  }

  async function openCustomer(customer) {
    selectedCustomer.value = customer
    historyRows.value = []
    historyTotals.value = null
    loadingHistory.value = true
    error.value = null

    try {
      const { rows, totals } = await getCustomerPaymentHistory(customer.id)
      historyRows.value = rows
      historyTotals.value = totals
    } catch (e) {
      error.value = e.message || String(e)
    } finally {
      loadingHistory.value = false
    }
  }

  function closeDetail() {
    selectedCustomer.value = null
    historyRows.value = []
    historyTotals.value = null
    error.value = null
  }

  return {
    loading,
    loadingHistory,
    error,
    customers,
    selectedCustomer,
    historyRows,
    historyTotals,
    loadCustomers,
    openCustomer,
    closeDetail
  }
}
