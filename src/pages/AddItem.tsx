import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Layout } from '../components/Layout.tsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { foodApi } from '../services/api.ts';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const Label = styled.label`
  font-weight: bold;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #000;
  font-size: 16px;
  
  &:focus {
    outline: none;
    border-color: #4CAF50;
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  border: 2px solid #000;
  font-size: 16px;
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #4CAF50;
  }
`;

const UPCSection = styled.div`
  background: #f5f5f5;
  padding: 15px;
  border: 2px solid #000;
  text-align: center;
`;

const UPCText = styled.div`
  margin-bottom: 10px;
  font-size: 14px;
`;

const SubmitButton = styled.button`
  background: #4CAF50;
  color: white;
  border: 2px solid #000;
  padding: 15px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  
  &:hover {
    background: #45a049;
  }
`;

export const AddItem: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expirationDate: '',
    quantity: '1',
    unit: 'item',
    category: 'Other'
  });

  // Pre-fill form with data from barcode scan
  useEffect(() => {
    if (location.state) {
      const { name, category, expirationDate, upcCode } = location.state as any;
      setFormData(prev => ({
        ...prev,
        name: name || prev.name,
        category: category || prev.category,
        expirationDate: expirationDate || prev.expirationDate,
        description: name ? 'From barcode scan' : upcCode ? `Scanned barcode: ${upcCode}` : prev.description
      }));
    }
  }, [location.state]);
  const [loading, setLoading] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setShowUnitDropdown(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const categories = [
    { value: 'Fruits', label: 'Fruits' },
    { value: 'Vegetables', label: 'Vegetables' },
    { value: 'Dairy', label: 'Dairy' },
    { value: 'Meat', label: 'Meat' },
    { value: 'Seafood', label: 'Seafood' },
    { value: 'Grains', label: 'Grains' },
    { value: 'Bakery', label: 'Bakery' },
    { value: 'Canned Goods', label: 'Canned Goods' },
    { value: 'Frozen', label: 'Frozen' },
    { value: 'Drinks', label: 'Drinks' },
    { value: 'Snacks', label: 'Snacks' },
    { value: 'Condiments', label: 'Condiments' },
    { value: 'Spices', label: 'Spices' },
    { value: 'Other', label: 'Other' }
  ];

  const units = [
    { value: 'item', label: 'item(s)' },
    { value: 'kg', label: 'kg' },
    { value: 'g', label: 'g' },
    { value: 'lb', label: 'lb' },
    { value: 'oz', label: 'oz' },
    { value: 'L', label: 'L' },
    { value: 'mL', label: 'mL' },
    { value: 'cup', label: 'cup(s)' },
    { value: 'tbsp', label: 'tbsp' },
    { value: 'tsp', label: 'tsp' },
    { value: 'piece', label: 'piece(s)' },
    { value: 'box', label: 'box(es)' },
    { value: 'can', label: 'can(s)' },
    { value: 'bottle', label: 'bottle(s)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.expirationDate) {
      alert('Please fill in required fields');
      return;
    }

    try {
      setLoading(true);
      
      await foodApi.addItem({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        expirationDate: new Date(formData.expirationDate),
        upcCode: undefined,
        quantity: parseInt(formData.quantity) || 1,
        unit: formData.unit
      });
      
      navigate('/');
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error adding item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Layout title="✕ Add New Item To Pantry" showClose>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Item Name</Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter item name"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label>Description</Label>
          <TextArea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter description"
          />
        </FormGroup>

        <FormGroup>
          <Label>Category</Label>
          <div className="relative" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full p-3 border-2 border-black text-base focus:outline-none focus:border-green-600 bg-white text-left flex justify-between items-center"
            >
              <span>{categories.find(c => c.value === formData.category)?.label}</span>
              <span className={`transform transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 bg-white border-2 border-black border-t-0 max-h-48 overflow-y-auto z-10">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, category: category.value }));
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full p-3 text-left hover:bg-gray-100 transition-colors ${
                      formData.category === category.value ? 'bg-green-50 text-green-600' : ''
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FormGroup>

        <FormGroup>
          <Label>Expiration Date</Label>
          <Input
            name="expirationDate"
            type="date"
            value={formData.expirationDate}
            onChange={handleChange}
            required
          />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup>
            <Label>Quantity</Label>
            <Input
              name="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="1"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Unit</Label>
            <div className="relative" ref={unitDropdownRef}>
              <button
                type="button"
                onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                className="w-full p-3 border-2 border-black text-base focus:outline-none focus:border-green-600 bg-white text-left flex justify-between items-center"
              >
                <span>{units.find(u => u.value === formData.unit)?.label}</span>
                <span className={`transform transition-transform ${showUnitDropdown ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {showUnitDropdown && (
                <div className="absolute top-full left-0 right-0 bg-white border-2 border-black border-t-0 max-h-48 overflow-y-auto z-10">
                  {units.map((unit) => (
                    <button
                      key={unit.value}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, unit: unit.value }));
                        setShowUnitDropdown(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-gray-100 transition-colors ${
                        formData.unit === unit.value ? 'bg-green-50 text-green-600' : ''
                      }`}
                    >
                      {unit.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormGroup>
        </div>

        <SubmitButton type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add Item'}
        </SubmitButton>
      </Form>
    </Layout>
  );
};