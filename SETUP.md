# Vehicle Parts POS System - Setup Guide

## Initial User Setup

To create your first admin user and access the system:

### Step 1: Create Admin User in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Click **"Add user"** or **"Invite user"**
4. Enter:
   - **Email**: `admin@demo.com` (or your preferred email)
   - **Password**: `demo123` (or your preferred password)
   - **Auto Confirm User**: Enable this option
5. Click **"Create user"** or **"Send invitation"**

### Step 2: Create User Profile

After creating the user in Step 1:

1. Copy the User ID (UUID) from the users list
2. Go to **SQL Editor** in Supabase
3. Run this SQL (replace `YOUR_USER_ID_HERE` with the copied UUID):

```Sql
INSERT INTO user_profiles (id, email, full_name, role, active)
VALUES (
  'YOUR_USER_ID_HERE',
  'admin@demo.com',
  'System Administrator',
  'admin',
  True
);
```

### Step 3: Login

1. Open your application
2. Login with:
   - **Email**: `admin@demo.com`
   - **Password**: `demo123`

## Creating Additional Users

Once logged in as an admin, you can create additional users:

### For Admin Users:
Repeat Steps 1-3 above, changing the role to 'admin' in the SQL.

### For Cashier Users:
Same process but change the role to 'cashier' in the SQL:

```Sql
INSERT INTO user_profiles (id, email, full_name, role, active)
VALUES (
  'CASHIER_USER_ID_HERE',
  'cashier@demo.com',
  'Cashier Name',
  'cashier',
  True
);
```

## Quick Test Data Setup

To quickly populate your system with test data for demonstration:

### 1. Add Sample Supplier

```Sql
INSERT INTO suppliers (name, contact_person, phone, email, address, active)
VALUES
  ('Auto Parts Wholesale', 'John Smith', '555-0100', 'john@autoparts.com', '123 Industry St', true);
```

### 2. Add Sample Products

```sql
INSERT INTO products (sku, barcode, name, description, category, unit, reorder_level, active)
VALUES
  ('BRK-001', '1234567890123', 'Brake Pads - Front', 'Premium ceramic brake pads', 'Brakes', 'piece', 10, true),
  ('OIL-001', '1234567890124', 'Engine Oil 5W-30', 'Synthetic engine oil 1L', 'Fluids', 'liter', 20, true),
  ('FLT-001', '1234567890125', 'Oil Filter', 'Standard oil filter', 'Filters', 'piece', 15, true);
```

### 3. Add Sample Customer

```sql
INSERT INTO customers (name, phone, email, address, credit_limit, active)
VALUES
  ('John Doe', '555-0200', 'john.doe@email.com', '456 Main St', 1000.00, true);
```

### 4. Add Sample Referral Agent

```sql
INSERT INTO referral_agents (name, type, phone, email, commission_rate, active)
VALUES
  ('City Auto Garage', 'garage', '555-0300', 'city@autogarage.com', 5.00, true);
```

## System Features

### Admin Role Can:
- Manage products, suppliers, customers, and referral agents
- Create and receive purchase orders
- Process sales and returns
- View all reports and analytics
- Full system access

### Cashier Role Can:
- Process sales at POS
- View products and inventory
- View customers and suppliers (read-only)
- Process returns
- View purchase orders (read-only)
- Cannot modify products, suppliers, or create purchase orders

## Workflow

1. **Add Suppliers** → Manage your vendors
2. **Add Products** → Build your product catalog
3. **Create Purchase Order** → Order stock from suppliers
4. **Mark PO as Received** → Creates product batches automatically
5. **Process Sales** → Use POS to sell from available batches
6. **Track Commissions** → View referral agent earnings in Reports

## Support

For issues or questions, check:
- Database migration logs in Supabase
- Browser console for any errors
- Ensure RLS policies are active

## Security Notes

- Never share your Supabase credentials
- Use strong passwords for all users
- Regularly backup your database
- Keep your `.env` file secure and never commit it to version control
