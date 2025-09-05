const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// AI Vision endpoint for image analysis
const vision = require('@google-cloud/vision');

// Initialize Vision client with service account
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: './google-service-account.json', // Path to your service account JSON
});

app.post('/api/analyze-image', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Check if service account file exists
    const fs = require('fs');
    const hasServiceAccount = fs.existsSync('./google-service-account.json');
    
    if (!hasServiceAccount) {
      console.log('Service account not found!');
      return res.status(500).json({ 
        error: 'Google Vision API not configured',
        type: 'none',
        message: 'Vision API service account not found. Please add google-service-account.json'
      });
    }

    // Use real Google Vision API
    console.log('Analyzing image with Google Vision API...');
    
    try {
      const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
      
      const [textDetection] = await visionClient.textDetection({
        image: { content: imageBuffer }
      });
      
      const detections = textDetection.textAnnotations;
      const fullText = detections && detections[0] ? detections[0].description : '';
      
      console.log('Detected text:', fullText.substring(0, 200) + '...');
      
      // Check for receipt patterns FIRST (receipts often contain barcode-like numbers)
      const receiptResult = detectReceiptInText(fullText);
      if (receiptResult) {
        console.log('Identified as receipt');
        return res.json(receiptResult);
      }
      
      // Only check for standalone barcodes if no receipt detected
      const barcodeResult = detectBarcodeInText(fullText);
      if (barcodeResult) {
        console.log('Identified as barcode');
        return res.json(barcodeResult);
      }
      
      // Nothing found
      res.json({
        type: 'none',
        message: 'No barcode or receipt detected. Please try again with better lighting or positioning.'
      });
      
    } catch (visionError) {
      console.error('Vision API error:', visionError);
      return res.status(500).json({ 
        error: 'Google Vision API error',
        type: 'none',
        message: 'Vision API error. Please try again or check your setup.'
      });
    }
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ 
      error: 'Error processing image',
      type: 'none',
      message: 'Error processing image. Please try again.'
    });
  }
});

// Helper function for barcode detection
function detectBarcodeInText(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(line => line.trim());
  const lowerText = text.toLowerCase();
  
  // Don't detect barcode if this looks like a receipt
  const receiptIndicators = [
    'receipt', 'total', 'subtotal', 'tax', 'store', 'thank you',
    'cashier', 'register', 'purchase', 'sale', 'change'
  ];
  
  const hasReceiptKeywords = receiptIndicators.some(indicator => 
    lowerText.includes(indicator)
  );
  
  // If it has receipt keywords AND multiple price patterns, probably not a standalone barcode
  const pricePattern = /\$\d+\.\d{2}/g;
  const priceMatches = text.match(pricePattern);
  const hasMultiplePrices = priceMatches && priceMatches.length >= 2;
  
  if (hasReceiptKeywords && hasMultiplePrices) {
    console.log('Skipping barcode detection - looks like receipt');
    return null;
  }
  
  // Look for barcodes, but be more selective
  const barcodePatterns = [
    /\b\d{12}\b/g,           // UPC-A (12 digits)
    /\b\d{13}\b/g,           // EAN-13 (13 digits)
    /\b\d{8}\b/g,            // EAN-8 (8 digits)
    /\b\d{5}\s+\d{5}\b/g,    // Spaced format (5+5)
  ];

  // Look for barcodes that appear to be standalone (not part of lots of other text)
  for (const pattern of barcodePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Check if the barcode appears in a line by itself or with minimal other text
      const barcode = matches[0];
      const barcodeLines = lines.filter(line => line.includes(barcode.replace(/\s/g, '')));
      
      if (barcodeLines.length > 0) {
        const barcodeLine = barcodeLines[0];
        // If the line is mostly just the barcode (not buried in lots of other text)
        if (barcodeLine.length < 30 || barcodeLine.replace(/\s/g, '').length < barcode.replace(/\s/g, '').length * 2) {
          console.log('Found standalone barcode:', barcode);
          return {
            type: 'barcode',
            barcode: barcode,
            confidence: 0.9
          };
        }
      }
    }
  }
  
  console.log('No standalone barcode found');
  return null;
}

