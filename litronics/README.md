# Litronics Product Management System

A product management system for Litronics with PostgreSQL database and FastAPI backend.

## Modules
- **Products** - Manage product catalog with pricing and landed cost calculation
- **Purchase** - (Coming soon)
- **Sales** - (Coming soon)
- **Inventory** - (Coming soon)
- **Accounts** - (Coming soon)
- **Dispatch** - (Coming soon)
- **Technical** - (Coming soon)

## Product Fields
- Part Code
- Description
- Category
- Pieces per Unit / Packaging Quantity
- Multiple Suppliers (many-to-many relationship)
- Currency pricing (USD, RMB, INR)
- HSN Code
- Basic Custom Duty (% based on HSN)
- Freight (% - by Ship or Air based on category)
- GST (%)
- **Landed Price** (auto-calculated from all above fields)

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL

## Setup Instructions

### 1. Create PostgreSQL Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE litronics;

# Connect to the database
\c litronics

# Run the schema file
\i database/schema.sql
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Database Connection
Edit `server/main.py` and update the DATABASE_URL:
```python
DATABASE_URL = "postgresql://postgres:your_password@localhost:5432/litronics"
```

Or set environment variable:
```bash
set DATABASE_URL=postgresql://postgres:your_password@localhost:5432/litronics
```

### 4. Run the Server
```bash
cd server
uvicorn main:app --reload --port 8000
```

### 5. Access the Application
- Frontend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- API Redoc: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | Get all products |
| POST | /api/products | Create new product |
| GET | /api/products/{id} | Get product by ID |
| PUT | /api/products/{id} | Update product |
| DELETE | /api/products/{id} | Delete product |
| GET | /api/categories | Get all categories |
| POST | /api/categories | Create category |
| GET | /api/suppliers | Get all suppliers |
| POST | /api/suppliers | Create supplier |
| GET | /api/hsn-codes | Get all HSN codes |
| POST | /api/hsn-codes | Create HSN code |
| GET | /api/currency-rates | Get currency rates |
| PUT | /api/currency-rates/{code} | Update currency rate |

## Landed Price Calculation Formula

```
Base Price (INR) = Unit Price × Currency Rate
BCD Value = Base Price × (BCD % / 100)
Freight Value = Base Price × (Freight % / 100)
Subtotal = Base Price + BCD Value + Freight Value
GST Value = Subtotal × (GST % / 100)
Landed Price = Subtotal + GST Value
```

## Project Structure
```
litronics/
├── database/
│   └── schema.sql      # PostgreSQL database schema
├── public/
│   ├── index.html      # Main HTML file
│   ├── styles.css      # CSS styles
│   └── app.js          # Frontend JavaScript
├── server/
│   └── main.py         # FastAPI backend
├── requirements.txt    # Python dependencies
└── README.md           # This file
```
