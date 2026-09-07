require('dotenv').config()
const db = require('./database')

async function seedProduction() {
  console.log('🌱 Creating production users...')

  const users = [
    {
      name: 'Vinoth Ravi',
      email: 'vinothravi2819@gmail.com',
      password_hash: '$2a$10$0RFBWrXkgE1FXeNHtUQA.uGzRMR3zrFAYnug7/iM1TybXX7LIhOfK',
      role: 'hr',
      employee_id: 'HR001',
      status: 'active'
    }
  ]

  for (const user of users) {
    await db.runAsync(
      `INSERT OR IGNORE INTO users
       (name, email, password_hash, role, employee_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
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

  console.log('✓ Production HR user ready')
  process.exit(0)
}

seedProduction().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})