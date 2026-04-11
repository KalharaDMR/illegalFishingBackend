# 🌊 OceanWatch – Illegal Fishing Monitoring & Management System (Backend API)

## 📌 Project Overview

OceanWatch is a secure RESTful backend system developed to monitor and manage illegal fishing activities and marine protection zones. The platform supports real-time reporting, investigations, endangered species tracking, and automated alerting mechanisms.

This system is designed with a scalable and modular architecture, ensuring maintainability and clean separation of responsibilities.

---

## 🎯 Key Features

| Feature          | Description                                      |
| ---------------- | ------------------------------------------------ |
| Authentication   | JWT-based authentication with role-based access  |
| User Roles       | ADMIN, AUTHORIZED_PERSON, PUBLIC_USER, ZOOLOGIST |
| Restricted Zones | Manage protected marine areas                    |
| Reports          | Submit and track illegal fishing reports         |
| Investigations   | Full CRUD with evidence upload                   |
| Species Tracking | Manage endangered marine species                 |
| Notifications    | SMS (Twilio) and Email (SendGrid) alerts         |
| File Upload      | Images and videos via Multer and Cloudinary      |
| PDF Reports      | Generate investigation reports                   |
| AI Advisory      | Gemini API for intelligent insights              |

---

## 🏗️ System Architecture

The backend follows a layered architecture:

```text
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
* **API Documentation**: Swagger
* **Testing**: Jest, Supertest, Artillery

### 🔗 Third-Party Integrations

* Twilio – SMS alerts
* SendGrid – Email notifications
* Cloudinary – Image storage
* Multer – File uploads
* PDFKit – PDF generation
* Gemini API – AI advisory

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
* Input Validation and Sanitization
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

```bash
git clone https://github.com/KalharaDMR/illegalFishingBackend
cd illegalFishingBackend
```

---

### 3. Install Dependencies

```bash
npm install
```

---

### 4. Environment Configuration

Create a `.env` file:

```env
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

```bash
mkdir -p src/uploads/investigations/images
mkdir -p src/uploads/investigations/videos
mkdir -p src/uploads/reports
mkdir -p src/uploads/species
```

---

### 6. Run the Server

```bash
npm start
```

---

## 📁 Project Structure

The project follows a modular and scalable folder structure to ensure maintainability and separation of concerns:

```plaintext
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
│   ├── controllers/                 # Request handling & business logic
│   │   ├── auth.controller.js
│   │   ├── admin.controller.js
│   │   ├── report.controller.js
│   │   ├── investigation.controller.js
│   │   ├── Zoologist.controller.js
│   │   └── Restrictedzone.controller.js
│   │
│   ├── routes/                      # API route definitions
│   │   ├── auth.routes.js
│   │   ├── admin.routes.js
│   │   ├── report.routes.js
│   │   ├── investigation.routes.js
│   │   ├── Zoologist.routes.js
│   │   └── restrictedzone.routes.js
│   │
│   ├── services/                    # External services & integrations
│   │   ├── twilio.service.js
│   │   ├── notification.service.js
│   │   ├── email.service.js
│   │   └── pdf.service.js
│   │
│   ├── middleware/                  # Custom middleware
│   │   ├── auth.middleware.js
│   │   └── role.middleware.js
│   │
│   ├── utils/                       # Utility/helper functions
│   │   ├── jwt.js
│   │   └── geoUtils.js
│   │
│   ├── uploads/                     # Uploaded files storage
│   │   ├── investigations/
│   │   │   ├── images/
│   │   │   └── videos/
│   │   └── reports/
│   │
│   ├── app.js
│   └── server.js
│
├── .env
├── package.json
└── README.md
```

* Clean modular structure
* Separation of concerns
* Scalable design

---

## 📄 API Documentation

API documentation available at:
[Illegal Fishing Backend API Docs](https://ramesh-kalhara-s-team.docs.buildwithfern.com/illegal-fishing-backend/get-all-species)

Includes:

* Endpoint descriptions
* Request/response formats
* Authentication requirements

---

## 🧪 Testing Instruction Report

### 1. Unit Testing (Jest)

```bash
npm run test:unit
```

---

### 2. Integration Testing (Supertest)

```bash
npm run test:int
```

---

### 3. Performance Testing (Artillery)

```bash
npm run test:perf
```

Expected:

* Handles ~50 concurrent users
* Latency < 200ms

---

## 🚀 Deployment

### Backend Hosting

* Platform: Railway

### Steps

1. Push to GitHub
2. Connect repository
3. Configure environment variables
4. Deploy

### Live URL

[Deployed Backend API](https://illegalfishingbackend-production.up.railway.app)

### Screen Shots of successful deployement

![Backend1](https://github.com/user-attachments/assets/2b4f93bb-483d-46c2-8caa-9b2121def5fa)
![Backend 2](https://github.com/user-attachments/assets/00fc2260-9dd5-48c1-a920-78824ffd1f04)
![backend 4](https://github.com/user-attachments/assets/13d4cf4b-356f-4e6d-bd64-c4bd17323e41)
![Backend 3](https://github.com/user-attachments/assets/87644578-26f7-49a4-8cb1-d0ace3018df2)

---

## 👥 Contribution

* Team-based modular development
* Proper Git workflow maintained

---
