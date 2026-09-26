// Auto-generate the full type file with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > app/lib/supabase/types.ts

export type Role            = "admin" | "staff" | "client";
export type MembershipPlan  = "basic" | "premium" | "vip";
export type MembershipStatus = "active" | "expired" | "cancelled" | "frozen";
export type InvoiceStatus   = "paid" | "pending" | "overdue" | "refunded";
export type BookingStatus   = "booked" | "waitlisted" | "cancelled" | "attended";
export type PaymentMethod   = "visa" | "mastercard" | "gcash" | "cash" | "other";

export interface Profile {
  id:              string;
  full_name:       string;
  avatar_initials: string;
  avatar_color:    string;
  title:           string;
  role:            Role;
  created_at:      string;
  updated_at:      string;
}

export interface Membership {
  id:           string;
  client_id:    string;
  plan:         MembershipPlan;
  status:       MembershipStatus;
  started_at:   string;
  expires_at:   string | null;
  price_cents:  number;
  created_at:   string;
  updated_at:   string;
}

export interface Trainer {
  id:         string;
  specialty:  string;
  bio:        string;
  rating:     number;
  status:     string;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id:           string;
  title:        string;
  description:  string;
  trainer_id:   string | null;
  room:         string;
  color:        string;
  capacity:     number;
  duration_min: number;
  created_at:   string;
  updated_at:   string;
}

export interface ClassSession {
  id:         string;
  class_id:   string;
  starts_at:  string;
  ends_at:    string;
  cancelled:  boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id:         string;
  session_id: string;
  client_id:  string;
  status:     BookingStatus;
  booked_at:  string;
  updated_at: string;
}

export interface Invoice {
  id:            string;
  client_id:     string;
  membership_id: string | null;
  description:   string;
  amount_cents:  number;
  status:        InvoiceStatus;
  method:        PaymentMethod;
  due_at:        string;
  paid_at:       string | null;
  created_at:    string;
  updated_at:    string;
}

export interface Checkin {
  id:            string;
  client_id:     string;
  session_id:    string | null;
  checked_in_at: string;
  note:          string;
}

// View types
export interface SessionEnrollment {
  session_id:   string;
  class_id:     string;
  starts_at:    string;
  ends_at:      string;
  cancelled:    boolean;
  title:        string;
  room:         string;
  color:        string;
  capacity:     number;
  duration_min: number;
  trainer_name: string | null;
  enrolled:     number;
  waitlisted:   number;
}

export interface ClientRevenue {
  client_id:     string;
  full_name:     string;
  paid_cents:    number;
  overdue_cents: number;
  invoice_count: number;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      memberships: {
        Row:    Membership;
        Insert: Partial<Membership>;
        Update: Partial<Membership>;
      };
      trainers: {
        Row:    Trainer;
        Insert: Partial<Trainer>;
        Update: Partial<Trainer>;
      };
      classes: {
        Row:    Class;
        Insert: Partial<Class>;
        Update: Partial<Class>;
      };
      class_sessions: {
        Row:    ClassSession;
        Insert: Partial<ClassSession>;
        Update: Partial<ClassSession>;
      };
      bookings: {
        Row:    Booking;
        Insert: Partial<Booking>;
        Update: Partial<Booking>;
      };
      invoices: {
        Row:    Invoice;
        Insert: Partial<Invoice>;
        Update: Partial<Invoice>;
      };
      checkins: {
        Row:    Checkin;
        Insert: Partial<Checkin>;
        Update: Partial<Checkin>;
      };
    };
    Views: {
      session_enrollment: { Row: SessionEnrollment; };
      client_revenue:     { Row: ClientRevenue; };
    };
    Functions: {
      current_user_role:  { Returns: Role };
      is_admin:           { Returns: boolean };
      is_staff_or_admin:  { Returns: boolean };
    };
    Enums: {
      user_role:         Role;
      membership_plan:   MembershipPlan;
      membership_status: MembershipStatus;
      invoice_status:    InvoiceStatus;
      booking_status:    BookingStatus;
      payment_method:    PaymentMethod;
    };
  };
};
