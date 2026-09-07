const sqlite3 = require('sqlite3').verbose()
const path = require('path')

// Use DB_PATH in production; use local attendance.db during development
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'attendance.db')

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('DB connection error:', err.message)
  } else {
    console.log('✓ Connected to SQLite database')
    console.log(`Database: ${DB_PATH}`)
  }
})

db.run('PRAGMA foreign_keys = ON')
db.run('PRAGMA journal_mode = WAL')

// Promisify helpers
db.getAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) =>
      err ? reject(err) : resolve(row)
    )
  )

db.allAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) =>
      err ? reject(err) : resolve(rows)
    )
  )

db.runAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve({
          id: this.lastID,
          changes: this.changes
        })
      }
    })
  )

module.exports = db