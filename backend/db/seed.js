require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const db     = require('./database')

async function seed() {
  console.log('🌱 Seeding database...')

  // Leave types
  const leaveTypes = [
    { name: 'Casual Leave',   max_per_year: 12, is_paid: 1 },
    { name: 'Sick Leave',     max_per_year: 12, is_paid: 1 },
    { name: 'Earned Leave',   max_per_year: 15, is_paid: 1 },
    { name: 'Unpaid Leave',   max_per_year: 30, is_paid: 0 },
  ]

  for (const lt of leaveTypes) {
    await db.runAsync(
      `INSERT OR IGNORE INTO leave_types (name, max_per_year, is_paid) VALUES (?,?,?)`,
      [lt.name, lt.max_per_year, lt.is_paid]
    )
  }
  console.log('✓ Leave types seeded')

  // Users
  const hash = (pw) => bcrypt.hashSync(pw, 10)
  const year = new Date().getFullYear()

  const users = [
    {
      name: 'Admin HR', email: 'hr@company.com', password: 'hr123456',
      role: 'hr', employee_id: 'HR001', department: 'Human Resources',
      designation: 'HR Manager', join_date: '2020-01-01', phone: '9876543210'
    },
    {
      name: 'Arun Kumar', email: 'arun@company.com', password: 'emp123456',
      role: 'employee', employee_id: 'EMP001', department: 'Engineering',
      designation: 'Software Engineer', join_date: '2022-03-15', phone: '9876543211'
    },
    {
      name: 'Priya Sharma', email: 'priya@company.com', password: 'emp123456',
      role: 'employee', employee_id: 'EMP002', department: 'Design',
      designation: 'UI/UX Designer', join_date: '2022-06-01', phone: '9876543212'
    },
    {
      name: 'Ravi Verma', email: 'ravi@company.com', password: 'emp123456',
      role: 'employee', employee_id: 'EMP003', department: 'Engineering',
      designation: 'Backend Developer', join_date: '2023-01-10', phone: '9876543213'
    },
  ]

  const insertedIds = []
  for (const u of users) {
    const exists = await db.getAsync('SELECT id FROM users WHERE email = ?', [u.email])
    if (!exists) {
      const result = await db.runAsync(
        `INSERT INTO users (name,email,password_hash,role,employee_id,department,designation,join_date,phone)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [u.name, u.email, hash(u.password), u.role, u.employee_id, u.department, u.designation, u.join_date, u.phone]
      )
      insertedIds.push({ id: result.id, role: u.role, name: u.name })
    } else {
      insertedIds.push({ id: exists.id, role: u.role, name: u.name })
    }
  }
  console.log('✓ Users seeded')

  // Set manager_id for employees → HR
  const hr = insertedIds.find(u => u.role === 'hr')
  for (const u of insertedIds.filter(u => u.role === 'employee')) {
    await db.runAsync('UPDATE users SET manager_id = ? WHERE id = ?', [hr.id, u.id])
  }

  // Leave balances for employees
  const ltRows = await db.allAsync('SELECT id, max_per_year FROM leave_types')
  for (const u of insertedIds.filter(u => u.role === 'employee')) {
    for (const lt of ltRows) {
      await db.runAsync(
        `INSERT OR IGNORE INTO leave_balances (user_id, leave_type_id, year, allocated, used, remaining)
         VALUES (?,?,?,?,0,?)`,
        [u.id, lt.id, year, lt.max_per_year, lt.max_per_year]
      )
    }
  }
  console.log('✓ Leave balances seeded')

  // Salary structures
  const salaries = [
    { name: 'Arun Kumar',  basic: 35000, hra: 14000, allowances: 5000, deductions: 2000, pf: 4200 },
    { name: 'Priya Sharma',basic: 32000, hra: 12800, allowances: 4500, deductions: 1800, pf: 3840 },
    { name: 'Ravi Verma',  basic: 38000, hra: 15200, allowances: 5500, deductions: 2200, pf: 4560 },
  ]
  for (const s of salaries) {
    const u = insertedIds.find(x => x.name === s.name)
    if (u) {
      const net = s.basic + s.hra + s.allowances - s.deductions - s.pf
      await db.runAsync(
        `INSERT OR IGNORE INTO salary_structures (user_id,basic,hra,allowances,deductions,pf,net_pay)
         VALUES (?,?,?,?,?,?,?)`,
        [u.id, s.basic, s.hra, s.allowances, s.deductions, s.pf, net]
      )
    }
  }
  console.log('✓ Salary structures seeded')

  // Sample attendance for today
  const today = new Date().toISOString().split('T')[0]
  for (const u of insertedIds.filter(u => u.role === 'employee')) {
    await db.runAsync(
      `INSERT OR IGNORE INTO attendance (user_id, date, status) VALUES (?,?,?)`,
      [u.id, today, 'absent']
    )
  }

  // Holidays
  const holidays = [
    { date: `${year}-01-26`, name: 'Republic Day' },
    { date: `${year}-08-15`, name: 'Independence Day' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
    { date: `${year}-12-25`, name: 'Christmas' },
  ]
  for (const h of holidays) {
    await db.runAsync(`INSERT OR IGNORE INTO holidays (date,name) VALUES (?,?)`, [h.date, h.name])
  }
  console.log('✓ Holidays seeded')

  console.log('\n✅ Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('HR Login:       hr@company.com    / hr123456')
  console.log('Employee 1:     arun@company.com  / emp123456')
  console.log('Employee 2:     priya@company.com / emp123456')
  console.log('Employee 3:     ravi@company.com  / emp123456')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
