import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PantryItems } from './pages/PantryItems.tsx';
import { Categories } from './pages/Categories.tsx';
import { CategoryItems } from './pages/CategoryItems.tsx';
import { AddItem } from './pages/AddItem.tsx';
import { BarcodeScanner } from './pages/BarcodeScanner.tsx';
import { ReceiptScanner } from './pages/ReceiptScanner.tsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PantryItems />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/categories/:categoryName" element={<CategoryItems />} />
        <Route path="/add" element={<AddItem />} />
        <Route path="/scan" element={<BarcodeScanner />} />
        <Route path="/receipt" element={<ReceiptScanner />} />
      </Routes>
    </Router>
  );
}

export default App;