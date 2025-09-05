import axios from 'axios';
import { FoodItem, Category, UPCResponse } from '../types';

const API_BASE_URL = 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const foodApi = {
  // Get all food items
  getAllItems: async (): Promise<FoodItem[]> => {
    const response = await api.get('/items');
    return response.data.map((item: any) => ({
      ...item,
      expirationDate: new Date(item.expiration_date),
      addedDate: new Date(item.added_date),
      daysLeft: item.days_left,
      quantity: item.quantity || 1,
      unit: item.unit || 'item'
    }));
  },

  // Add new food item
  addItem: async (item: Omit<FoodItem, 'id' | 'addedDate' | 'daysLeft'>): Promise<{ id: string }> => {
    const response = await api.post('/items', {
      name: item.name,
      description: item.description,
      category: item.category,
      expirationDate: item.expirationDate.toISOString().split('T')[0],
      upcCode: item.upcCode,
      quantity: item.quantity,
      unit: item.unit
    });
    return response.data;
  },

  // Update item quantity
  updateQuantity: async (id: string, quantity: number): Promise<void> => {
    await api.patch(`/items/${id}/quantity`, { quantity });
  },

  // Delete food item
  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/items/${id}`);
  },

  // Get categories with counts
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data.map((cat: any) => ({
      name: cat.category,
      count: cat.count
    }));
  },

  // UPC lookup
  lookupUPC: async (upcCode: string): Promise<UPCResponse> => {
    const response = await api.get(`/upc/${upcCode}`);
    return {
      name: response.data.name,
      category: response.data.category,
      shelfLife: response.data.shelf_life_days
    };
  },

  // Food expiration lookup
  getFoodExpiration: async (foodName: string): Promise<any> => {
    const response = await api.get(`/food-expiration/${foodName}`);
    return response.data;
  }
};