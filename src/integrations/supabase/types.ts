export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      company_pos: {
        Row: {
          created_at: string | null
          customer_po_id: string
          distributor_name: string
          file_name: string
          file_path: string
          id: string
          po_number: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          customer_po_id: string
          distributor_name: string
          file_name: string
          file_path: string
          id?: string
          po_number: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          customer_po_id?: string
          distributor_name?: string
          file_name?: string
          file_path?: string
          id?: string
          po_number?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_pos_customer_po_id_fkey"
            columns: ["customer_po_id"]
            isOneToOne: false
            referencedRelation: "customer_pos"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_pos: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          id: string
          po_number: string
          quote_id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          id?: string
          po_number: string
          quote_id: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          po_number?: string
          quote_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_pos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string | null
          delivery_record_id: string
          id: string
          quantity_delivered: number
          waybill_item_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_record_id: string
          id?: string
          quantity_delivered?: number
          waybill_item_id: string
        }
        Update: {
          created_at?: string | null
          delivery_record_id?: string
          id?: string
          quantity_delivered?: number
          waybill_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_record_id_fkey"
            columns: ["delivery_record_id"]
            isOneToOne: false
            referencedRelation: "delivery_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_waybill_item_id_fkey"
            columns: ["waybill_item_id"]
            isOneToOne: false
            referencedRelation: "waybill_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_records: {
        Row: {
          created_at: string | null
          delivered_by: string | null
          delivery_date: string
          delivery_notes: string | null
          id: string
          waybill_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_by?: string | null
          delivery_date?: string
          delivery_notes?: string | null
          id?: string
          waybill_id: string
        }
        Update: {
          created_at?: string | null
          delivered_by?: string | null
          delivery_date?: string
          delivery_notes?: string | null
          id?: string
          waybill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_records_waybill_id_fkey"
            columns: ["waybill_id"]
            isOneToOne: false
            referencedRelation: "waybills"
            referencedColumns: ["id"]
          },
        ]
      }
      department_hierarchy: {
        Row: {
          created_at: string
          department_id: string
          id: string
          reports_to: Database["public"]["Enums"]["managerial_role"]
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          reports_to: Database["public"]["Enums"]["managerial_role"]
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          reports_to?: Database["public"]["Enums"]["managerial_role"]
        }
        Relationships: [
          {
            foreignKeyName: "department_hierarchy_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      distributor_invoices: {
        Row: {
          company_po_id: string
          created_at: string | null
          file_name: string
          file_path: string
          id: string
          invoice_number: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_po_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          id?: string
          invoice_number: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_po_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          invoice_number?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributor_invoices_company_po_id_fkey"
            columns: ["company_po_id"]
            isOneToOne: false
            referencedRelation: "company_pos"
            referencedColumns: ["id"]
          },
        ]
      }
      distributor_quotes: {
        Row: {
          company_po_id: string | null
          created_at: string | null
          customer_po_id: string | null
          file_name: string
          file_path: string
          id: string
          quote_number: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_po_id?: string | null
          created_at?: string | null
          customer_po_id?: string | null
          file_name: string
          file_path: string
          id?: string
          quote_number: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_po_id?: string | null
          created_at?: string | null
          customer_po_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          quote_number?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributor_quotes_company_po_id_fkey"
            columns: ["company_po_id"]
            isOneToOne: false
            referencedRelation: "company_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_quotes_customer_po_id_fkey"
            columns: ["customer_po_id"]
            isOneToOne: false
            referencedRelation: "customer_pos"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_manager_mapping: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          manager_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          manager_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          manager_id?: string
        }
        Relationships: []
      }
      expense_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          expense_ticket_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          expense_ticket_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          expense_ticket_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_audit_logs_expense_ticket_id_fkey"
            columns: ["expense_ticket_id"]
            isOneToOne: false
            referencedRelation: "expense_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_details: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          expense_ticket_id: string
          id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          expense_ticket_id: string
          id?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          expense_ticket_id?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_details_expense_ticket_id_fkey"
            columns: ["expense_ticket_id"]
            isOneToOne: false
            referencedRelation: "expense_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_retirements: {
        Row: {
          expense_ticket_id: string
          file_name: string
          file_path: string
          id: string
          notes: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          expense_ticket_id: string
          file_name: string
          file_path: string
          id?: string
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          expense_ticket_id?: string
          file_name?: string
          file_path?: string
          id?: string
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_retirements_expense_ticket_id_fkey"
            columns: ["expense_ticket_id"]
            isOneToOne: false
            referencedRelation: "expense_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_tickets: {
        Row: {
          actual_amount_spent: number | null
          amount_requested: number | null
          created_at: string | null
          currency: string
          date: string
          digital_signature: string | null
          employee_id: string | null
          finance_paid_at: string | null
          finance_paid_by: string | null
          has_receipt: boolean | null
          id: string
          issued_in_favour_of: string
          manager_approved_at: string | null
          manager_id: string | null
          manager_notes: string | null
          payment_acknowledged: boolean | null
          payment_acknowledged_at: string | null
          payment_details: string | null
          purpose: string
          refund_confirmed_at: string | null
          refund_confirmed_by: string | null
          refund_status: string | null
          remaining_balance: number | null
          status: Database["public"]["Enums"]["expense_status"]
          ticket_number: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          actual_amount_spent?: number | null
          amount_requested?: number | null
          created_at?: string | null
          currency?: string
          date?: string
          digital_signature?: string | null
          employee_id?: string | null
          finance_paid_at?: string | null
          finance_paid_by?: string | null
          has_receipt?: boolean | null
          id?: string
          issued_in_favour_of: string
          manager_approved_at?: string | null
          manager_id?: string | null
          manager_notes?: string | null
          payment_acknowledged?: boolean | null
          payment_acknowledged_at?: string | null
          payment_details?: string | null
          purpose: string
          refund_confirmed_at?: string | null
          refund_confirmed_by?: string | null
          refund_status?: string | null
          remaining_balance?: number | null
          status?: Database["public"]["Enums"]["expense_status"]
          ticket_number: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          actual_amount_spent?: number | null
          amount_requested?: number | null
          created_at?: string | null
          currency?: string
          date?: string
          digital_signature?: string | null
          employee_id?: string | null
          finance_paid_at?: string | null
          finance_paid_by?: string | null
          has_receipt?: boolean | null
          id?: string
          issued_in_favour_of?: string
          manager_approved_at?: string | null
          manager_id?: string | null
          manager_notes?: string | null
          payment_acknowledged?: boolean | null
          payment_acknowledged_at?: string | null
          payment_details?: string | null
          purpose?: string
          refund_confirmed_at?: string | null
          refund_confirmed_by?: string | null
          refund_status?: string | null
          remaining_balance?: number | null
          status?: Database["public"]["Enums"]["expense_status"]
          ticket_number?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          company_po_id: string
          created_at: string | null
          customer_po_id: string
          file_name: string | null
          file_path: string | null
          generated_by: string | null
          id: string
          invoice_number: string
          quote_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          company_po_id: string
          created_at?: string | null
          customer_po_id: string
          file_name?: string | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          invoice_number: string
          quote_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_po_id?: string
          created_at?: string | null
          customer_po_id?: string
          file_name?: string | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          invoice_number?: string
          quote_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_po_id_fkey"
            columns: ["company_po_id"]
            isOneToOne: false
            referencedRelation: "company_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_po_id_fkey"
            columns: ["customer_po_id"]
            isOneToOne: false
            referencedRelation: "customer_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_assignments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          role: Database["public"]["Enums"]["managerial_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          role: Database["public"]["Enums"]["managerial_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          role?: Database["public"]["Enums"]["managerial_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          related_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          related_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          related_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          completion_date: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          documentation_path: string | null
          id: string
          project_name: string
          project_number: string
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          documentation_path?: string | null
          id?: string
          project_name: string
          project_number: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          documentation_path?: string | null
          id?: string
          project_name?: string
          project_number?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string | null
          customer_name: string
          file_name: string
          file_path: string
          id: string
          quote_number: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          file_name: string
          file_path: string
          id?: string
          quote_number: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          file_name?: string
          file_path?: string
          id?: string
          quote_number?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_department_assignments: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          department_id: string | null
          department_role: Database["public"]["Enums"]["app_role_new"] | null
          employee_type: Database["public"]["Enums"]["employee_type"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          department_role?: Database["public"]["Enums"]["app_role_new"] | null
          employee_type?: Database["public"]["Enums"]["employee_type"]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          department_role?: Database["public"]["Enums"]["app_role_new"] | null
          employee_type?: Database["public"]["Enums"]["employee_type"]
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      waybill_items: {
        Row: {
          company_po_id: string | null
          created_at: string | null
          description: string
          id: string
          items_outstanding: number | null
          items_received: number | null
          quantity: number
          reference: string | null
          serial_number: string | null
          updated_at: string | null
          waybill_id: string | null
        }
        Insert: {
          company_po_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          items_outstanding?: number | null
          items_received?: number | null
          quantity?: number
          reference?: string | null
          serial_number?: string | null
          updated_at?: string | null
          waybill_id?: string | null
        }
        Update: {
          company_po_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          items_outstanding?: number | null
          items_received?: number | null
          quantity?: number
          reference?: string | null
          serial_number?: string | null
          updated_at?: string | null
          waybill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waybill_items_company_po_id_fkey"
            columns: ["company_po_id"]
            isOneToOne: false
            referencedRelation: "company_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybill_items_waybill_id_fkey"
            columns: ["waybill_id"]
            isOneToOne: false
            referencedRelation: "waybills"
            referencedColumns: ["id"]
          },
        ]
      }
      waybills: {
        Row: {
          company_po_id: string
          created_at: string | null
          created_by: string | null
          delivery_status: string | null
          file_name: string | null
          file_path: string | null
          id: string
          product_details: string | null
          serial_numbers: string[] | null
          signed_at: string | null
          signed_by: string | null
          signed_waybill_name: string | null
          signed_waybill_path: string | null
          total_items_delivered: number | null
          total_items_ordered: number | null
          updated_at: string | null
          waybill_number: string
        }
        Insert: {
          company_po_id: string
          created_at?: string | null
          created_by?: string | null
          delivery_status?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          product_details?: string | null
          serial_numbers?: string[] | null
          signed_at?: string | null
          signed_by?: string | null
          signed_waybill_name?: string | null
          signed_waybill_path?: string | null
          total_items_delivered?: number | null
          total_items_ordered?: number | null
          updated_at?: string | null
          waybill_number: string
        }
        Update: {
          company_po_id?: string
          created_at?: string | null
          created_by?: string | null
          delivery_status?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          product_details?: string | null
          serial_numbers?: string[] | null
          signed_at?: string | null
          signed_by?: string | null
          signed_waybill_name?: string | null
          signed_waybill_path?: string | null
          total_items_delivered?: number | null
          total_items_ordered?: number | null
          updated_at?: string | null
          waybill_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "waybills_company_po_id_fkey"
            columns: ["company_po_id"]
            isOneToOne: false
            referencedRelation: "company_pos"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_tracker: {
        Row: {
          company_po_id: string | null
          created_at: string | null
          current_stage: Database["public"]["Enums"]["workflow_stage"]
          customer_po_id: string | null
          id: string
          invoice_id: string | null
          project_id: string | null
          quote_id: string
          updated_at: string | null
        }
        Insert: {
          company_po_id?: string | null
          created_at?: string | null
          current_stage?: Database["public"]["Enums"]["workflow_stage"]
          customer_po_id?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          quote_id: string
          updated_at?: string | null
        }
        Update: {
          company_po_id?: string | null
          created_at?: string | null
          current_stage?: Database["public"]["Enums"]["workflow_stage"]
          customer_po_id?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          quote_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tracker_company_po_id_fkey"
            columns: ["company_po_id"]
            isOneToOne: false
            referencedRelation: "company_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tracker_customer_po_id_fkey"
            columns: ["customer_po_id"]
            isOneToOne: false
            referencedRelation: "customer_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tracker_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tracker_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tracker_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_document: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      generate_expense_ticket_number: { Args: never; Returns: string }
      has_department_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role_new"]
          _user_id: string
        }
        Returns: boolean
      }
      has_employee_type: {
        Args: {
          _type: Database["public"]["Enums"]["employee_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approving_director: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "sales"
        | "orders"
        | "finance"
        | "projects"
        | "employee"
        | "manager"
      app_role_new: "admin" | "sales" | "orders" | "finance" | "projects"
      employee_type: "employee" | "manager"
      expense_status:
        | "draft"
        | "pending_manager_approval"
        | "approved"
        | "rejected"
        | "paid"
        | "retired"
      managerial_role:
        | "director_finance"
        | "director_business"
        | "director_cx"
        | "head_compliance"
        | "director_of_technology"
      workflow_stage:
        | "quote_uploaded"
        | "customer_po_uploaded"
        | "company_po_uploaded"
        | "waybill_created"
        | "invoice_generated"
        | "completed"
        | "awaiting_project_completion"
        | "project_completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "sales",
        "orders",
        "finance",
        "projects",
        "employee",
        "manager",
      ],
      app_role_new: ["admin", "sales", "orders", "finance", "projects"],
      employee_type: ["employee", "manager"],
      expense_status: [
        "draft",
        "pending_manager_approval",
        "approved",
        "rejected",
        "paid",
        "retired",
      ],
      managerial_role: [
        "director_finance",
        "director_business",
        "director_cx",
        "head_compliance",
        "director_of_technology",
      ],
      workflow_stage: [
        "quote_uploaded",
        "customer_po_uploaded",
        "company_po_uploaded",
        "waybill_created",
        "invoice_generated",
        "completed",
        "awaiting_project_completion",
        "project_completed",
      ],
    },
  },
} as const