// Helper function for receipt detection
function detectReceiptInText(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const lowerText = text.toLowerCase();
  
  // Strong receipt indicators
  const strongReceiptIndicators = [
    'receipt', 'total', 'subtotal', 'tax', 'thank you', 'store', 
    'cashier', 'register', 'transaction', 'purchase', 'sale',
    'change due', 'amount tendered', 'visa', 'mastercard', 'debit'
  ];
  
  // Must have at least one strong indicator
  const hasStrongIndicator = strongReceiptIndicators.some(indicator => 
    lowerText.includes(indicator)
  );

  // Look for price patterns which are common in receipts
  const pricePattern = /\$\d+\.\d{2}/g;
  const priceMatches = text.match(pricePattern);
  const hasPrices = priceMatches && priceMatches.length >= 2; // At least 2 prices

  // Must have either strong indicator OR multiple prices
  if (!hasStrongIndicator && !hasPrices) {
    return null;
  }

  console.log('Receipt detection - Strong indicator:', hasStrongIndicator, 'Prices found:', priceMatches?.length || 0);

  const items = [];
  for (const line of lines) {
    const item = parseReceiptLine(line);
    if (item) items.push(item);
  }

  // Need at least 1 item to be considered a receipt
  if (items.length === 0) return null;

  console.log('Extracted', items.length, 'items from receipt');
  return {
    type: 'receipt',
    items: items,
    confidence: 0.8
  };
}

// Helper function to parse receipt lines
function parseReceiptLine(line) {
  const skipPatterns = [
    /^(subtotal|total|tax|change|cash|credit|debit)/i,
    /^\$?\d+\.\d{2}$/,
    /^thank you/i,
    /^store #/i,
    /^\d+\/\d+\/\d+/,
    /^\d+:\d+/
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(line.trim())) return null;
  }

  const itemPattern = /^(\d+\s+)?(.+?)\s+\$?(\d+\.\d{2})$/;
  const match = line.match(itemPattern);

  if (match) {
    const quantity = match[1] ? parseInt(match[1].trim()) : 1;
    const itemName = match[2].trim();
    const price = parseFloat(match[3]);

    if (itemName.length < 3 || /^\d+$/.test(itemName)) return null;

    return {
      name: titleCase(itemName),
      quantity: quantity,
      unit: 'item',
      category: categorizeItem(itemName),
      price: price
    };
  }
  return null;
}

// Helper functions
function categorizeItem(itemName) {
  const name = itemName.toLowerCase();
  if (/bread|bagel|muffin|donut|croissant/.test(name)) return 'Bakery';
  if (/milk|cheese|yogurt|butter|cream/.test(name)) return 'Dairy';
  if (/apple|banana|orange|grape|berry/.test(name)) return 'Fruits';
  if (/lettuce|tomato|onion|carrot|potato/.test(name)) return 'Vegetables';
  if (/chicken|beef|pork|fish|salmon/.test(name)) return 'Meat';
  if (/juice|soda|water|coffee|tea/.test(name)) return 'Drinks';
  if (/cereal|pasta|rice|oats/.test(name)) return 'Grains';
  if (/frozen/.test(name)) return 'Frozen';
  return 'Other';
}

function titleCase(str) {
  return str.toLowerCase().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Mock AI analysis fallback
async function mockAIAnalysis(req, res) {
  console.log('Using mock AI analysis...');
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
  
  const random = Math.random();
  
  if (random < 0.4) {
    const mockBarcodes = ['87436 12389', '12345 67890', '98765 43210'];
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    
    res.json({
      type: 'barcode',
      barcode: randomBarcode,
      confidence: 0.85 + Math.random() * 0.14
    });
  } else if (random < 0.8) {
    const mockItems = [
      { name: 'Bananas', quantity: 6, unit: 'piece', category: 'Fruits', price: 2.49 },
      { name: 'Whole Milk', quantity: 1, unit: 'bottle', category: 'Dairy', price: 3.99 },
      { name: 'Sourdough Bread', quantity: 1, unit: 'loaf', category: 'Bakery', price: 4.50 }
    ];
    
    const numItems = 2 + Math.floor(Math.random() * 3);
    const selectedItems = mockItems.sort(() => 0.5 - Math.random()).slice(0, numItems);
    
    res.json({
      type: 'receipt',
      items: selectedItems,
      confidence: 0.78 + Math.random() * 0.2
    });
  } else {
    res.json({
      type: 'none',
      message: 'No barcode or receipt detected. Please try again with better lighting or positioning.'
    });
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});