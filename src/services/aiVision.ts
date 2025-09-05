// Mock AI Computer Vision Service
// In production, this would call an actual AI service like Google Vision API, OpenAI Vision, etc.

export interface BarcodeDetection {
  type: 'barcode';
  barcode: string;
  confidence: number;
}

export interface ReceiptDetection {
  type: 'receipt';
  items: {
    name: string;
    quantity: number;
    unit: string;
    category: string;
    price?: number;
  }[];
  confidence: number;
}

export interface NoDetection {
  type: 'none';
  message: string;
}

export type VisionResult = BarcodeDetection | ReceiptDetection | NoDetection;

// Mock barcode data
const mockBarcodes = [
  '87436 12389',  // Joe's Eggs
  '12345 67890',  // Bread Loaf
  '98765 43210',  // Milk 2%
  '11111 22222',  // Bananas
  '33333 44444'   // Chicken Breast
];

// Mock receipt items
const mockReceiptItems = [
  {
    name: 'Bananas',
    quantity: 6,
    unit: 'piece',
    category: 'Fruits',
    price: 2.49
  },
  {
    name: 'Whole Milk',
    quantity: 1,
    unit: 'bottle',
    category: 'Dairy',
    price: 3.99
  },
  {
    name: 'Sourdough Bread',
    quantity: 1,
    unit: 'loaf',
    category: 'Bakery',
    price: 4.50
  },
  {
    name: 'Chicken Breast',
    quantity: 2,
    unit: 'lb',
    category: 'Meat',
    price: 12.98
  },
  {
    name: 'Roma Tomatoes',
    quantity: 4,
    unit: 'piece',
    category: 'Vegetables',
    price: 3.20
  }
];

// Convert image to base64 (for demo purposes)
const imageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Real Google Vision API implementation
const GOOGLE_VISION_API_KEY = process.env.REACT_APP_GOOGLE_VISION_API_KEY;

export const analyzeImage = async (imageFile: File): Promise<VisionResult> => {
  try {
    const base64Image = await imageToBase64(imageFile);
    const imageData = base64Image.split(',')[1]; // Remove data:image/jpeg;base64, prefix

    // Use Google Vision API
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageData
            },
            features: [
              { type: 'TEXT_DETECTION', maxResults: 50 },
              { type: 'LOGO_DETECTION', maxResults: 10 }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const result = await response.json();
    const annotations = result.responses[0];

    // Check for barcodes first
    const barcodeResult = detectBarcode(annotations);
    if (barcodeResult) {
      return barcodeResult;
    }

    // Check for receipt
    const receiptResult = detectReceipt(annotations);
    if (receiptResult) {
      return receiptResult;
    }

    return {
      type: 'none',
      message: 'No barcode or receipt detected. Please try again with better lighting or positioning.'
    };

  } catch (error) {
    console.error('Error analyzing image:', error);
    
    // Fallback to mock data in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Falling back to mock data for development');
      return await analyzImageMock(imageFile);
    }
    
    return {
      type: 'none',
      message: 'Error processing image. Please check your internet connection and try again.'
    };
  }
};

// Barcode detection logic
const detectBarcode = (annotations: any): BarcodeDetection | null => {
  if (!annotations.textAnnotations) return null;

  const fullText = annotations.textAnnotations[0]?.description || '';
  
  // Look for common barcode patterns
  const barcodePatterns = [
    /\b\d{12}\b/g,           // UPC-A (12 digits)
    /\b\d{13}\b/g,           // EAN-13 (13 digits)
    /\b\d{8}\b/g,            // EAN-8 (8 digits)
    /\b\d{5}\s+\d{5}\b/g,    // Spaced format (5+5)
    /\b\d{5}\s+\d{4}\d{3}\b/g // Other spaced formats
  ];

  for (const pattern of barcodePatterns) {
    const matches = fullText.match(pattern);
    if (matches && matches.length > 0) {
      return {
        type: 'barcode',
        barcode: matches[0].replace(/\s+/g, ' '), // Normalize spacing
        confidence: 0.9
      };
    }
  }

  return null;
};

