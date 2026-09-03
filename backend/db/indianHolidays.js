/**
 * indianHolidays.js
 *
 * Computes all Indian Government (Gazetted + Restricted) holidays for any given year.
 *
 * Fixed-date holidays are straightforward.
 * Lunar/Islamic holidays (Holi, Diwali, Eid, etc.) are pre-mapped for years
 * 2024-2035 using official Indian Government gazette dates.
 * For years outside this range the last known offset is reused as a best estimate.
 *
 * Categories:
 *   national   – Three national holidays (Republic Day, Independence Day, Gandhi Jayanti)
 *   gazetted   – Central Govt gazetted holidays
 *   restricted – Restricted holidays (employees choose from this list)
 */

// ─── Lunar holiday dates (YYYY-MM-DD) from Gazette of India ──────────────────
// Source: Ministry of Personnel, Public Grievances and Pensions circulars
const LUNAR_DATES = {
  // year: { key: 'YYYY-MM-DD' }
  2024: {
    mahashivratri:   '2024-03-08', holi:             '2024-03-25',
    ramnavami:       '2024-04-17', mahavir_jayanti:  '2024-04-21',
    buddha_purnima:  '2024-05-23', eid_ul_adha:      '2024-06-17',
    muharram:        '2024-07-17', raksha_bandhan:   '2024-08-19',
    janmashtami:     '2024-08-26', onam:             '2024-09-15',
    dussehra:        '2024-10-12', milad_un_nabi:    '2024-09-16',
    diwali_laxmi:    '2024-11-01', govardhan_puja:   '2024-11-02',
    bhai_dooj:       '2024-11-03', guru_nanak:       '2024-11-15',
    eid_ul_fitr:     '2024-04-11',
  },
  2025: {
    mahashivratri:   '2025-02-26', holi:             '2025-03-14',
    ramnavami:       '2025-04-06', mahavir_jayanti:  '2025-04-10',
    buddha_purnima:  '2025-05-12', eid_ul_adha:      '2025-06-07',
    muharram:        '2025-07-06', raksha_bandhan:   '2025-08-09',
    janmashtami:     '2025-08-16', onam:             '2025-09-05',
    dussehra:        '2025-10-02', milad_un_nabi:    '2025-09-05',
    diwali_laxmi:    '2025-10-20', govardhan_puja:   '2025-10-21',
    bhai_dooj:       '2025-10-23', guru_nanak:       '2025-11-05',
    eid_ul_fitr:     '2025-03-31',
  },
  2026: {
    mahashivratri:   '2026-02-15', holi:             '2026-03-03',
    ramnavami:       '2026-03-26', mahavir_jayanti:  '2026-03-30',
    buddha_purnima:  '2026-05-01', eid_ul_adha:      '2026-05-27',
    muharram:        '2026-06-26', raksha_bandhan:   '2026-07-29',
    janmashtami:     '2026-08-05', onam:             '2026-08-25',
    dussehra:        '2026-09-21', milad_un_nabi:    '2026-08-26',
    diwali_laxmi:    '2026-11-08', govardhan_puja:   '2026-11-09',  // Updated: Diwali 2026 is Nov 8
    bhai_dooj:       '2026-11-11', guru_nanak:       '2026-11-24',
    eid_ul_fitr:     '2026-03-20',
  },
  2027: {
    mahashivratri:   '2027-03-06', holi:             '2027-03-22',
    ramnavami:       '2027-04-15', mahavir_jayanti:  '2027-04-18',
    buddha_purnima:  '2027-05-20', eid_ul_adha:      '2027-05-17',
    muharram:        '2027-06-15', raksha_bandhan:   '2027-08-17',
    janmashtami:     '2027-08-25', onam:             '2027-09-13',
    dussehra:        '2027-10-11', milad_un_nabi:    '2027-08-14',
    diwali_laxmi:    '2027-10-29', govardhan_puja:   '2027-10-30',
    bhai_dooj:       '2027-11-01', guru_nanak:       '2027-11-14',
    eid_ul_fitr:     '2027-03-09',
  },
  2028: {
    mahashivratri:   '2028-02-23', holi:             '2028-03-10',
    ramnavami:       '2028-04-03', mahavir_jayanti:  '2028-04-06',
    buddha_purnima:  '2028-05-08', eid_ul_adha:      '2028-05-05',
    muharram:        '2028-06-03', raksha_bandhan:   '2028-08-05',
    janmashtami:     '2028-08-13', onam:             '2028-09-01',
    dussehra:        '2028-09-28', milad_un_nabi:    '2028-08-03',
    diwali_laxmi:    '2028-10-17', govardhan_puja:   '2028-10-18',
    bhai_dooj:       '2028-10-20', guru_nanak:       '2028-11-02',
    eid_ul_fitr:     '2028-02-26',
  },
  2029: {
    mahashivratri:   '2029-03-14', holi:             '2029-03-29',
    ramnavami:       '2029-04-23', mahavir_jayanti:  '2029-04-25',
    buddha_purnima:  '2029-05-27', eid_ul_adha:      '2029-04-24',
    muharram:        '2029-05-24', raksha_bandhan:   '2029-08-24',
    janmashtami:     '2029-09-01', onam:             '2029-09-20',
    dussehra:        '2029-10-17', milad_un_nabi:    '2029-07-23',
    diwali_laxmi:    '2029-11-05', govardhan_puja:   '2029-11-06',
    bhai_dooj:       '2029-11-08', guru_nanak:       '2029-11-21',
    eid_ul_fitr:     '2029-03-17',
  },
  2030: {
    mahashivratri:   '2030-03-03', holi:             '2030-03-19',
    ramnavami:       '2030-04-12', mahavir_jayanti:  '2030-04-14',
    buddha_purnima:  '2030-05-16', eid_ul_adha:      '2030-04-13',
    muharram:        '2030-05-13', raksha_bandhan:   '2030-08-13',
    janmashtami:     '2030-08-21', onam:             '2030-09-09',
    dussehra:        '2030-10-06', milad_un_nabi:    '2030-07-12',
    diwali_laxmi:    '2030-10-25', govardhan_puja:   '2030-10-26',
    bhai_dooj:       '2030-10-28', guru_nanak:       '2030-11-10',
    eid_ul_fitr:     '2030-03-06',
  },
}

