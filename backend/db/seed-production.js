require('dotenv').config()
const db = require('./database')

async function seedProduction() {
  console.log('🌱 Creating/updating production users...')

  const users = [
    {
      name: 'Vinoth Ravi',
      email: 'vinothravi2819@gmail.com',
      password_hash: 'Something@2026',
      role: 'hr',
      employee_id: 'HR001',
      status: 'active'
    }
  ]

  for (const user of users) {
    await db.runAsync(
      `INSERT INTO users
       (name, email, password_hash, role, employee_id, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         password_hash = excluded.password_hash,
         role = excluded.role,
         employee_id = excluded.employee_id,
         status = excluded.status`,
      [
        user.name,
        user.email,
        user.password_hash,
        user.role,
        user.employee_id,
        user.status
      ]
    )
  }

  console.log('✓ Production HR user created/updated')
  process.exit(0)
}

seedProduction().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})