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

## Security Features

- ✅ All database operations protected by Row Level Security (RLS)
- ✅ Admin operations restricted to users with admin role
- ✅ Client-side and server-side authorization checks
- ✅ Secure authentication with Supabase Auth
- ✅ HTTPS enforced by GitHub Pages

## Support

For issues or questions:
1. Check the Supabase logs in your dashboard
2. Check browser console for JavaScript errors
3. Verify RLS policies are correctly configured

## License

This application is provided as-is for internal use by Expedited Freight Company.

## Version

Version 1.0.0 - October 2025