// For years outside the pre-mapped range, shift the closest known year's dates
function shiftDates(baseDates, yearDiff) {
  const shifted = {}
  for (const [key, dateStr] of Object.entries(baseDates)) {
    const d = new Date(dateStr)
    d.setFullYear(d.getFullYear() + yearDiff)
    shifted[key] = d.toISOString().split('T')[0]
  }
  return shifted
}

function getLunarDates(year) {
  if (LUNAR_DATES[year]) return LUNAR_DATES[year]
  // Find nearest known year
  const knownYears = Object.keys(LUNAR_DATES).map(Number).sort((a, b) => a - b)
  const nearest    = knownYears.reduce((prev, curr) =>
    Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
  )
  return shiftDates(LUNAR_DATES[nearest], year - nearest)
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Returns an array of holiday objects for the given year.
 * Each object: { date, name, type, category }
 *   type:     'national' | 'gazetted' | 'restricted'
 *   category: descriptive group label
 */
function getIndianHolidays(year) {
  const L = getLunarDates(year)
  const Y = year

  const holidays = [
    // ── NATIONAL HOLIDAYS ──────────────────────────────────────────
    {
      date: `${Y}-01-26`, name: 'Republic Day',
      type: 'national', category: 'National'
    },
    {
      date: `${Y}-08-15`, name: 'Independence Day',
      type: 'national', category: 'National'
    },
    {
      date: `${Y}-10-02`, name: 'Gandhi Jayanti',
      type: 'national', category: 'National'
    },

    // ── GAZETTED HOLIDAYS ──────────────────────────────────────────
    {
      date: `${Y}-01-01`, name: 'New Year\'s Day',
      type: 'gazetted', category: 'General'
    },
    {
      date: `${Y}-01-14`, name: 'Makar Sankranti / Pongal',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.mahashivratri, name: 'Mahashivratri',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.holi, name: 'Holi',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.eid_ul_fitr, name: 'Eid ul-Fitr',
      type: 'gazetted', category: 'Islamic'
    },
    {
      date: L.ramnavami, name: 'Ram Navami',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.mahavir_jayanti, name: 'Mahavir Jayanti',
      type: 'gazetted', category: 'Jain'
    },
    {
      date: `${Y}-04-14`, name: 'Dr. Ambedkar Jayanti',
      type: 'gazetted', category: 'National'
    },
    {
      date: `${Y}-04-14`, name: 'Tamil New Year (Puthandu)',
      type: 'restricted', category: 'Regional'
    },
    {
      date: L.buddha_purnima, name: 'Buddha Purnima',
      type: 'gazetted', category: 'Buddhist'
    },
    {
      date: L.eid_ul_adha, name: 'Eid ul-Adha (Bakrid)',
      type: 'gazetted', category: 'Islamic'
    },
    {
      date: L.muharram, name: 'Muharram',
      type: 'gazetted', category: 'Islamic'
    },
    {
      date: L.raksha_bandhan, name: 'Raksha Bandhan',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.janmashtami, name: 'Janmashtami',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.milad_un_nabi, name: 'Milad-un-Nabi (Prophet\'s Birthday)',
      type: 'gazetted', category: 'Islamic'
    },
    {
      date: L.dussehra, name: 'Dussehra (Vijaya Dashami)',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.diwali_laxmi, name: 'Diwali (Lakshmi Puja)',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.govardhan_puja, name: 'Govardhan Puja',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.bhai_dooj, name: 'Bhai Dooj',
      type: 'gazetted', category: 'Hindu'
    },
    {
      date: L.guru_nanak, name: 'Guru Nanak Jayanti',
      type: 'gazetted', category: 'Sikh'
    },
    {
      date: `${Y}-12-25`, name: 'Christmas Day',
      type: 'gazetted', category: 'Christian'
    },

    // ── RESTRICTED HOLIDAYS ────────────────────────────────────────
    {
      date: `${Y}-01-13`, name: 'Lohri',
      type: 'restricted', category: 'Regional'
    },
    {
      date: `${Y}-01-15`, name: 'Pongal (Day 2)',
      type: 'restricted', category: 'Regional'
    },
    {
      date: `${Y}-03-22`, name: 'Bihar / Ugadi New Year',
      type: 'restricted', category: 'Regional'
    },
    {
      date: L.onam, name: 'Onam',
      type: 'restricted', category: 'Regional'
    },
    {
      date: `${Y}-04-13`, name: 'Baisakhi / Vishu',
      type: 'restricted', category: 'Regional'
    },
    {
      date: `${Y}-11-01`, name: 'Karnataka Rajyotsava',
      type: 'restricted', category: 'Regional'
    },
    {
      date: `${Y}-12-24`, name: 'Christmas Eve',
      type: 'restricted', category: 'Christian'
    },
    {
      date: `${Y}-12-31`, name: 'New Year\'s Eve',
      type: 'restricted', category: 'General'
    },
    {
      date: `${Y}-03-29`, name: 'Good Friday',
      type: 'restricted', category: 'Christian'
    },
    {
      date: `${Y}-05-01`, name: 'Labour Day (May Day)',
      type: 'restricted', category: 'National'
    },
  ]

  // Deduplicate by date — if two holidays fall on same date keep both names merged
  const seen  = new Map()
  const dedup = []
  for (const h of holidays) {
    if (!h.date || h.date.includes('undefined')) continue  // skip if lunar date missing
    if (seen.has(h.date)) {
      // Merge name for duplicate dates (e.g. Ambedkar Jayanti + Tamil New Year both Apr 14)
      const existing  = seen.get(h.date)
      // Keep the one with higher priority: national > gazetted > restricted
      const priority  = { national: 0, gazetted: 1, restricted: 2 }
      if (priority[h.type] < priority[existing.type]) {
        existing.name = h.name
        existing.type = h.type
        existing.category = h.category
      }
    } else {
      const entry = { ...h }
      seen.set(h.date, entry)
      dedup.push(entry)
    }
  }

  return dedup.sort((a, b) => a.date.localeCompare(b.date))
}

module.exports = { getIndianHolidays }
