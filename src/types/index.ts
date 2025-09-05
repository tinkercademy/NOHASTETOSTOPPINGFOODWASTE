export interface FoodItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  expirationDate: Date;
  addedDate: Date;
  upcCode?: string;
  daysLeft: number;
  quantity: number;
  unit: string;
}

export interface Category {
  name: string;
  count: number;
}

export interface UPCResponse {
  name: string;
  category: string;
  shelfLife: number; // days
}