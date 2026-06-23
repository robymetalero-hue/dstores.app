export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  createdBy: string;
  creatorEmail: string;
  createdAt: any; // Can be Timestamp or compatible
  updatedAt: any;
}

export type ProductFormInput = Omit<Product, 'id' | 'createdBy' | 'creatorEmail' | 'createdAt' | 'updatedAt'>;
