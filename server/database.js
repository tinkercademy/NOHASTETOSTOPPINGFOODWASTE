const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'food_tracker.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Food items table
  db.run(`
    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      expiration_date DATE NOT NULL,
      added_date DATE DEFAULT CURRENT_TIMESTAMP,
      upc_code TEXT,
      days_left INTEGER,
      quantity INTEGER DEFAULT 1,
      unit TEXT DEFAULT 'item'
    )
  `);

  // Add quantity and unit columns if they don't exist (for existing databases)
  db.run(`ALTER TABLE food_items ADD COLUMN quantity INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding quantity column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE food_items ADD COLUMN unit TEXT DEFAULT 'item'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding unit column:', err.message);
    }
  });

  // UPC lookup table for common items
  db.run(`
    CREATE TABLE IF NOT EXISTS upc_lookup (
      upc_code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      shelf_life_days INTEGER NOT NULL
    )
  `);

  // Food expiration reference table
  db.run(`
    CREATE TABLE IF NOT EXISTS food_expiration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_name TEXT NOT NULL,
      category TEXT NOT NULL,
      shelf_life_days INTEGER NOT NULL,
      storage_type TEXT DEFAULT 'pantry'
    )
  `);

  // Insert some sample UPC codes
  const upcInsert = db.prepare(`
    INSERT OR REPLACE INTO upc_lookup (upc_code, name, category, shelf_life_days) 
    VALUES (?, ?, ?, ?)
  `);
  
  upcInsert.run('87436 12389', "Joe's Eggs", 'Dairy', 21);
  upcInsert.run('87895 72389', 'Milk 2%', 'Dairy', 7);
  upcInsert.run('12345 67890', 'Bread Loaf', 'Bakery', 5);
  upcInsert.finalize();

  // Insert food expiration reference data
  const expInsert = db.prepare(`
    INSERT OR REPLACE INTO food_expiration (food_name, category, shelf_life_days, storage_type)
    VALUES (?, ?, ?, ?)
  `);
  
  expInsert.run('Milk', 'Dairy', 7, 'refrigerator');
  expInsert.run('Eggs', 'Dairy', 21, 'refrigerator');
  expInsert.run('Bread', 'Bakery', 5, 'pantry');
  expInsert.run('Apples', 'Fruits', 14, 'refrigerator');
  expInsert.run('Bananas', 'Fruits', 7, 'pantry');
  expInsert.run('Chicken', 'Meat', 2, 'refrigerator');
  expInsert.run('Canned Beans', 'Canned Goods', 730, 'pantry');
  expInsert.run('Rice', 'Grains', 1095, 'pantry');
  expInsert.finalize();

  console.log('Database initialized');
});

module.exports = db;