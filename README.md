# HandyText

HandyText is a high-performance OCR application (FastAPI backend + React frontend) that converts handwritten images into editable digital text using EasyOCR and Pytesseract, with optional AI vision and text assistance from multiple providers (Gemini, OpenAI, Anthropic, OpenRouter).

## Features

- **FastAPI** - High-performance REST API
- **EasyOCR** (Primary) and **Pytesseract** (Fallback) - For robust OCR processing
- **Image Preprocessing** - Using OpenCV and Pillow for better accuracy
- **Export Options** - TXT, DOCX, and PDF formats
- **JWT Authentication** - Secure user history management
- **MongoDB** - Beanie ODM (async) for data persistence
- **Cloudinary Integration** - For image storage and profile pictures
- **Multi-provider AI** - Pick one model for both vision OCR and text suggestions: Google Gemini, OpenAI (GPT-4o), Anthropic (Claude), or OpenRouter. Configurable from Settings → AI Models.
- **Google OAuth** - Sign in with Google
- **OTP Password Reset** - Forgot password flow with email OTP

## Tech Stack

### Backend
- Python 3.10+
- FastAPI
- MongoDB (Motor + Beanie ODM)
- EasyOCR / Pytesseract
- Multi-provider AI: Google Gemini, OpenAI, Anthropic (Claude), OpenRouter

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
- (Optional) An AI provider key — see [Configuring AI Models](#configuring-ai-models) below

> **Note for MongoDB Atlas:** add your machine's public IP under
> *Atlas → Network Access → IP Access List* (or `0.0.0.0/0` for testing). A
> connection that fails with `SSL: TLSV1_ALERT_INTERNAL_ERROR` almost always
> means the current IP is not allowlisted.

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

### Settings (AI Models)
- `GET /settings/ai` - Selected model, model catalog, and per-provider key status
- `POST /settings/ai/model` - Set the active model
- `POST /settings/ai/key` - Save an API key for a provider
- `DELETE /settings/ai/key/{provider}` - Remove a provider's API key

### Feedback
- `POST /feedback/` - Submit feedback
- `GET /feedback/` - Get all feedback

## Configuring AI Models

The same model is used for both **vision OCR** (reading handwriting from images)
and **AI text suggestions** (proofread / grammar / improve). Choose it in the app
under **Settings → AI Models**, then paste the API key for that provider.

| Provider | Example models | Get a key |
|----------|----------------|-----------|
| Google Gemini | `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro` | https://aistudio.google.com/apikey |
| OpenAI | `gpt-4o`, `gpt-4o-mini` | https://platform.openai.com/api-keys |
| Anthropic (Claude) | `claude-sonnet-4-5`, `claude-3-5-haiku-latest` | https://console.anthropic.com/settings/keys |
| OpenRouter | `openai/gpt-4o`, `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-flash` | https://openrouter.ai/keys |

Keys are stored server-side in `Backend/AI/ai_config.json` (gitignored) and never
leave the server. If the selected model's provider has no key, the app falls back
to any provider that does (preferring Gemini). All AI features are optional —
local EasyOCR/Tesseract OCR works without any key.

The default `GEMINI_API_KEY` in `.env` still works and is treated as the Gemini key.

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
| `GEMINI_API_KEY` | Google Gemini API key (optional; also settable in Settings → AI Models) |
| `OPENAI_API_KEY` | OpenAI API key (optional fallback; usually set in Settings) |
| `ANTHROPIC_API_KEY` | Anthropic/Claude API key (optional fallback; usually set in Settings) |
| `OPENROUTER_API_KEY` | OpenRouter API key (optional fallback; usually set in Settings) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SMTP_HOST` | SMTP server host (e.g. smtp.gmail.com) |
| `SMTP_PORT` | SMTP server port (default: 587) |
| `SMTP_EMAIL` | Sender email address |
| `SMTP_PASSWORD` | Sender email password / app password |

## License

MIT License