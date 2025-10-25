// Load environment variables from .env file
require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const fs = require('fs');

// Google AI services
const vision = require('@google-cloud/vision');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Database
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

// Initialize Vision client with better error handling
let visionClient = null;

try {
  if (fs.existsSync('./google-service-account.json')) {
    console.log('Initializing Google Vision client with service account...');
    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: './google-service-account.json',
    });
    console.log('Google Vision client initialized successfully');
  } else {
    console.log('Google service account not found - using mock AI only');
  }
} catch (error) {
  console.error('Error initializing Google Vision client:', error);
  console.log('Will fall back to mock AI');
}

// Initialize Gemini AI client
let geminiClient = null;

async function initializeGeminiClient() {
  try {
    // Use Gemini API key first, then fall back to Vision API key
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.REACT_APP_GOOGLE_VISION_API_KEY;

    if (apiKey) {
      console.log('Initializing Google Gemini AI client...');
      geminiClient = new GoogleGenerativeAI(apiKey);
      console.log('Google Gemini AI client initialized successfully');
    } else {
      console.log('No Google API key found - Gemini AI disabled');
      console.log('Set GOOGLE_GEMINI_API_KEY or REACT_APP_GOOGLE_VISION_API_KEY');
    }
  } catch (error) {
    console.error('Error initializing Google Gemini client:', error);
  }
}

// Initialize Gemini client asynchronously
initializeGeminiClient();

app.post('/api/analyze-image', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Use Google Vision API if available, otherwise mock
    if (!visionClient) {
      console.log('Google Vision not available, using mock AI...');
      return await mockAIAnalysis(req, res);
    }

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
      const receiptResult = await detectReceiptInTextWithLLM(fullText);
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


/**
 * Extract food items from receipt text using Google Gemini AI
 *
 * @param {string} text - OCR text extracted from receipt image
 * @returns {Array|null} - Array of structured food items or null if extraction fails
 */
async function extractReceiptItemsWithGemini(text) {
  if (!geminiClient) {
    console.log('Gemini client not available');
    return null;
  }

  if (!text || text.trim().length === 0) {
    console.log('No text provided for LLM processing');
    return null;
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Extract food items from this receipt text. Return ONLY a JSON array of objects with this exact structure:
[
  {
    "name": "item name",
    "quantity": number,
    "unit": "item" | "kg" | "g" | "lbs" | "oz" | "L" | "mL",
    "price": number,
    "category": "Bakery" | "Dairy" | "Fruits" | "Vegetables" | "Meat" | "Drinks" | "Grains" | "Frozen" | "Other"
  }
]

Rules:
- Only extract food/grocery items (ignore non-food items like electronics, household items, etc.)
- Handle weight-based items (e.g., "0.5 lbs apples" -> quantity: 0.5, unit: "lbs")
- Parse quantity from item names (e.g., "2 Dozen Eggs" -> quantity: 24, unit: "item")
- Handle bulk items (e.g., "Bananas @ $0.59/lb" with weight "1.2 lbs" -> quantity: 1.2, unit: "lbs")
- Infer appropriate category from item name
- If quantity not specified, default to 1
- If unit not specified, use "item"
- If no price found, set to null
- Item names should be clean and descriptive
- Handle common receipt formatting variations

Receipt Text:
${text}

JSON Response:`;

    console.log('Calling Gemini AI for receipt parsing...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const items = JSON.parse(jsonMatch[0]);

        // Validate and clean up the items
        const validItems = items.filter(item =>
          item.name &&
          typeof item.quantity === 'number' &&
          item.unit &&
          ['Bakery', 'Dairy', 'Fruits', 'Vegetables', 'Meat', 'Drinks', 'Grains', 'Frozen', 'Other'].includes(item.category)
        );

        console.log(`Gemini extracted ${validItems.length} valid items from receipt`);
        if (validItems.length === 0) {
          console.log('All items failed validation. Using structured data extraction requirements');
        }
        return validItems;
      } catch (parseError) {
        console.log('JSON parse error - invalid response format');
        return null;
      }
    } else {
      console.log('No valid JSON found in Gemini response');
      return null;
    }
  } catch (error) {
    console.error('Error calling Gemini AI:', error);
    return null;
  }
}

// Updated receipt detection function with LLM integration
async function detectReceiptInTextWithLLM(text) {
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

  // Try LLM extraction
  let items = null;
  if (geminiClient) {
    items = await extractReceiptItemsWithGemini(text);
  }

  // If LLM fails, don't fall back to regex parsing (as requested)
  if (!items || items.length === 0) {
    console.log('LLM extraction failed or returned no items - not falling back to regex parsing');
    return null;
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

// Helper function to format item names
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