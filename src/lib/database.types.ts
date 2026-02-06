export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'cashier'
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'cashier'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'cashier'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          address: string | null
          notes: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          sku: string
          barcode: string | null
          name: string
          description: string | null
          category: string | null
          unit: string
          reorder_level: number
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          barcode?: string | null
          name: string
          description?: string | null
          category?: string | null
          unit?: string
          reorder_level?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          barcode?: string | null
          name?: string
          description?: string | null
          category?: string | null
          unit?: string
          reorder_level?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_batches: {
        Row: {
          id: string
          product_id: string
          batch_number: string
          purchase_order_id: string | null
          supplier_id: string
          cost_price: number
          selling_price: number
          markup_percentage: number
          initial_quantity: number
          current_quantity: number
          received_date: string
          expiry_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          batch_number: string
          purchase_order_id?: string | null
          supplier_id: string
          cost_price: number
          selling_price: number
          markup_percentage: number
          initial_quantity: number
          current_quantity: number
          received_date?: string
          expiry_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          batch_number?: string
          purchase_order_id?: string | null
          supplier_id?: string
          cost_price?: number
          selling_price?: number
          markup_percentage?: number
          initial_quantity?: number
          current_quantity?: number
          received_date?: string
          expiry_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          credit_limit: number
          current_credit: number
          notes: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          credit_limit?: number
          current_credit?: number
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          credit_limit?: number
          current_credit?: number
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      referral_agents: {
        Row: {
          id: string
          name: string
          type: 'garage' | 'individual' | null
          phone: string | null
          email: string | null
          address: string | null
          commission_rate: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: 'garage' | 'individual' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          commission_rate?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'garage' | 'individual' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          commission_rate?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          supplier_id: string
          order_date: string
          received_date: string | null
          status: 'pending' | 'received' | 'cancelled'
          total_amount: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          po_number: string
          supplier_id: string
          order_date?: string
          received_date?: string | null
          status?: 'pending' | 'received' | 'cancelled'
          total_amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          po_number?: string
          supplier_id?: string
          order_date?: string
          received_date?: string | null
          status?: 'pending' | 'received' | 'cancelled'
          total_amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          quantity: number
          cost_price: number
          selling_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          product_id: string
          quantity: number
          cost_price: number
          selling_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          purchase_order_id?: string
          product_id?: string
          quantity?: number
          cost_price?: number
          selling_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          sale_number: string
          customer_id: string | null
          referral_agent_id: string | null
          sale_date: string
          subtotal: number
          tax_amount: number
          discount_amount: number
          total_amount: number
          paid_amount: number
          payment_method: 'cash' | 'card' | 'credit' | 'mixed' | null
          status: 'completed' | 'partial' | 'credit'
          notes: string | null
          cashier_id: string | null
          created_at: string
          updated_at: string
          service_charge: number
        }
        Insert: {
          id?: string
          sale_number: string
          customer_id?: string | null
          referral_agent_id?: string | null
          sale_date?: string
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount: number
          paid_amount?: number
          payment_method?: 'cash' | 'card' | 'credit' | 'mixed' | null
          status?: 'completed' | 'partial' | 'credit'
          notes?: string | null
          cashier_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sale_number?: string
          customer_id?: string | null
          referral_agent_id?: string | null
          sale_date?: string
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          paid_amount?: number
          payment_method?: 'cash' | 'card' | 'credit' | 'mixed' | null
          status?: 'completed' | 'partial' | 'credit'
          notes?: string | null
          cashier_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          batch_id: string
          quantity: number
          unit_price: number
          cost_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          batch_id: string
          quantity: number
          unit_price: number
          cost_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          batch_id?: string
          quantity?: number
          unit_price?: number
          cost_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      returns: {
        Row: {
          id: string
          return_number: string
          sale_id: string | null
          customer_id: string | null
          return_date: string
          total_amount: number
          refund_method: 'cash' | 'credit_note' | 'exchange' | null
          reason: string | null
          status: 'pending' | 'approved' | 'rejected'
          processed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          return_number: string
          sale_id?: string | null
          customer_id?: string | null
          return_date?: string
          total_amount: number
          refund_method?: 'cash' | 'credit_note' | 'exchange' | null
          reason?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          processed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          return_number?: string
          sale_id?: string | null
          customer_id?: string | null
          return_date?: string
          total_amount?: number
          refund_method?: 'cash' | 'credit_note' | 'exchange' | null
          reason?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          processed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      return_items: {
        Row: {
          id: string
          return_id: string
          sale_item_id: string | null
          product_id: string
          batch_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          sale_item_id?: string | null
          product_id: string
          batch_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          sale_item_id?: string | null
          product_id?: string
          batch_id?: string
          quantity?: number
          unit_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      referral_commissions: {
        Row: {
          id: string
          sale_id: string
          referral_agent_id: string
          commission_rate: number
          sale_amount: number
          commission_amount: number
          status: 'pending' | 'paid'
          payment_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          referral_agent_id: string
          commission_rate: number
          sale_amount: number
          commission_amount: number
          status?: 'pending' | 'paid'
          payment_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          referral_agent_id?: string
          commission_rate?: number
          sale_amount?: number
          commission_amount?: number
          status?: 'pending' | 'paid'
          payment_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
