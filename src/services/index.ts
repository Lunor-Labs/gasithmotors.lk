import { productRepository, customerRepository, saleRepository, adapter } from '../repositories';
import { ProductService } from './ProductService';
import { SalesService } from './SalesService';
import { InventoryService } from './InventoryService';
import { CustomerService } from './CustomerService';

// Create service instances
export const productService = new ProductService(productRepository);
export const inventoryService = new InventoryService(productRepository, adapter);
export const salesService = new SalesService(saleRepository, customerRepository, productRepository, inventoryService);
export const customerService = new CustomerService(customerRepository);

// Export service classes for testing
export { ProductService, SalesService, InventoryService, CustomerService };
