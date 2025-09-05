# No Haste to Stopping Food Waste

A mobile-optimized web application for tracking food expiration dates and reducing food waste.

## Features

- **Mobile-First Design**: Optimized for smartphone usage
- **Barcode Scanning**: Add items by scanning UPC codes  
- **Manual Entry**: Add items manually with expiration tracking
- **Receipt Scanning**: Bulk add items from receipts (UI ready)
- **Expiration Tracking**: Color-coded items based on days until expiration
- **Category Management**: Organize items by food categories
- **Microcontroller API**: Endpoint for ESP32/Arduino displays

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # Shared components
│   ├── pages/             # Page components
│   ├── types/             # TypeScript types
│   └── App.tsx            # Main app component
├── server/                # Node.js backend
│   ├── database.js        # SQLite database setup
│   ├── server.js          # Express server
│   └── package.json       # Server dependencies
└── public/                # Static assets
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. **Install frontend dependencies:**
```bash
npm install
```

2. **Install backend dependencies:**
```bash
cd server
npm install
cd ..
```

### Running the Application

1. **Start the backend server:**
```bash
cd server
npm start
```
Server runs on http://localhost:3002

2. **Start the frontend (in a new terminal):**
```bash
npm start
```
Frontend runs on http://localhost:3000

## API Endpoints

### Food Items
- `GET /api/items` - Get all food items
- `POST /api/items` - Add new food item
- `DELETE /api/items/:id` - Delete food item

### UPC Lookup
- `GET /api/upc/:code` - Lookup item by UPC code

### Categories
- `GET /api/categories` - Get categories with item counts

### Microcontroller API
- `GET /api/microcontroller/expiring?days=7` - Get items expiring within X days

### Testing the API
You can test the microcontroller endpoint directly:
```bash
curl http://localhost:3002/api/microcontroller/expiring?days=7
```

## Color Coding System

- **Red**: Expired items
- **Orange**: Expiring in 0-2 days  
- **Purple**: Expiring in 3-5 days
- **Default**: More than 5 days remaining

## ESP32 Integration

The microcontroller can poll the `/api/microcontroller/expiring` endpoint to display expiring items on an LCD/TFT screen near your fridge.

Example ESP32 code structure:
```cpp
#include <WiFi.h>
#include <HTTPClient.h>

void pollFoodData() {
  HTTPClient http;
  http.begin("http://your-server:3001/api/microcontroller/expiring?days=7");
  // Parse JSON response and display on screen
}
```

## Future Enhancements

- [ ] Camera-based barcode scanning
- [ ] Receipt OCR processing
- [ ] Push notifications for expiring items
- [ ] Shopping list generation
- [ ] Multi-user support