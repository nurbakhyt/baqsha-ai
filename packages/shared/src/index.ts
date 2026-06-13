import { z } from "zod";

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  nameKk: z.string().max(200).optional(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type Category = z.infer<typeof CategorySchema>;

export const ProductSchema = z.object({
  id: z.string(),
  sku: z.string().min(1).max(100),
  categoryId: z.string(),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  nameKk: z.string().max(200).optional(),
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionKk: z.string().optional(),
  priceMinor: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  package: z.string().min(1).max(50),
  unit: z.enum(["kg", "piece", "pack", "liter"]),
  mediaKeys: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type Product = z.infer<typeof ProductSchema>;

export const ProductWithCategorySchema = ProductSchema.extend({
  category: CategorySchema.optional(),
});

export type ProductWithCategory = z.infer<typeof ProductWithCategorySchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  role: z.enum(["customer", "admin"]).default("customer"),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type User = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.number().int(),
  createdAt: z.number().int(),
});

export type Session = z.infer<typeof SessionSchema>;

export const CartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  priceMinor: z.number().int().positive(),
  name: z.string(),
  package: z.string(),
  unit: z.string(),
  mediaKeys: z.array(z.string()),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(CartItemSchema).default([]),
  updatedAt: z.number().int(),
});

export type Cart = z.infer<typeof CartSchema>;

export const OrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  nameEn: z.string().optional(),
  nameKk: z.string().optional(),
  priceMinor: z.number().int().positive(),
  quantity: z.number().int().positive(),
  package: z.string(),
  unit: z.string(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderStatusSchema = z.enum([
  "created",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  userId: z.string(),
  status: OrderStatusSchema.default("created"),
  items: z.array(OrderItemSchema),
  totalMinor: z.number().int().positive(),
  deliveryAddress: z.string().min(1).max(500),
  contactPhone: z.string().min(1).max(50),
  notes: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  paidAt: z.number().int().optional(),
  shippedAt: z.number().int().optional(),
  deliveredAt: z.number().int().optional(),
  cancelledAt: z.number().int().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateCategoryInputSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  nameKk: z.string().max(200).optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = CreateCategoryInputSchema.partial().extend({
  id: z.string(),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

export const CreateProductInputSchema = z.object({
  sku: z.string().min(1).max(100),
  categoryId: z.string(),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  nameKk: z.string().max(200).optional(),
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionKk: z.string().optional(),
  priceMinor: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  package: z.string().min(1).max(50),
  unit: z.enum(["kg", "piece", "pack", "liter"]),
  mediaKeys: z.array(z.string()).default([]),
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = CreateProductInputSchema.partial().extend({
  id: z.string(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

export const CreateOrderInputSchema = z.object({
  idempotencyKey: z.string(),
  deliveryAddress: z.string().min(1).max(500),
  contactPhone: z.string().min(1).max(50),
  notes: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const UpdateOrderStatusInputSchema = z.object({
  orderId: z.string(),
  status: OrderStatusSchema,
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusInputSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const ProductFiltersSchema = z.object({
  categoryId: z.string().optional(),
  inStockOnly: z.boolean().default(true),
  search: z.string().optional(),
  minPrice: z.number().int().optional(),
  maxPrice: z.number().int().optional(),
});

export type ProductFilters = z.infer<typeof ProductFiltersSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    meta: z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
      total: z.number().optional(),
    }).optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
};

export const now = () => Date.now();
export const uuid = () => crypto.randomUUID();