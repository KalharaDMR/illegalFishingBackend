# 🌊 OceanWatch – Illegal Fishing Monitoring & Management System (Backend API)

## 📌 Project Overview

OceanWatch is a secure RESTful backend system developed to monitor and manage illegal fishing activities and marine protection zones. The platform supports real-time reporting, investigations, endangered species tracking, and automated alerting mechanisms.

This system is designed with a scalable and modular architecture, ensuring maintainability and clean separation of responsibilities.

---

## 🎯 Key Features

| Feature             | Description                                      |
| ------------------- | ------------------------------------------------ |
|  Authentication   | JWT-based authentication with role-based access  |
|  User Roles       | ADMIN, AUTHORIZED_PERSON, PUBLIC_USER, ZOOLOGIST |
|  Restricted Zones | Manage protected marine areas                    |
|  Reports          | Submit and track illegal fishing reports         |
|  Investigations   | Full CRUD with evidence upload                   |
|  Species Tracking | Manage endangered marine species                 |
|  Notifications    | SMS (Twilio) + Email (SendGrid) alerts           |
|  File Upload      | Images & videos via Multer + Cloudinary          |
|  PDF Reports      | Generate investigation reports                   |
|  AI Advisory      | Gemini API for intelligent insights              |

---

## 🏗️ System Architecture

The backend follows a layered architecture:

```id="arch1"
Controller → Service Layer → Database (MongoDB)
```

### Core Components

1. Authentication & Authorization
2. Restricted Zone Management
3. Report Management
4. Investigation Management
5. Species Management
6. User Profile Management

Each component contains:

* Controller (request handling)
* Routes (API definitions)
* Service logic (business logic)
* Validation (input validation)

---

## 🛠️ Technology Stack

* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB (Mongoose ODM)
* **Authentication**: JWT + bcryptjs
* **API Docs**: Swagger
* **Testing**: Jest, Supertest, Artillery, Playwright

### Third-Party Integrations

* Twilio → SMS alerts
* SendGrid → Email notifications
* Cloudinary → Image storage
* Multer → File uploads
* PDFKit → PDF generation
* Gemini API → AI advisory

---

## 🗄️ Database Design (MongoDB)

### Collections

* Users
* RestrictedZones
* Reports
* Investigations
* Species

* Proper schema validation
* Efficient data modeling
* Relationship handling via references

---

## 🔐 Security Features

* JWT Authentication
* Role-Based Access Control (RBAC)
* Protected Routes
* Input Validation & Sanitization
* Centralized Error Handling

---

## ⚙️ Setup Instructions

### 1. Prerequisites

* Node.js (v14+)
* MongoDB (Local or Atlas)
* Git
* Postman
* Twilio / SendGrid / Cloudinary accounts
* Gemini API Key

---

### 2. Clone Repository

```bash id="cmd1"
git clone https://github.com/KalharaDMR/illegalFishingBackend
cd illegalFishingBackend
```

### 3. Install Dependencies

```bash id="cmd2"
npm install
```

---

### 4. Environment Configuration

Create a `.env` file:

```env id="env1"
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/marine_protection

JWT_SECRET=your_secret

TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=xxx

SENDGRID_API_KEY=xxx
FROM_EMAIL=noreply@marineprotection.com

CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

GEMINI_API_KEY=xxx
```

---

### 5. Create Upload Directories

```bash id="cmd3"
mkdir -p src/uploads/investigations/images
mkdir -p src/uploads/investigations/videos
mkdir -p src/uploads/reports
mkdir -p src/uploads/species
```

---

### 6. Run the Server

```bash id="cmd4"
npm start
```

---

## 📁 Project Structure

```id="structure"
illegalFishingBackend/
├── src/
│   ├── config/                      # Configuration files
│   │   ├── db.js                    # Database connection
│   │   ├── cloudinary.js            # Cloudinary configuration
│   │   └── swagger.js               # Swagger API documentation
│   │
│   ├── models/                      # MongoDB schemas
│   │   ├── user.js                  # User model
│   │   ├── IllegalReport.js         # Report model
│   │   ├── Investigation.js         # Investigation model
│   │   ├── Species.model.js         # Endangered species model
│   │   └── restricted.zone.js       # Restricted zone model
│   │
│   ├── controllers/                # Request handling & business logic
│   │   ├── auth.controller.js       # Authentication logic
│   │   ├── admin.controller.js      # Admin operations
│   │   ├── report.controller.js     # Report management
│   │   ├── investigation.controller.js # Investigation CRUD operations
│   │   ├── Zoologist.controller.js  # Species management
│   │   └── Restrictedzone.controller.js # Zone management
│   │
│   ├── routes/                     # API route definitions
│   │   ├── auth.routes.js
│   │   ├── admin.routes.js
│   │   ├── report.routes.js
│   │   ├── investigation.routes.js
│   │   ├── Zoologist.routes.js
│   │   └── restrictedzone.routes.js
│   │
│   ├── services/                   # External services & integrations
│   │   ├── twilio.service.js       # SMS notifications (Twilio)
│   │   ├── notification.service.js # Notification logic
│   │   ├── email.service.js        # Email service (SendGrid)
│   │   └── pdf.service.js          # PDF generation
│   │
│   ├── middleware/                # Custom middleware
│   │   ├── auth.middleware.js      # JWT authentication
│   │   └── role.middleware.js      # Role-based authorization
│   │
│   ├── utils/                     # Utility/helper functions
│   │   ├── jwt.js                 # JWT token utilities
│   │   └── geoUtils.js            # Geolocation calculations
│   │
│   ├── uploads/                   # Uploaded files storage
│   │   ├── investigations/
│   │   │   ├── images/
│   │   │   └── videos/
│   │   └── reports/
│   │
│   ├── app.js                     # Express application setup
│   └── server.js                  # Server entry point
│
├── .env                           # Environment variables
├── package.json                   # Project dependencies
└── README.md                      # Project documentation
```

* Clean modular structure
* Separation of concerns
* Scalable design

---

## 📄 API Documentation

Swagger UI available at:

```id="swagger"
http://localhost:5000/api-docs
```

Includes:

* Endpoint descriptions
* Request/response formats
* Authentication requirements

---

## 🧪 Testing Instruction Report

### 1. Unit Testing (Jest)

* Tests individual services and logic

```bash id="test1"
npm run test:unit
```

---

### 2. Integration Testing (Supertest)

* Tests API endpoints with database

```bash id="test2"
npm run test:int
```

---

### 3. Performance Testing (Artillery)

* Load testing under concurrent users

```bash id="test3"
npm run test:perf
```

✔ Handles ~50 concurrent users
✔ Expected latency < 200ms


## 🚀 Deployment

### Backend Hosting

* Platform: Render / Railway

### Steps

1. Push to GitHub
2. Connect repository
3. Configure environment variables
4. Deploy

### Live API

```id="live"
<your-backend-url>
```

---


## 👥 Contribution

* Team-based modular development
* Each member handled a component
* Proper Git workflow maintained
