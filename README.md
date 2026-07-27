# ResQ-Rapid-Emergency-Support-Quick-Assistance
ResQ is an AI-powered disaster management and emergency response platform designed to provide real-time assistance before, during, and after natural or human-made disasters.

The platform combines Artificial Intelligence, FastAPI, MongoDB, Geolocation, Weather APIs, and Emergency Services into a single web application that helps users quickly 
access emergency information, shelters, weather updates, AI guidance, and emergency contacts.

---

# Features

## Authentication
- User Registration
- Secure Login
- JWT Authentication
- Password Hashing (bcrypt)

## AI Assistant
- AI-powered emergency chatbot
- Disaster guidance
- Safety recommendations
- Emergency Q&A

## Weather Module
- Live weather information
- Weather alerts
- Disaster risk awareness

## Shelter Finder
- Find nearby shelters
- Shelter details
- Capacity & location support

## Emergency Services
- Police
- Ambulance
- Fire Brigade
- Nearby emergency facilities

## Emergency Guides
- Earthquake
- Flood
- Fire
- Cyclone
- Medical Emergency
- First Aid

## Dashboard
- Personalized dashboard
- Emergency statistics
- Alerts

## Notifications
- Emergency notifications
- Alert management

## Image Upload
- Upload disaster images
- AI-ready backend for future image analysis

---

# Tech Stack

## Frontend
- HTML5
- CSS3
- JavaScript

## Backend
- FastAPI
- Python

## Database
- MongoDB Atlas
- Motor
- PyMongo

## Authentication
- JWT
- Passlib
- bcrypt

## AI
- Groq API (LLM)

## APIs
- Weather API
- Geolocation Services


---

# Project Structure

```
resq/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── index.html
├── login.html
├── dashboard.html
├── weather.html
├── shelter-finder.html
├── emergency-guide.html
├── emergency-services.html
├── upload-image.html
└── profile.html
```

---

# Backend API Modules

- Authentication
- Users
- Chatbot
- Weather
- Shelters
- Emergency Services
- Emergency Contacts
- Dashboard
- Alerts
- Notifications
- Uploads
- Guides

---

# Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/ResQ.git
cd ResQ
```

## Backend Setup

```bash
cd backend

python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux/Mac

```bash
source venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Create `.env`

```
MONGODB_URI=your_mongodb_uri
DATABASE_NAME=resq
JWT_SECRET_KEY=your_secret
GROQ_API_KEY=your_groq_key
```

Run server

```bash
uvicorn app.main:app --reload
```

API Documentation

```
http://127.0.0.1:8000/docs
```

---

# Security

- JWT Authentication
- Password Hashing
- Protected Routes
- Environment Variables
- Input Validation
- Error Handling

---

# Future Enhancements

- AI Image Disaster Detection
- SOS Live Location Sharing
- Offline Emergency Mode
- Voice Assistant
- Push Notifications
- Multi-language Support
- Disaster Prediction
- Volunteer Coordination

---

## Contributors

Developed as an academic disaster management project using FastAPI, MongoDB, and AI technologies.

- **Frontend & UI Design:** @Reeya0409
- **Backend (JWT Authentication & MongoDB Atlas):** @Jahnvi-ux
- **API Integration & AWS Deployment:** @Parul-kumari089

---
