const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Calculate days left until expiration
function calculateDaysLeft(expirationDate) {
  const today = new Date();
  const expDate = new Date(expirationDate);
  const timeDiff = expDate.getTime() - today.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

// Get all food items
app.get('/api/items', (req, res) => {
  db.all(`
    SELECT id, name, description, category, expiration_date, added_date, upc_code, quantity, unit,
           CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) as days_left
    FROM food_items 
    ORDER BY days_left ASC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add new food item
app.post('/api/items', (req, res) => {
  const { name, description, category, expirationDate, upcCode, quantity = 1, unit = 'item' } = req.body;
  
  db.run(`
    INSERT INTO food_items (name, description, category, expiration_date, upc_code, quantity, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [name, description, category, expirationDate, upcCode, quantity, unit], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: 'Item added successfully' });
  });
});

// Update item quantity
app.patch('/api/items/:id/quantity', (req, res) => {
  const { quantity } = req.body;
  const id = req.params.id;

  if (quantity <= 0) {
    // Delete item if quantity is 0 or less
    db.run('DELETE FROM food_items WHERE id = ?', id, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Item deleted (quantity reached 0)' });
    });
  } else {
    // Update quantity
    db.run('UPDATE food_items SET quantity = ? WHERE id = ?', [quantity, id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Quantity updated successfully' });
    });
  }
});

// Delete food item
app.delete('/api/items/:id', (req, res) => {
  db.run('DELETE FROM food_items WHERE id = ?', req.params.id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item deleted successfully' });
  });
});

// UPC lookup
app.get('/api/upc/:code', (req, res) => {
  const upcCode = req.params.code.replace(/\s/g, ''); // Remove spaces
  
  db.get('SELECT * FROM upc_lookup WHERE upc_code = ?', [req.params.code], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'UPC code not found' });
    }
  });
});

// Get categories with counts
app.get('/api/categories', (req, res) => {
  db.all(`
    SELECT category, COUNT(*) as count
    FROM food_items 
    WHERE CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) > 0
    GROUP BY category
    ORDER BY category
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// API endpoint for microcontroller - get items expiring soon
app.get('/api/microcontroller/expiring', (req, res) => {
  const daysThreshold = req.query.days || 7;
  
  db.all(`
    SELECT name, category,
           CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) as days_left
    FROM food_items 
    WHERE CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) <= ?
      AND CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) >= 0
    ORDER BY days_left ASC
    LIMIT 10
  `, [daysThreshold], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      count: rows.length,
      items: rows
    });
  });
});

// Food expiration lookup (for estimating expiration dates)
app.get('/api/food-expiration/:name', (req, res) => {
  const foodName = req.params.name.toLowerCase();
  
  db.get(`
    SELECT * FROM food_expiration 
    WHERE LOWER(food_name) LIKE ? 
    ORDER BY LENGTH(food_name) ASC
    LIMIT 1
  `, [`%${foodName}%`], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json(row);
    } else {
      // Default expiration if not found
      res.json({ 
        food_name: foodName, 
        category: 'Other', 
        shelf_life_days: 7, 
        storage_type: 'pantry' 
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});