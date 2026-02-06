import { CustomerRepository } from '../repositories/CustomerRepository';
import { Customer } from '../types';
import { logger } from '../lib/logger';

export interface CreateCustomerInput {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    credit_limit?: number;
}

export class CustomerService {
    constructor(private customerRepo: CustomerRepository) { }

    async getAllCustomers(): Promise<Customer[]> {
        try {
            logger.debug('Fetching all active customers');
            return await this.customerRepo.findAllActive();
        } catch (error) {
            logger.error('Failed to fetch customers', error as Error);
            throw new Error('Unable to load customers');
        }
    }

    async getCustomerCount(): Promise<number> {
        try {
            return await this.customerRepo.countActive();
        } catch (error) {
            logger.error('Failed to count customers', error as Error);
            return 0;
        }
    }

    async createCustomer(input: CreateCustomerInput): Promise<Customer> {
        try {
            if (!input.name) throw new Error('Customer name is required');

            const customer = await this.customerRepo.create({
                ...input,
                active: true,
                current_credit: 0
            });
            logger.info('Customer created', { id: customer.id, name: customer.name });
            return customer;
        } catch (error) {
            logger.error('Failed to create customer', error as Error);
            throw error;
        }
    }

    async searchCustomers(term: string): Promise<Customer[]> {
        try {
            return await this.customerRepo.search(term);
        } catch (error) {
            logger.error('Failed to search customers', error as Error);
            throw new Error('Search failed');
        }
    }

    async getAllReferralAgents() {
        try {
            const { referralAgentRepository } = await import('../repositories');
            return await referralAgentRepository.findAllActive();
        } catch (error) {
            logger.error('Failed to fetch referral agents', error as Error);
            return [];
        }
    }

    async createReferralAgent(agentData: any) {
        try {
            const { referralAgentRepository } = await import('../repositories');
            return await referralAgentRepository.create({
                ...agentData,
                active: true
            });
        } catch (error) {
            logger.error('Failed to create referral agent', error as Error);
            throw error;
        }
    }
}
