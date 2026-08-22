-- Migration to add item-level referral commission fields to sale_items
-- Allows admin to manually set a commission rate or fixed amount per line item,
-- in addition to the existing sale-level commission in referral_commissions.

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS referral_commission_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS referral_commission_amount DECIMAL(10,2);
