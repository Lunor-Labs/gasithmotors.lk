import { SaleRepository, SaleWithItems } from '../repositories/SaleRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { Sale, SaleItem } from '../types';
import { logger } from '../lib/logger';

export interface CreateSaleInput {
    customer_id?: string;
    cashier_id: string;
    items: Array<{
        product_id: string;
        batch_id: string;
        quantity: number;
        unit_price: number;
    }>;
    payment_method: 'cash' | 'card' | 'credit';
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    notes?: string;
}

/**
 * Sales service - handles sales business logic
 */
export class SalesService {
    constructor(
        private saleRepo: SaleRepository,
        private customerRepo: CustomerRepository
    ) { }

    /**
     * Create a new sale
     */
    async createSale(input: CreateSaleInput): Promise<SaleWithItems> {
        try {
            logger.info('Creating new sale', {
                customerId: input.customer_id,
                itemCount: input.items.length,
                total: input.total_amount,
                paymentMethod: input.payment_method,
            });

            // Validate sale data
            this.validateSaleInput(input);

            // Determine sale status
            const status = this.determineSaleStatus(
                input.total_amount,
                input.paid_amount,
                input.payment_method
            );

            // If credit sale, validate customer credit limit
            if (status === 'credit' || status === 'partial') {
                await this.validateCreditLimit(input.customer_id!, input.total_amount - input.paid_amount);
            }

            // Generate sale number
            const saleNumber = await this.generateSaleNumber();

            // Prepare sale data
            const saleData: Partial<Sale> = {
                sale_number: saleNumber,
                customer_id: input.customer_id || null,
                cashier_id: input.cashier_id,
                sale_date: new Date().toISOString(),
                payment_method: input.payment_method,
                subtotal: input.subtotal,
                discount_amount: input.discount_amount,
                tax_amount: input.tax_amount,
                total_amount: input.total_amount,
                paid_amount: input.paid_amount,
                status,
                notes: input.notes || null,
            };

            // Prepare sale items
            const saleItems: Partial<SaleItem>[] = input.items.map(item => ({
                product_id: item.product_id,
                batch_id: item.batch_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.quantity * item.unit_price,
            }));

            // Create sale with items
            const sale = await this.saleRepo.createWithItems(saleData, saleItems);

            // Update customer credit if applicable
            if (input.customer_id && (status === 'credit' || status === 'partial')) {
                const creditAmount = input.total_amount - input.paid_amount;
                await this.customerRepo.updateCredit(input.customer_id, creditAmount);

                logger.info('Customer credit updated', {
                    customerId: input.customer_id,
                    creditAmount,
                });
            }

            logger.info('Sale created successfully', {
                saleId: sale.id,
                saleNumber: sale.sale_number,
                total: sale.total_amount,
                status: sale.status,
            });

            return sale;
        } catch (error) {
            logger.error('Failed to create sale', error as Error, { input });
            throw error;
        }
    }

    /**
     * Process a credit payment
     */
    async processCreditPayment(
        saleId: string,
        paymentAmount: number
    ): Promise<Sale> {
        try {
            logger.info('Processing credit payment', { saleId, paymentAmount });

            const sale = await this.saleRepo.findById(saleId);
            if (!sale) {
                throw new Error('Sale not found.');
            }

            if (sale.status === 'completed') {
                throw new Error('Sale is already fully paid.');
            }

            if (paymentAmount <= 0) {
                throw new Error('Payment amount must be greater than zero.');
            }

            const remainingBalance = sale.total_amount - sale.paid_amount;
            if (paymentAmount > remainingBalance) {
                throw new Error(`Payment amount exceeds remaining balance of LKR ${remainingBalance.toFixed(2)}`);
            }

            const newPaidAmount = sale.paid_amount + paymentAmount;
            const newStatus = newPaidAmount >= sale.total_amount ? 'completed' : 'partial';

            // Update sale
            const updatedSale = await this.saleRepo.updatePayment(saleId, newPaidAmount, newStatus);

            // Update customer credit
            if (sale.customer_id) {
                await this.customerRepo.updateCredit(sale.customer_id, -paymentAmount);

                logger.info('Customer credit reduced', {
                    customerId: sale.customer_id,
                    amount: paymentAmount,
                });
            }

            logger.info('Credit payment processed successfully', {
                saleId,
                paymentAmount,
                newStatus,
            });

            return updatedSale;
        } catch (error) {
            logger.error('Failed to process credit payment', error as Error, {
                saleId,
                paymentAmount,
            });
            throw error;
        }
    }

