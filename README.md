# HandyText

HandyText is a high-performance OCR backend built with FastAPI that converts handwritten images into digital text using EasyOCR and Pytesseract.

## Features

- **FastAPI** - High-performance REST API
- **EasyOCR** (Primary) and **Pytesseract** (Fallback) - For robust OCR processing
- **Image Preprocessing** - Using OpenCV and Pillow for better accuracy
- **Export Options** - TXT, DOCX, and PDF formats
- **JWT Authentication** - Secure user history management
- **MongoDB** - Beanie ODM (async) for data persistence
- **Cloudinary Integration** - For image storage and profile pictures
- **Google Gemini AI** - Text improvement and OCR correction suggestions
- **Google OAuth** - Sign in with Google
- **OTP Password Reset** - Forgot password flow with email OTP

## Tech Stack

### Backend
- Python 3.10+
- FastAPI
- MongoDB (Motor + Beanie ODM)
- EasyOCR / Pytesseract
- Google Gemini AI

### Frontend
- React
- Vite
- Tailwind CSS
- React Router

## Prerequisites

- Python 3.10+
- MongoDB (local or Atlas)
- Tesseract-OCR (for Windows: [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki))

## Installation

### Backend Setup

```bash
cd Backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Configuration

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - MongoDB connection string
- `SECRET_KEY` - JWT secret key
- `TESSERACT_CMD` - Path to Tesseract executable
- Cloudinary credentials for image uploads
- Gemini API key for AI suggestions

### Run the Backend

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd Frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /auth/register` - Create new account
- `POST /auth/login` - User login
- `POST /auth/google-login` - Google OAuth login
- `GET /auth/me` - Get current user info
- `PUT /auth/me` - Update user profile
- `POST /auth/profile-image` - Upload profile picture
- `POST /auth/forgot-password` - Send OTP to email
- `POST /auth/reset-password` - Reset password with OTP

### Upload & OCR
- `POST /upload/convert` - Upload image for OCR
- `GET /upload/history` - Get last 20 conversions
- `GET /upload/conversion/{id}` - Get conversion details
- `PATCH /upload/conversion/{id}` - Rename conversion
- `DELETE /upload/conversion/{id}` - Delete conversion

### Export
- `GET /export/{id}/txt` - Download as TXT
- `GET /export/{id}/docx` - Download as DOCX
- `GET /export/{id}/pdf` - Download as PDF

### AI
- `POST /ai/suggest/{id}` - Get AI text improvement suggestions
- `POST /ai/correct/{id}` - Get structured OCR correction suggestions

### Feedback
- `POST /feedback/` - Submit feedback
- `GET /feedback/` - Get all feedback

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection URL |
| `SECRET_KEY` | JWT signing secret |
| `ALGORITHM` | JWT algorithm (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration time |
| `UPLOAD_DIR` | Local upload directory |
| `MAX_FILE_SIZE_MB` | Maximum upload file size |
| `TESSERACT_CMD` | Path to Tesseract executable |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SMTP_HOST` | SMTP server host (e.g. smtp.gmail.com) |
| `SMTP_PORT` | SMTP server port (default: 587) |
| `SMTP_EMAIL` | Sender email address |
| `SMTP_PASSWORD` | Sender email password / app password |

## License

MIT License