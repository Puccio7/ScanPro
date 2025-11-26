export interface Product {
  ean: string;
  code: string;
  description: string;
  price: number;
  brand: string;
  unit: string;
  minQty?: number;
}

export interface CartItem extends Product {
  quantity: number;
  timestamp: number;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  timestamp: number;
  products: Product[];
}

export enum AppView {
  SCANNER = 'SCANNER',
  DATABASE = 'DATABASE',
  CART = 'CART',
  SETTINGS = 'SETTINGS',
}

export interface ParsingResult {
  success: boolean;
  products: Product[];
  errors: string[];
}