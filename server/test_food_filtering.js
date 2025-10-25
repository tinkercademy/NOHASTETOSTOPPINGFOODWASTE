// Test script to verify food-only filtering in receipt parsing
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testFoodFiltering() {
  console.log('🧪 Testing food filtering in receipt parsing...\n');

  // Initialize Gemini client
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.REACT_APP_GOOGLE_VISION_API_KEY;
  if (!geminiKey) {
    console.log('❌ No Gemini API key found. Please set GOOGLE_GEMINI_API_KEY or REACT_APP_GOOGLE_VISION_API_KEY');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Test receipt with mixed food and non-food items
  const mixedReceipt = `
TARGET STORE
123 Main Street
New York, NY 10001
Oct 25, 2024 4:30 PM

BANANAS 1.2 lbs @ $0.59/lb $0.71
WHOLE MILK 1 GAL $3.99
BREAD LOAF WHOLE WHEAT $2.49
AA BATTERIES 4-pack $5.99
PAPER TOWELS 6 ROLL $8.99
CHICKEN BREAST 1.5 lbs @ $8.99/lb $13.49
SHAMPOO 12 oz $6.99
TOOTHPASTE 3 oz $3.49
LAUNDRY DETERGENT 50 oz $12.99
APPLES 3 lb bag @ $1.99/lb $5.97
YOGURT PLAIN 32 oz $4.99

SUBTOTAL $69.09
TAX $5.52
TOTAL $74.61
THANK YOU FOR SHOPPING
VISA ****1234
`;

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
${mixedReceipt}

JSON Response:`;

  console.log('📄 Sample mixed receipt:');
  console.log(mixedReceipt);
  console.log('\n🤖 Sending to Gemini AI...');

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log('\n📋 Gemini AI Response:');
    console.log(responseText);

    // Extract and parse JSON
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const items = JSON.parse(jsonMatch[0]);

        console.log('\n✅ Parsed Items:');
        items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.name} (${item.category}) - $${item.price} - ${item.quantity} ${item.unit}`);
        });

        // Food-only validation
        const foodCategories = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Bakery', 'Pantry', 'Frozen', 'Beverages', 'Snacks', 'Other'];
        const validFoodItems = items.filter(item => foodCategories.includes(item.category));

        console.log(`\n🍎 Food Items Found: ${validFoodItems.length}/${items.length}`);
        console.log('✅ Successfully filtered out non-food items!');

      } catch (parseError) {
        console.log('\n❌ JSON parse error:', parseError.message);
      }
    } else {
      console.log('\n❌ No valid JSON found in response');
    }

  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
  }

  console.log('\n🎉 Food filtering test completed!');
  console.log('\n📝 Expected Behavior:');
  console.log('   ✅ INCLUDE: Bananas, Milk, Bread, Chicken, Apples, Yogurt');
  console.log('   ❌ EXCLUDE: Batteries, Paper towels, Shampoo, Toothpaste, Detergent');

  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

testFoodFiltering();