// Receipt detection logic
const detectReceipt = (annotations: any): ReceiptDetection | null => {
  if (!annotations.textAnnotations) return null;

  const fullText = annotations.textAnnotations[0]?.description || '';
  const lines = fullText.split('\n').map(line => line.trim()).filter(line => line);

  // Look for receipt indicators
  const receiptIndicators = ['receipt', 'total', 'subtotal', 'tax', 'change', 'thank you', 'store'];
  const hasReceiptIndicators = receiptIndicators.some(indicator => 
    fullText.toLowerCase().includes(indicator)
  );

  if (!hasReceiptIndicators) return null;

  // Extract items from receipt
  const items: any[] = [];
  
  for (const line of lines) {
    const item = parseReceiptLine(line);
    if (item) {
      items.push(item);
    }
  }

  if (items.length === 0) return null;

  return {
    type: 'receipt',
    items: items,
    confidence: 0.8
  };
};

// Parse individual receipt line
const parseReceiptLine = (line: string): any | null => {
  // Skip lines that are clearly not items
  const skipPatterns = [
    /^(subtotal|total|tax|change|cash|credit|debit)/i,
    /^\$?\d+\.\d{2}$/,
    /^thank you/i,
    /^store #/i,
    /^\d+\/\d+\/\d+/,
    /^\d+:\d+/
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(line.trim())) {
      return null;
    }
  }

  // Look for item patterns: "ITEM NAME $X.XX" or "QTY ITEM NAME $X.XX"
  const itemPattern = /^(\d+\s+)?(.+?)\s+\$?(\d+\.\d{2})$/;
  const match = line.match(itemPattern);

  if (match) {
    const quantity = match[1] ? parseInt(match[1].trim()) : 1;
    const itemName = match[2].trim();
    const price = parseFloat(match[3]);

    // Skip if item name is too short or looks like metadata
    if (itemName.length < 3 || /^\d+$/.test(itemName)) {
      return null;
    }

    return {
      name: titleCase(itemName),
      quantity: quantity,
      unit: 'item',
      category: categorizeItem(itemName),
      price: price
    };
  }

  return null;
};

// Helper function to categorize items
const categorizeItem = (itemName: string): string => {
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
};

// Helper function to title case
const titleCase = (str: string): string => {
  return str.toLowerCase().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Mock fallback for development
const analyzImageMock = async (imageFile: File): Promise<VisionResult> => {
  // Original mock implementation as fallback
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const random = Math.random();
  
  if (random < 0.4) {
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    return {
      type: 'barcode',
      barcode: randomBarcode,
      confidence: 0.85 + Math.random() * 0.14
    };
  } else if (random < 0.8) {
    const numItems = 2 + Math.floor(Math.random() * 4);
    const shuffledItems = [...mockReceiptItems].sort(() => 0.5 - Math.random());
    const selectedItems = shuffledItems.slice(0, numItems);
    
    return {
      type: 'receipt',
      items: selectedItems,
      confidence: 0.78 + Math.random() * 0.2
    };
  } else {
    return {
      type: 'none',
      message: 'No barcode or receipt detected. Please try again with better lighting or positioning.'
    };
  }
};

// Helper function to determine suggested expiration date based on food category
export const getSuggestedExpirationDate = (category: string): Date => {
  const today = new Date();
  const daysToAdd = (() => {
    switch (category.toLowerCase()) {
      case 'fruits': return 7;
      case 'vegetables': return 10;
      case 'dairy': return 14;
      case 'meat': return 3;
      case 'seafood': return 2;
      case 'bakery': return 5;
      case 'frozen': return 90;
      case 'canned goods': return 730;
      default: return 14;
    }
  })();
  
  const expirationDate = new Date(today);
  expirationDate.setDate(today.getDate() + daysToAdd);
  return expirationDate;
};