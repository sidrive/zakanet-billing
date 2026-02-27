export function canGenerateInvoice(customer, month) {
 // ⛔ Skip nonaktif
 if (!customer.is_active) return false

 // Convert "YYYY-MM" → Date awal bulan
 const [year, m] = month.split("-").map(Number)
 const currentMonthDate = new Date(year, m - 1, 1)

 // Customer lama (tanpa join_date)
 if (!customer.join_date) return true

 // Customer baru → join + 2 bulan
 const joinDate = customer.join_date.toDate()

 const firstBillDate = new Date(
   joinDate.getFullYear(),
   joinDate.getMonth() + 2,
   1
 )

 return currentMonthDate >= firstBillDate
}