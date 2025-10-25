const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'food_tracker.db');
const db = new Database(dbPath);

// Initialize database tables
// Food items table
db.exec(`
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
try {
  db.exec(`ALTER TABLE food_items ADD COLUMN quantity INTEGER DEFAULT 1`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) {
    console.error('Error adding quantity column:', err.message);
  }
}

try {
  db.exec(`ALTER TABLE food_items ADD COLUMN unit TEXT DEFAULT 'item'`);
} catch (err) {
  if (!err.message.includes('duplicate column name')) {
    console.error('Error adding unit column:', err.message);
  }
}

// Enhanced products table for barcode lookup
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upc_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    brand TEXT,
    size TEXT,
    unit TEXT DEFAULT 'item',
    shelf_life_days INTEGER NOT NULL,
    storage_type TEXT DEFAULT 'pantry',
    typical_quantity REAL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Product alternatives table (for when exact UPC not found)
db.exec(`
  CREATE TABLE IF NOT EXISTS product_alternatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_terms TEXT NOT NULL,
    upc_code TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.8,
    FOREIGN KEY (upc_code) REFERENCES products(upc_code)
  )
`);

// Food expiration reference table
db.exec(`
  CREATE TABLE IF NOT EXISTS food_expiration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_name TEXT NOT NULL,
    category TEXT NOT NULL,
    shelf_life_days INTEGER NOT NULL,
    storage_type TEXT DEFAULT 'pantry'
  )
`);

// Insert sample products with real UPC codes
const productInsert = db.prepare(`
  INSERT OR REPLACE INTO products (
    upc_code, name, description, category, brand, size, unit,
    shelf_life_days, storage_type, typical_quantity
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Real UPC examples
productInsert.run('8743612389', "Joe's Eggs", 'Large brown eggs', 'Dairy', "Joe's Farm", '12 count', 'item', 21, 'refrigerator', 12);
productInsert.run('8789572389', 'Milk 2%', 'Reduced fat milk', 'Dairy', 'Generic', '1 gallon', 'gallon', 7, 'refrigerator', 1);
productInsert.run('1234567890', 'Bread Loaf', 'Whole wheat sandwich bread', 'Bakery', 'Bakery Co', '24 oz', 'item', 5, 'pantry', 1);
productInsert.run('041196910756', 'Bananas', 'Yellow Cavendish bananas', 'Fruits', 'Dole', '1 bunch', 'item', 7, 'pantry', 1);
productInsert.run('011110826467', 'Apples', 'Red Delicious apples', 'Fruits', 'Washington', '3 lb bag', 'lbs', 14, 'refrigerator', 3);
productInsert.run('04167000432', 'Chicken Breast', 'Boneless skinless chicken breast', 'Meat', 'Tyson', '1.5 lb', 'lbs', 2, 'refrigerator', 1.5);
productInsert.run('041000021249', 'Yogurt', 'Plain Greek yogurt', 'Dairy', 'Chobani', '32 oz', 'oz', 14, 'refrigerator', 32);
productInsert.run('011110038497', 'Orange Juice', '100% pure squeezed orange juice', 'Drinks', 'Tropicana', '59 oz', 'oz', 14, 'refrigerator', 59);

// Insert product alternatives for fuzzy matching
const altInsert = db.prepare(`
  INSERT OR REPLACE INTO product_alternatives (search_terms, upc_code, confidence_score)
  VALUES (?, ?, ?)
`);

altInsert.run('eggs brown large', '8743612389', 0.9);
altInsert.run('milk reduced fat 2%', '8789572389', 0.9);
altInsert.run('bread wheat sandwich', '1234567890', 0.8);
altInsert.run('bananas yellow', '041196910756', 0.9);
altInsert.run('apples red delicious', '011110826467', 0.9);
altInsert.run('chicken breast boneless', '04167000432', 0.8);

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

console.log('Database initialized');

module.exports = db;