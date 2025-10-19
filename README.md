# Expedited Freight Historical Orders Search Application

A web-based application for searching and managing historical freight orders. Built with vanilla JavaScript and Supabase backend, designed to be hosted on GitHub Pages.

## Features

- 🔐 **User Authentication** - Secure login using Supabase Auth
- 🔍 **Advanced Search** - Search orders by origin, destination, and carrier
- 📊 **Analytics** - View aggregate metrics like average price and distance per mile
- 👥 **User Management** - Admin interface for managing user accounts and roles
- 📤 **Data Upload** - Import orders from CSV or JSON files
- 📥 **Export Data** - Download search results or full dataset as CSV
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Hosting**: GitHub Pages
- **APIs**: Supabase JavaScript Client

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Fill in your project details:
   - Project name: `freight-orders` (or any name)
   - Database password: (choose a strong password)
   - Region: (select closest to your location)
4. Wait for the project to finish setting up

### 2. Set Up Database Tables

In your Supabase project dashboard:

1. Go to **SQL Editor** (in the sidebar)
2. Click **New Query**
3. Paste and execute the following SQL:

```sql
-- Create historical_orders table
CREATE TABLE historical_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT UNIQUE NOT NULL,
    origin_city TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    carrier TEXT NOT NULL,
    price NUMERIC NOT NULL,
    distance NUMERIC NOT NULL,
    price_per_mile NUMERIC,
    vehicle_info TEXT,
    order_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for search performance
CREATE INDEX idx_origin_city ON historical_orders(origin_city);
CREATE INDEX idx_destination_city ON historical_orders(destination_city);
CREATE INDEX idx_carrier ON historical_orders(carrier);
CREATE INDEX idx_order_date ON historical_orders(order_date);

-- Create user_roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE historical_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for historical_orders
-- Allow authenticated users to read all orders
CREATE POLICY "Allow authenticated users to read orders"
    ON historical_orders FOR SELECT
    TO authenticated
    USING (true);

-- Allow only admins to insert orders
CREATE POLICY "Allow admins to insert orders"
    ON historical_orders FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow only admins to update orders
CREATE POLICY "Allow admins to update orders"
    ON historical_orders FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow only admins to delete orders
CREATE POLICY "Allow admins to delete orders"
    ON historical_orders FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- RLS Policies for user_roles
-- Allow users to read their own role
CREATE POLICY "Users can read their own role"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Allow admins to read all roles
CREATE POLICY "Admins can read all roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admins to manage roles
CREATE POLICY "Admins can insert roles"
    ON user_roles FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update roles"
    ON user_roles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete roles"
    ON user_roles FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### 3. Enable Email Authentication

1. Go to **Authentication** > **Providers** in Supabase dashboard
2. Make sure **Email** is enabled
3. (Optional) Configure email templates under **Authentication** > **Email Templates**

### 4. Create Your First Admin User

1. Go to **Authentication** > **Users** in Supabase dashboard
2. Click **Add User** > **Create new user**
3. Enter your email and password
4. After creating the user, go to **SQL Editor** and run:

```sql
-- Replace 'your-user-id' with the actual user ID from the Users table
INSERT INTO user_roles (user_id, role)
VALUES ('your-user-id', 'admin');
```

### 5. Get Your Supabase API Credentials

1. Go to **Settings** > **API** in Supabase dashboard
2. Copy the following:
   - Project URL (looks like: `https://xxxxx.supabase.co`)
   - Anon/Public Key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 6. Configure the Application

1. Download all the application files
2. Open `js/config.js` in a text editor
3. Replace the placeholder values:

```javascript
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 7. Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Upload all application files to the repository:
   - index.html
   - dashboard.html
   - admin-users.html
   - admin-data.html
   - css/styles.css
   - js/config.js
   - js/auth.js
   - js/search.js
   - js/user-management.js
   - js/data-management.js
   - README.md

3. Go to repository **Settings** > **Pages**
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**
7. Wait a few minutes and your site will be live at:
   `https://yourusername.github.io/repository-name/`

## Usage Guide

### For Regular Users

1. **Login**: Navigate to the application URL and enter your credentials
2. **Search Orders**:
   - Enter at least one search criteria (Origin, Destination, or Carrier)
   - Click "Search Orders"
   - View results with aggregate metrics
3. **Export Data**: Click "Export to CSV" to download search results
4. **Logout**: Click the "Logout" button when finished

### For Admins

In addition to regular user features:

#### User Management
1. Navigate to **User Management** from the top menu
2. **Add Users**: Fill in the form with email, password, and role
3. **Edit Users**: Click "Edit Role" to change a user's role
4. **Delete Users**: Click "Delete" to remove a user (cannot delete yourself)

#### Data Management
1. Navigate to **Data Management** from the top menu
2. **View Statistics**: See current data metrics
3. **Upload Data**:
   - Click "Select File" and choose a CSV or JSON file
   - Preview the data
   - Choose "Append Records" (add to existing) or "Replace All Data" (delete and reload)
4. **Download Data**: Click "Download All Data" to export the entire database

### CSV File Format

Your CSV file should include these columns:

```
order_id,origin_city,destination_city,carrier,price,distance,order_date
ORD-001,"Los Angeles, CA","New York, NY","ABC Transport",1500,2789,2024-01-15
ORD-002,"Chicago, IL","Miami, FL","XYZ Freight",1200,1377,2024-01-16
```

**Required columns:**
- `order_id` - Unique identifier
- `origin_city` - Origin city and state
- `destination_city` - Destination city and state
- `carrier` - Carrier name
- `price` - Numeric price value
- `distance` - Distance in miles
- `order_date` - Date in YYYY-MM-DD format

**Optional:**
- `vehicle_info` - Additional vehicle details
- `price_per_mile` - Will be auto-calculated if not provided

## Security Features

- ✅ All database operations protected by Row Level Security (RLS)
- ✅ Admin operations restricted to users with admin role
- ✅ Client-side and server-side authorization checks
- ✅ Secure authentication with Supabase Auth
- ✅ HTTPS enforced by GitHub Pages

## Troubleshooting

### "Supabase configuration error"
- Make sure you've updated `js/config.js` with your actual credentials
- Check that SUPABASE_URL and SUPABASE_ANON_KEY are correct

### "Access denied" on admin pages
- Verify your user has admin role in the `user_roles` table
- Check RLS policies are correctly applied

### Search returns no results
- Verify data exists in the `historical_orders` table
- Check that your search criteria matches the data format
- Try searching with partial text (search is case-insensitive)

### Upload fails
- Check CSV format matches the required columns
- Ensure numeric fields contain valid numbers
- Verify date format is YYYY-MM-DD

## Support

For issues or questions:
1. Check the Supabase logs in your dashboard
2. Check browser console for JavaScript errors
3. Verify RLS policies are correctly configured

## License

This application is provided as-is for internal use by Expedited Freight Company.

## Version

Version 1.0.0 - October 2025
