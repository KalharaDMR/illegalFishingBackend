🌊 Illegal fishing reporting - Backend API Documentation
A comprehensive backend system for monitoring and managing illegal fishing activities, investigations, endangered species, and marine protection with real-time SMS alerts.

📋 Table of Contents
Project Overview

Tech Stack

Prerequisites

Setup Instructions

Environment Variables

Folder Structure

API Documentation

Authentication APIs

User Management APIs (Admin)

Report Management APIs

Investigation APIs

Endangered Species APIs

Restricted Zone APIs

Error Handling

Testing

Deployment

🎯 Project Overview
This backend system serves as a complete marine protection platform with the following features:

Feature	Description
User Authentication	Role-based access control with JWT
User Roles	ADMIN, AUTHORIZED_PERSON, PUBLIC_USER, ZOOLOGIST
Report Management	Submit and track illegal fishing reports
Investigation Management	Complete CRUD operations with evidence upload
SMS Notifications	Real-time alerts via Twilio
Email Notifications	SendGrid integration for email alerts
Endangered Species	Track and monitor endangered marine species
Restricted Zones	Manage protected marine areas
File Upload	Support for images and videos via Multer
PDF Generation	Generate investigation reports
🛠️ Tech Stack
Technology	Purpose
Node.js	Runtime environment
Express.js	Web framework
MongoDB + Mongoose	Database and ODM
JWT	Authentication
bcryptjs	Password hashing
Twilio	SMS notifications
SendGrid	Email notifications
Multer	File upload handling
Cloudinary	Image storage
pdfkit	PDF report generation
📋 Prerequisites
Before you begin, ensure you have the following installed:

Node.js (v14 or higher) - Download

MongoDB (local or Atlas) - Download

Git - Download

Postman (for API testing) - Download

You'll also need accounts for:

Twilio (for SMS) - Sign up

SendGrid (for email) - Sign up

Cloudinary (for images) - Sign up

Gemini API Key

🔧 Setup Instructions
Step 1: Clone the Repository
bash
git clone <https://github.com/KalharaDMR/illegalFishingBackend>
cd illegalFishingBackend
Step 2: Install Dependencies
bash
npm install
This will install all required packages including:

express, mongoose, dotenv

jsonwebtoken, bcryptjs

twilio, @sendgrid/mail

multer, cloudinary

pdfkit, nodemon

Step 3: Create Directory Structure
bash
# Create upload directories for files
mkdir -p src/uploads/investigations/images
mkdir -p src/uploads/investigations/videos
mkdir -p src/uploads/reports
mkdir -p src/uploads/species
Step 4: Configure Environment Variables
Create a .env file in the root directory:

env
# ====================
# SERVER CONFIGURATION
# ====================
PORT=5000
NODE_ENV=development

# ====================
# DATABASE
# ====================
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/marine_protection

# OR for MongoDB Atlas (cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/marine_protection

# ====================
# JWT AUTHENTICATION
# ====================
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production

# ====================
# TWILIO SMS (REAL-TIME ALERTS)
# ====================
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Admin phone numbers for SMS alerts (Sri Lanka format)
ADMIN_PHONE_NUMBERS=+947XXXXXXXX,+947YYYYYYYY
ADMIN_PHONE_NUMBER=+947XXXXXXXX

# ====================
# SENDGRID EMAIL
# ====================
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@marineprotection.com

# ====================
# CLOUDINARY (IMAGE STORAGE)
# ====================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

Gemini API KEY =

Step 5: Start MongoDB
Local MongoDB:

bash
# On Windows (if installed as service, it runs automatically)
# Otherwise, start manually:
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath="C:\data\db"

# On Mac/Linux
sudo systemctl start mongod
# OR
mongod
MongoDB Atlas (Cloud):

Just ensure your connection string in .env is correct

Step 6: Run the Server
bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
You should see:

text
Server running on port 5000
MongoDB Connected
✅ Twilio SMS service initialized
📱 From number: +12282208999
📱 Notification service initialized with 1 admin numbers
Step 7: Verify Installation
Access the Swagger documentation:

text
http://localhost:5000/api/docs
Or test with a simple curl command:

bash
curl http://localhost:5000/api/docs
📁 Folder Structure
text
illegalFishingBackend/
├── src/
│   ├── config/                 # Configuration files
│   │   ├── db.js               # Database connection
│   │   ├── cloudinary.js       # Cloudinary config
│   │   └── swagger.js          # Swagger documentation
│   │
│   ├── models/                  # Database models
│   │   ├── user.js              # User schema
│   │   ├── IllegalReport.js     # Report schema
│   │   ├── Investigation.js     # Investigation schema
│   │   ├── Species.model.js     # Endangered species schema
│   │   └── restricted.zone.js   # Restricted zone schema
│   │
│   ├── controllers/             # Business logic
│   │   ├── auth.controller.js   # Authentication
│   │   ├── admin.controller.js  # Admin operations
│   │   ├── report.controller.js # Report management
│   │   ├── investigation.controller.js # Investigation CRUD
│   │   ├── Zoologist.controller.js # Species management
│   │   └── Restrictedzone.controller.js # Zone management
│   │
│   ├── routes/                  # API routes
│   │   ├── auth.routes.js
│   │   ├── admin.routes.js
│   │   ├── report.routes.js
│   │   ├── investigation.routes.js
│   │   ├── Zoologist.routes.js
│   │   └── restrictedzone.routes.js
│   │
│   ├── services/                 # External services
│   │   ├── twilio.service.js     # SMS service
│   │   ├── notification.service.js # Notification logic
│   │   ├── email.service.js      # SendGrid email
│   │   └── pdf.service.js        # PDF generation
│   │
│   ├── middleware/                # Custom middleware
│   │   ├── auth.middleware.js     # JWT verification
│   │   └── role.middleware.js     # Role-based access
│   │
│   ├── utils/                     # Utility functions
│   │   ├── jwt.js                 # Token generation
│   │   └── geoUtils.js            # Distance calculations
│   │
│   ├── uploads/                    # Uploaded files
│   │   ├── investigations/
│   │   │   ├── images/
│   │   │   └── videos/
│   │   └── reports/
│   │
│   ├── app.js                      # Express app setup
│   └── server.js                    # Server entry point
│
├── .env                             # Environment variables
├── package.json                      # Dependencies
└── README.md                         # Documentation
🔐 Authentication & Authorization
User Roles
Role	Description	Permissions
ADMIN	System administrator	Full access to all endpoints
AUTHORIZED_PERSON	District officer	Manage investigations in assigned district
PUBLIC_USER	General public	Submit and track reports
ZOOLOGIST	Marine biologist	Manage endangered species
Authentication Flow
User signs up → Account created with status (PENDING/APPROVED)

Admin approves pending accounts

User logs in → Receives JWT token

Include token in subsequent requests:

text
Authorization: Bearer <your_jwt_token>
