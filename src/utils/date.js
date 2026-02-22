export function currentMonth() {
 const d = new Date()
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function formatMonthId(monthId) {
 if (!monthId) return "-"

 const [year, month] = monthId.split("-")
 const date = new Date(Number(year), Number(month) - 1)

 return date.toLocaleDateString("id-ID", {
   month: "long",
   year: "numeric"
 })
}
