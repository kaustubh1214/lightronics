# Litronics Product Management System

A product management system for Litronics with SQLite database and FastAPI backend.

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
- **Database**: SQLite (with SQLAlchemy ORM)
- **Admin Panel**: SQLAdmin

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Server

```bash
cd server
uvicorn main:app --reload --port 8000
```

The SQLite database will be created automatically on first run.

### 3. Access the Application

- **Frontend**: http://localhost:8000
- **Admin Panel**: http://localhost:8000/admin
- **API Docs**: http://localhost:8000/docs
- **API Redoc**: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                          | Description              |
| ------ | --------------------------------- | ------------------------ |
| GET    | /api/products                     | Get all products         |
| POST   | /api/products                     | Create new product       |
| DELETE | /api/products/{id}                | Delete product           |
| GET    | /api/products/by-part-code/{code} | Get product by part code |
| GET    | /api/categories                   | Get all categories       |
| GET    | /api/suppliers                    | Get all suppliers        |
| GET    | /api/hsn-codes                    | Get all HSN codes        |
| GET    | /api/hsn-codes/{id}               | Get HSN code by ID       |
| POST   | /api/hsn-codes                    | Create HSN code          |
| GET    | /api/currency-rates               | Get currency rates       |
| GET    | /api/health                       | API health check         |

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
│   └── schema.sql          # PostgreSQL database schema (reference)
├── public/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # CSS styles
│   ├── choices-dark.css    # Dark theme for Choices.js
│   └── app.js              # Frontend JavaScript
├── server/
│   ├── __init__.py         # Package initialization
│   ├── main.py             # FastAPI application entry point
│   ├── database.py         # Database configuration (SQLAlchemy)
│   ├── models.py           # SQLAlchemy ORM models
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── routes.py           # API route handlers
│   ├── admin.py            # SQLAdmin configuration
│   ├── seed.py             # Default data seeding
│   └── litronics.db        # SQLite database file
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## Server Modules

| Module        | Description                               |
| ------------- | ----------------------------------------- |
| `main.py`     | FastAPI app setup, middleware, startup    |
| `database.py` | SQLAlchemy engine and session management  |
| `models.py`   | Database table definitions (ORM models)   |
| `schemas.py`  | Pydantic models for request validation    |
| `routes.py`   | All API endpoint handlers                 |
| `admin.py`    | SQLAdmin panel views configuration        |
| `seed.py`     | Default data initialization               |