    /**
     * Get sales by customer
     */
    async getSalesByCustomer(customerId: string): Promise<Sale[]> {
        try {
            logger.debug('Fetching sales for customer', { customerId });
            return await this.saleRepo.findByCustomerId(customerId);
        } catch (error) {
            logger.error('Failed to fetch customer sales', error as Error, { customerId });
            throw new Error('Unable to load customer sales.');
        }
    }

    /**
     * Get credit sales by customer
     */
    async getCreditSalesByCustomer(customerId: string): Promise<Sale[]> {
        try {
            logger.debug('Fetching credit sales for customer', { customerId });
            return await this.saleRepo.findCreditSalesByCustomerId(customerId);
        } catch (error) {
            logger.error('Failed to fetch credit sales', error as Error, { customerId });
            throw new Error('Unable to load credit sales.');
        }
    }

    /**
     * Get sales statistics for a date range
     */
    async getSalesStatistics(startDate: string, endDate: string) {
        try {
            logger.info('Fetching sales statistics', { startDate, endDate });

            const stats = await this.saleRepo.getStatistics(startDate, endDate);

            logger.info('Sales statistics retrieved', stats);

            return stats;
        } catch (error) {
            logger.error('Failed to fetch sales statistics', error as Error, {
                startDate,
                endDate,
            });
            throw new Error('Unable to load sales statistics.');
        }
    }

    /**
     * Validate sale input
     */
    private validateSaleInput(input: CreateSaleInput): void {
        if (!input.cashier_id) {
            throw new Error('Cashier ID is required.');
        }

        if (!input.items || input.items.length === 0) {
            throw new Error('Sale must have at least one item.');
        }

        if (input.total_amount <= 0) {
            throw new Error('Total amount must be greater than zero.');
        }

        if (input.paid_amount < 0) {
            throw new Error('Paid amount cannot be negative.');
        }

        if (input.payment_method === 'credit' && !input.customer_id) {
            throw new Error('Customer is required for credit sales.');
        }

        // Validate items
        for (const item of input.items) {
            if (item.quantity <= 0) {
                throw new Error('Item quantity must be greater than zero.');
            }
            if (item.unit_price < 0) {
                throw new Error('Item price cannot be negative.');
            }
        }
    }

    /**
     * Determine sale status based on payment
     */
    private determineSaleStatus(
        totalAmount: number,
        paidAmount: number,
        paymentMethod: string
    ): 'completed' | 'partial' | 'credit' {
        if (paidAmount >= totalAmount) {
            return 'completed';
        } else if (paidAmount > 0) {
            return 'partial';
        } else if (paymentMethod === 'credit') {
            return 'credit';
        } else {
            return 'completed'; // Default for cash/card
        }
    }

    /**
     * Validate customer credit limit
     */
    private async validateCreditLimit(customerId: string, creditAmount: number): Promise<void> {
        const customer = await this.customerRepo.findById(customerId);

        if (!customer) {
            throw new Error('Customer not found.');
        }

        const newCreditTotal = customer.current_credit + creditAmount;

        if (newCreditTotal > customer.credit_limit) {
            throw new Error(
                `Credit limit exceeded. Available credit: LKR ${(customer.credit_limit - customer.current_credit).toFixed(2)}`
            );
        }
    }

    /**
     * Generate unique sale number
     */
    private async generateSaleNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-6);

        return `SALE-${year}${month}${day}-${timestamp}`;
    }
}
