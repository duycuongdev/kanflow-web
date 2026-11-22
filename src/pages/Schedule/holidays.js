import { Lunar } from 'lunar-typescript'

/**
 * Ngày lễ Việt Nam cho bảng lịch.
 * - Ngày lễ cố định theo dương lịch: Tết DL, 30/4, 1/5, 2/9
 * - Ngày lễ âm lịch tính động bằng lunar-typescript (chính xác mọi năm):
 *   Tết Nguyên đán (mùng 1 → mùng 3) + Giỗ tổ Hùng Vương (10/3 âm lịch)
 *
 * getHolidaysForYear(year) trả về Map: { 'YYYY-MM-DD': { name, isLunar } }
 * Kết quả được cache theo năm (lịch năm sau tính lại khi cần).
 */

const SOLAR_HOLIDAYS = [
  { month: 1, day: 1, name: 'Tết Dương lịch' },
  { month: 4, day: 30, name: 'Ngày Giải phóng miền Nam' },
  { month: 5, day: 1, name: 'Quốc tế Lao động' },
  { month: 9, day: 2, name: 'Quốc khánh' }
]

const cache = new Map()

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getHolidaysForYear(year) {
  if (cache.has(year)) return cache.get(year)

  const holidays = new Map()

  // 1. Ngày lễ dương lịch cố định
  for (const holiday of SOLAR_HOLIDAYS) {
    holidays.set(`${year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`, {
      name: holiday.name,
      isLunar: false
    })
  }

  // 2. Tết Nguyên đán: tìm mùng 1 (âm lịch 1/1) rơi trong năm dương lịch `year`
  //    (Tết luôn rơi khoảng cuối tháng 1 - giữa tháng 2 nên chỉ cần quét 1/1 → 10/3)
  const scanStart = new Date(year, 0, 1)
  let tetDate = null
  for (let i = 0; i <= 70; i++) {
    const date = new Date(scanStart.getFullYear(), scanStart.getMonth(), scanStart.getDate() + i)
    const lunar = Lunar.fromDate(date)
    if (lunar.getMonth() === 1 && lunar.getDay() === 1) {
      tetDate = date
      break
    }
  }
  if (tetDate) {
    const tetNames = ['Mùng 1 Tết Nguyên đán', 'Mùng 2 Tết Nguyên đán', 'Mùng 3 Tết Nguyên đán']
    for (let i = 0; i < tetNames.length; i++) {
      const date = new Date(tetDate.getFullYear(), tetDate.getMonth(), tetDate.getDate() + i)
      if (date.getFullYear() === year) {
        holidays.set(toDateKey(date), { name: tetNames[i], isLunar: true })
      }
    }
  }

  // 3. Giỗ tổ Hùng Vương: 10 tháng 3 âm lịch
  const hungKings = Lunar.fromYmd(year, 3, 10).getSolar()
  holidays.set(toDateKey(new Date(hungKings.getYear(), hungKings.getMonth() - 1, hungKings.getDay())), {
    name: 'Giỗ tổ Hùng Vương',
    isLunar: true
  })

  cache.set(year, holidays)
  return holidays
}

/** Nhóm ngày lễ liên tiếp của 1 năm thành danh sách { startKey, endKey, name } (dùng cho tooltip/banner) */
export function getHolidayName(holidaysMap, date) {
  const key = toDateKey(date)
  return holidaysMap.get(key)?.name || null
}

/** Kiểm tra 1 ngày có phải ngày lễ không */
export { toDateKey as formatHolidayDateKey }
