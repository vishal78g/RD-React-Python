// Date formatting and EMI calculation utilities

/**
 * Format date to "dd-MMM-YYYY" format
 * e.g., "19-Mar-2026"
 */
export function formatDateLong(date) {
  if (!date) return '-'
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Format date to "dd-mmm-yyyy" format (lowercase month)
 * e.g., "19-mar-2026"
 */
export function formatDateShort(date) {
  return formatDateLong(date).toLowerCase()
}

/**
 * Parse date from YYYY-MM-DD to Date object
 */
export function parseDate(dateString) {
  if (!dateString) return null
  return new Date(dateString)
}

/**
 * Get ISO date string (YYYY-MM-DD) from Date object
 */
export function toIsoDate(date) {
  if (!date) return null
  return date.toISOString().split('T')[0]
}

/**
 * Calculate EMI cycle based on account opening date
 * Between 1-15 = 15, between 16-31 = 30
 */
export function calculateEmiCycle(openingDate) {
  if (!openingDate) return 15
  const date = typeof openingDate === 'string' ? parseDate(openingDate) : openingDate
  const day = date.getDate()
  return day >= 1 && day <= 15 ? 15 : 30
}

/**
 * Calculate next EMI date based on account opening date and EMI cycle
 * Returns next payment due date
 */
export function calculateNextEmiDate(openingDate, emiCycle) {
  if (!openingDate) return null
  
  const opening = typeof openingDate === 'string' ? parseDate(openingDate) : openingDate
  const today = new Date()
  
  // Determine cycle day based on opening day
  const openingDay = opening.getDate()
  const cycleDay = emiCycle === 15 ? 15 : Math.min(openingDay, 28) // Avoid invalid dates
  
  // Find the next cycle day
  let nextDate = new Date(today)
  nextDate.setDate(cycleDay)
  
  // If cycle day has passed this month, move to next month
  if (nextDate < today) {
    nextDate.setMonth(nextDate.getMonth() + 1)
    nextDate.setDate(cycleDay)
  }
  
  return nextDate
}

/**
 * Validate 10-digit phone number or 0
 */
export function isValidPhone(phone) {
  if (!phone || phone === '0' || phone === 0) return true
  const phoneStr = String(phone).trim()
  return /^\d{10}$/.test(phoneStr)
}

/**
 * Validate account opening date is in the past
 */
export function isValidAccountOpeningDate(date) {
  if (!date) return false
  const d = typeof date === 'string' ? parseDate(date) : date
  return d < new Date()
}

/**
 * Get current month and year
 */
export function getCurrentMonthYear() {
  const today = new Date()
  return {
    month: today.getMonth() + 1,
    year: today.getFullYear()
  }
}

/**
 * Get month and year from a date
 */
export function getMonthYearFromDate(dateString) {
  if (!dateString) return null
  const date = typeof dateString === 'string' ? parseDate(dateString) : dateString
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear()
  }
}

/**
 * Calculate EMI status based on next_emi_date
 * Returns: { status: 'REGULAR' | 'PENDING' | 'ADVANCE', count: number }
 */
export function getEmiStatus(nextEmiDate) {
  if (!nextEmiDate) return { status: 'UNKNOWN', count: 0 }

  const current = getCurrentMonthYear()
  const nextEmi = getMonthYearFromDate(nextEmiDate)

  if (!nextEmi) return { status: 'UNKNOWN', count: 0 }

  // If next EMI date is in current month
  if (nextEmi.month === current.month && nextEmi.year === current.year) {
    return { status: 'REGULAR', count: 0 }
  }

  // If next EMI date is before current month (PENDING)
  if (nextEmi.year < current.year || (nextEmi.year === current.year && nextEmi.month < current.month)) {
    // Calculate how many months are pending
    let pendingCount = 0
    let checkMonth = nextEmi.month
    let checkYear = nextEmi.year

    while (checkYear < current.year || (checkYear === current.year && checkMonth < current.month)) {
      pendingCount++
      checkMonth++
      if (checkMonth > 12) {
        checkMonth = 1
        checkYear++
      }
    }

    return { status: 'PENDING', count: pendingCount }
  }

  // If next EMI date is after current month (ADVANCE)
  if (nextEmi.year > current.year || (nextEmi.year === current.year && nextEmi.month > current.month)) {
    let advanceCount = 0
    let checkMonth = current.month
    let checkYear = current.year

    while (checkYear < nextEmi.year || (checkYear === nextEmi.year && checkMonth < nextEmi.month)) {
      advanceCount++
      checkMonth++
      if (checkMonth > 12) {
        checkMonth = 1
        checkYear++
      }
    }

    return { status: 'ADVANCE', count: advanceCount }
  }

  return { status: 'UNKNOWN', count: 0 }
}

/**
 * Calculate how many EMI months are currently outstanding.
 * For pending accounts, this includes the current month if it is not yet paid.
 */
export function getOutstandingEmiMonths(nextEmiDate, isPaidThisMonth = false) {
  const { status, count } = getEmiStatus(nextEmiDate)

  if (status === 'PENDING') {
    return count + (isPaidThisMonth ? 0 : 1)
  }

  if (status === 'REGULAR') {
    return isPaidThisMonth ? 0 : 1
  }

  return 0
}

/**
 * Calculate overdue charge based on pending months before the current month.
 * Example for EMI 500: 1 month = 5, 2 months = 15, 3 months = 30.
 */
export function calculateEmiDueAmount(emiAmount, nextEmiDate) {
  const normalizedEmiAmount = Number(emiAmount || 0)
  const { status, count } = getEmiStatus(nextEmiDate)

  if (normalizedEmiAmount <= 0 || status !== 'PENDING' || count <= 0) {
    return 0
  }

  const monthlyDueStep = normalizedEmiAmount * 0.01
  const dueAmount = monthlyDueStep * (count * (count + 1)) / 2

  return Number(dueAmount.toFixed(2))
}

/**
 * Build payment totals for EMI collection.
 */
export function getPaymentTotals({ emiAmount, nextEmiDate, quantity }) {
  const normalizedEmiAmount = Number(emiAmount || 0)
  const normalizedQuantity = Number(quantity || 0)
  const baseAmount = normalizedEmiAmount * normalizedQuantity
  const dueAmount = calculateEmiDueAmount(normalizedEmiAmount, nextEmiDate)
  const totalAmount = baseAmount + dueAmount

  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    dueAmount,
    totalAmount: Number(totalAmount.toFixed(2))
  }
}

/**
 * Derive payment breakdown from a stored collection row.
 */
export function getPaymentBreakdown(payment) {
  const emiAmount = Number(payment?.accounts?.emi_amount || payment?.emi_amount || 0)
  const emisPaid = Number(payment?.emis_paid || 0)
  const totalAmount = Number(payment?.amount || 0)
  const baseAmount = Number((emiAmount * emisPaid).toFixed(2))
  const storedDueAmount = Number(Math.max(0, totalAmount - baseAmount).toFixed(2))
  const fallbackDueAmount = calculateEmiDueAmount(emiAmount, payment?.accounts?.next_emi_date)
  const dueAmount = storedDueAmount > 0 ? storedDueAmount : fallbackDueAmount

  return {
    emiAmount,
    emisPaid,
    baseAmount,
    dueAmount,
    totalAmount
  }
}
