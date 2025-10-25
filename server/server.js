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
  try {
    const rows = db.prepare(`
      SELECT id, name, description, category, expiration_date, added_date, upc_code, quantity, unit,
             CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) as days_left
      FROM food_items
      ORDER BY days_left ASC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new food item
app.post('/api/items', (req, res) => {
  try {
    const { name, description, category, expirationDate, upcCode, quantity = 1, unit = 'item' } = req.body;

    const result = db.prepare(`
      INSERT INTO food_items (name, description, category, expiration_date, upc_code, quantity, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, description, category, expirationDate, upcCode, quantity, unit);

    res.json({ id: result.lastInsertRowid, message: 'Item added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update item quantity
app.patch('/api/items/:id/quantity', (req, res) => {
  try {
    const { quantity } = req.body;
    const id = req.params.id;

    if (quantity <= 0) {
      // Delete item if quantity is 0 or less
      db.prepare('DELETE FROM food_items WHERE id = ?').run(id);
      res.json({ message: 'Item deleted (quantity reached 0)' });
    } else {
      // Update quantity
      db.prepare('UPDATE food_items SET quantity = ? WHERE id = ?').run(quantity, id);
      res.json({ message: 'Quantity updated successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete food item
app.delete('/api/items/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM food_items WHERE id = ?').run(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPC lookup
app.get('/api/upc/:code', (req, res) => {
  try {
    const upcCode = req.params.code.replace(/\s/g, ''); // Remove spaces

    const row = db.prepare('SELECT * FROM products WHERE upc_code = ?').get(upcCode);
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'UPC code not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get categories with counts
app.get('/api/categories', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM food_items
      WHERE CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) > 0
      GROUP BY category
      ORDER BY category
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint for microcontroller - get items expiring soon
app.get('/api/microcontroller/expiring', (req, res) => {
  try {
    const daysThreshold = req.query.days || 7;

    const rows = db.prepare(`
      SELECT name, category,
             CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) as days_left
      FROM food_items
      WHERE CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) <= ?
        AND CAST((julianday(expiration_date) - julianday('now')) AS INTEGER) >= 0
      ORDER BY days_left ASC
      LIMIT 10
    `).all(daysThreshold);

    res.json({
      count: rows.length,
      items: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Food expiration lookup (for estimating expiration dates)
app.get('/api/food-expiration/:name', (req, res) => {
  try {
    const foodName = req.params.name.toLowerCase();

    const row = db.prepare(`
      SELECT * FROM food_expiration
      WHERE LOWER(food_name) LIKE ?
      ORDER BY LENGTH(food_name) ASC
      LIMIT 1
    `).get(`%${foodName}%`);

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product lookup endpoints

// Get product by UPC code
app.get('/api/products/upc/:upcCode', (req, res) => {
  try {
    const { upcCode } = req.params;
    const cleanUpc = upcCode.replace(/\s/g, ''); // Remove spaces from UPC code

    const product = db.prepare(`
      SELECT * FROM products
      WHERE REPLACE(upc_code, ' ', '') = ?
    `).get(cleanUpc);

    if (product) {
      console.log(`Found product: ${product.name} for UPC: ${upcCode}`);
      return res.json({
        found: true,
        product: product
      });
    } else {
      console.log(`No product found for UPC: ${upcCode}`);
      return res.json({
        found: false,
        message: 'Product not found in database'
      });
    }
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Search products by name (for fallback matching)
app.get('/api/products/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const searchTerms = `%${query.toLowerCase()}%`;

    const products = db.prepare(`
      SELECT p.*,
             pa.confidence_score,
             CASE
               WHEN LOWER(p.name) LIKE LOWER(?) THEN 1.0
               WHEN LOWER(p.description) LIKE LOWER(?) THEN 0.9
               WHEN LOWER(p.brand) LIKE LOWER(?) THEN 0.8
               ELSE pa.confidence_score
             END as match_score
      FROM products p
      LEFT JOIN product_alternatives pa ON p.upc_code = pa.upc_code
      WHERE LOWER(p.name) LIKE LOWER(?)
         OR LOWER(p.description) LIKE LOWER(?)
         OR LOWER(p.brand) LIKE LOWER(?)
         OR LOWER(pa.search_terms) LIKE LOWER(?)
      ORDER BY match_score DESC
      LIMIT 5
    `).all(searchTerms, searchTerms, searchTerms, searchTerms, searchTerms, searchTerms, searchTerms);

    if (products && products.length > 0) {
      console.log(`Found ${products.length} products matching: ${query}`);
      return res.json({
        found: true,
        products: products,
        query: query
      });
    } else {
      console.log(`No products found matching: ${query}`);
      return res.json({
        found: false,
        message: 'No matching products found'
      });
    }
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Add new product to database
app.post('/api/products', (req, res) => {
  const {
    upcCode,
    name,
    description,
    category,
    brand,
    size,
    unit,
    shelfLifeDays,
    storageType,
    typicalQuantity
  } = req.body;

  if (!upcCode || !name || !category || !shelfLifeDays) {
    return res.status(400).json({
      error: 'Missing required fields: upcCode, name, category, shelfLifeDays'
    });
  }

  try {
    const result = db.prepare(`
    INSERT OR REPLACE INTO products (
      upc_code, name, description, category, brand, size, unit,
      shelf_life_days, storage_type, typical_quantity, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    upcCode, name, description, category, brand, size, unit,
    shelfLifeDays, storageType || 'pantry', typicalQuantity || 1
  );

  console.log(`Added new product: ${name} (UPC: ${upcCode})`);
  res.json({
    id: result.lastInsertRowid,
    message: 'Product added successfully',
    upcCode: upcCode,
    name: name
  });
} catch (err) {
  console.error('Database error:', err);
  return res.status(500).json({ error: err.message });
}
});

// Get all products (for management)
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT * FROM products
      ORDER BY category, name
    `).all();

    res.json({
      products: products,
      count: products.length
    });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: err.message });
  }
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
  console.log('=== GEMINI CLIENT INITIALIZATION START ===');

  try {
    // Use Gemini API key first, then fall back to Vision API key
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
    const visionKey = process.env.REACT_APP_GOOGLE_VISION_API_KEY;

    console.log('🔑 GOOGLE_GEMINI_API_KEY exists:', !!geminiKey);
    console.log('🔑 GOOGLE_GEMINI_API_KEY length:', geminiKey?.length || 0);
    if (geminiKey) {
      console.log('🔑 GOOGLE_GEMINI_API_KEY starts with:', geminiKey.substring(0, 10) + '...');
    }

    console.log('🔑 REACT_APP_GOOGLE_VISION_API_KEY exists:', !!visionKey);
    console.log('🔑 REACT_APP_GOOGLE_VISION_API_KEY length:', visionKey?.length || 0);
    if (visionKey) {
      console.log('🔑 REACT_APP_GOOGLE_VISION_API_KEY starts with:', visionKey.substring(0, 10) + '...');
    }

    const apiKey = geminiKey || visionKey;

    if (apiKey) {
      console.log('🚀 Initializing Google Gemini AI client...');
      console.log('🔑 Using API key source:', geminiKey ? 'GOOGLE_GEMINI_API_KEY' : 'REACT_APP_GOOGLE_VISION_API_KEY');

      geminiClient = new GoogleGenerativeAI(apiKey);

      console.log('✅ Google Gemini AI client initialized successfully');
      console.log('🧠 Client object created:', !!geminiClient);
      console.log('🧠 Client type:', typeof geminiClient);
    } else {
      console.log('❌ No Google API key found - Gemini AI disabled');
      console.log('❌ Set GOOGLE_GEMINI_API_KEY or REACT_APP_GOOGLE_VISION_API_KEY');
      console.log('❌ Available environment variables:', Object.keys(process.env).filter(key => key.includes('GOOGLE')).join(', '));
    }
  } catch (error) {
    console.log('❌ Error initializing Google Gemini client:');
    console.log('❌ Error type:', error.constructor.name);
    console.log('❌ Error message:', error.message);
    console.log('❌ Error stack:', error.stack);
  }

  console.log('=== GEMINI CLIENT INITIALIZATION END ===');
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
        console.log('Identified as barcode, looking up product...');

        // Try to find product in database
        const productResult = await lookupProductByBarcode(barcodeResult.barcode);
        if (productResult) {
          return res.json(productResult);
        } else {
          // Return basic barcode info if product not found
          return res.json({
            ...barcodeResult,
            message: 'Barcode detected but product not found in database',
            suggestion: 'You can add this product manually'
          });
        }
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
 * Look up product information by barcode code
 *
 * @param {string} barcode - The barcode to look up
 * @returns {Object|null} - Product information or null if not found
 */
async function lookupProductByBarcode(barcode) {
  try {
    const cleanBarcode = barcode.replace(/\s/g, '');

    const product = db.prepare(`
      SELECT * FROM products
      WHERE REPLACE(upc_code, ' ', '') = ?
    `).get(cleanBarcode);

    if (product) {
      console.log(`Found product in database: ${product.name}`);
      return {
        type: 'product',
        barcode: barcode,
        product: product,
        confidence: 0.95
      };
    } else {
      console.log(`Product not found in database for barcode: ${barcode}`);
      return null;
    }
  } catch (err) {
    console.error('Database lookup error:', err);
    return null;
  }
}


/**
 * Extract food items from receipt text using Google Gemini AI
 *
 * @param {string} text - OCR text extracted from receipt image
 * @returns {Array|null} - Array of structured food items or null if extraction fails
 */
async function extractReceiptItemsWithGemini(text) {
  console.log('=== GEMINI AI EXTRACTION START ===');

  if (!geminiClient) {
    console.log('❌ Gemini client not available - checking configuration...');
    console.log('🔑 GOOGLE_GEMINI_API_KEY configured:', !!process.env.GOOGLE_GEMINI_API_KEY);
    console.log('🔑 GOOGLE_GEMINI_API_KEY length:', process.env.GOOGLE_GEMINI_API_KEY?.length || 0);
    console.log('🔑 GOOGLE_GEMINI_API_KEY starts with:', process.env.GOOGLE_GEMINI_API_KEY?.substring(0, 10) + '...' || 'NOT_SET');
    return null;
  }

  if (!text || text.trim().length === 0) {
    console.log('❌ No text provided for LLM processing');
    return null;
  }

  console.log('📄 Input text length:', text.length);
  console.log('📄 Input text preview:', text.substring(0, 200) + '...');

  try {
    console.log('🤖 Initializing Gemini model: gemini-2.5-flash');
    const model = geminiClient.getGenerativeModel({ model: "gemini-2.5-flash" });
    console.log('✅ Gemini model initialized successfully');

    const prompt = `
Extract ONLY FOOD AND GROCERY items from this receipt text. Ignore all non-food items completely.

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "name": "item name",
    "quantity": number,
    "unit": "item" | "kg" | "g" | "lbs" | "oz" | "L" | "mL",
    "price": number,
    "category": "Produce" | "Dairy" | "Meat" | "Seafood" | "Bakery" | "Pantry" | "Frozen" | "Beverages" | "Snacks" | "Household" | "Personal Care" | "Other"
  }
]

FOOD ITEMS TO INCLUDE:
✅ Fresh fruits and vegetables (apples, bananas, lettuce, tomatoes, etc.)
✅ Dairy products (milk, cheese, yogurt, butter, eggs)
✅ Meat and poultry (chicken, beef, pork, turkey)
✅ Seafood (fish, shrimp, salmon)
✅ Bakery items (bread, bagels, muffins, pastries)
✅ Pantry staples (pasta, rice, flour, sugar, oil, spices)
✅ Canned goods (canned beans, tomatoes, soup)
✅ Frozen foods (frozen vegetables, meals, ice cream)
✅ Beverages (juice, soda, water, coffee, tea)
✅ Snacks (chips, crackers, nuts, granola bars)
✅ Condiments and sauces (ketchup, mustard, salad dressing)
✅ Breakfast foods (cereal, oatmeal, pancake mix)

NON-FOOD ITEMS TO EXCLUDE:
❌ Electronics (batteries, chargers, cables, light bulbs)
❌ Household supplies (paper towels, toilet paper, cleaning products, detergent)
❌ Personal care (shampoo, soap, toothpaste, deodorant, cosmetics)
❌ Health and beauty (vitamins, medicine, first aid)
❌ Pet supplies (pet food, toys, litter)
❌ Office supplies (pens, paper, folders)
❌ Automotive (motor oil, windshield fluid)
❌ Garden supplies (fertilizer, tools)
❌ Clothing and accessories
❌ Gift cards, lottery tickets
❌ Services (deli, bakery orders)
❌ Taxes, fees, bag charges

Rules:
- Be VERY STRICT about only including food items
- Handle weight-based items (e.g., "0.5 lbs apples" -> quantity: 0.5, unit: "lbs")
- Parse quantity from item names (e.g., "2 Dozen Eggs" -> quantity: 24, unit: "item")
- Handle bulk items (e.g., "Bananas @ $0.59/lb" with weight "1.2 lbs" -> quantity: 1.2, unit: "lbs")
- Use the expanded category list above
- If quantity not specified, default to 1
- If unit not specified, use "item"
- If no price found, set to null
- Clean item names (remove brand names unless essential for identification)
- If NO food items found, return an empty array []

Receipt Text:
${text}

JSON Response:`;

    console.log('📤 Sending prompt to Gemini AI (length:', prompt.length, ')');
    console.log('🕐 Request timestamp:', new Date().toISOString());

    const result = await model.generateContent(prompt);
    console.log('✅ Gemini AI responded successfully');

    const response = await result.response;
    const responseText = response.text();

    console.log('📥 Gemini response length:', responseText.length);
    console.log('📥 Gemini response preview:', responseText.substring(0, 300) + '...');
    console.log('🕐 Response timestamp:', new Date().toISOString());

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      console.log('✅ Found JSON array in response');
      console.log('🔍 JSON match length:', jsonMatch[0].length);

      try {
        const items = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON parsed successfully');
        console.log('📦 Total items extracted:', items.length);

        // Log each extracted item for debugging
        items.forEach((item, index) => {
          console.log(`📋 Item ${index + 1}:`, JSON.stringify(item, null, 2));
        });

        // Only accept pure food categories - exclude household and personal care
        const foodCategories = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Bakery', 'Pantry', 'Frozen', 'Beverages', 'Snacks', 'Other'];
        console.log('🍎 Food categories allowed:', foodCategories);

        const validItems = items.filter(item => {
          const isValid = item.name &&
            typeof item.quantity === 'number' &&
            item.unit &&
            foodCategories.includes(item.category);

          if (!isValid) {
            console.log('❌ Invalid item:', JSON.stringify(item, null, 2));
            console.log('   - Has name:', !!item.name);
            console.log('   - Quantity type:', typeof item.quantity, 'value:', item.quantity);
            console.log('   - Has unit:', !!item.unit);
            console.log('   - Category:', item.category, 'allowed:', foodCategories.includes(item.category));
          }

          return isValid;
        });

        console.log(`✅ ${validItems.length} valid food items after filtering`);
        if (validItems.length === 0) {
          console.log('⚠️  All items failed validation - likely non-food items detected');
        }

        console.log('=== GEMINI AI EXTRACTION SUCCESS ===');
        return validItems;
      } catch (parseError) {
        console.log('❌ JSON parse error:', parseError.message);
        console.log('❌ Invalid response format - response was:', responseText);
        return null;
      }
    } else {
      console.log('❌ No valid JSON array found in Gemini response');
      console.log('❌ Full response was:', responseText);
      return null;
    }
  } catch (error) {
    console.log('❌ === GEMINI AI EXTRACTION FAILED ===');
    console.log('❌ Error type:', error.constructor.name);
    console.log('❌ Error message:', error.message);
    console.log('❌ Error stack:', error.stack);

    // Check for specific error types
    if (error.message.includes('API_KEY')) {
      console.log('🔑 API key issue - check GOOGLE_GEMINI_API_KEY configuration');
    }
    if (error.message.includes('quota') || error.message.includes('limit')) {
      console.log('💰 Quota/limit issue - check API usage and billing');
    }
    if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.log('🌐 Network issue - check internet connectivity');
    }

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