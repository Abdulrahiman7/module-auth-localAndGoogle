# module-auth-localAndGoogle

A reusable authentication module that provides both local (username/password) and Google OAuth 2.0 authentication strategies.

## Features

- Local authentication with email/username and password
- Google OAuth 2.0 authentication
- Session management
- Password hashing and security
- JWT token support
- Protected route middleware

## Installation

```bash
npm install module-auth-localAndGoogle
```

## Configuration

Create a `.env` file in your project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=mongodb://localhost:27017/your_database

# Session Secret
SESSION_SECRET=your_session_secret_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Authentication Routes

### Local Authentication

#### Register a New User
- **Endpoint:** `POST /auth/register`
- **Description:** Create a new user account with email and password
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "jwt_token_here"
  }
  ```

#### Login with Local Credentials
- **Endpoint:** `POST /auth/login`
- **Description:** Authenticate user with email and password
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Login successful",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "jwt_token_here"
  }
  ```

#### Logout
- **Endpoint:** `POST /auth/logout`
- **Description:** Log out the current user and invalidate session
- **Headers:** `Authorization: Bearer jwt_token_here`
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Logout successful"
  }
  ```

### Google OAuth Authentication

#### Initiate Google OAuth Flow
- **Endpoint:** `GET /auth/google`
- **Description:** Redirect user to Google's OAuth consent screen
- **Usage:** Redirect user to this endpoint from your frontend
- **Example:**
  ```html
  <a href="http://localhost:3000/auth/google">Login with Google</a>
  ```

#### Google OAuth Callback
- **Endpoint:** `GET /auth/google/callback`
- **Description:** Handle callback from Google after user authentication
- **Query Parameters:** 
  - `code`: Authorization code from Google (handled automatically)
- **Response:** Redirects to frontend with token
  - Success: `{FRONTEND_URL}?token={jwt_token}`
  - Failure: `{FRONTEND_URL}/login?error=authentication_failed`

### User Management Routes

#### Get Current User
- **Endpoint:** `GET /auth/me`
- **Description:** Get the currently authenticated user's information
- **Headers:** `Authorization: Bearer jwt_token_here`
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "provider": "local",
      "createdAt": "2025-10-17T12:00:00.000Z"
    }
  }
  ```

#### Update User Profile
- **Endpoint:** `PUT /auth/profile`
- **Description:** Update current user's profile information
- **Headers:** `Authorization: Bearer jwt_token_here`
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "bio": "Software Developer"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "Jane Doe",
      "bio": "Software Developer"
    }
  }
  ```

#### Change Password
- **Endpoint:** `PUT /auth/change-password`
- **Description:** Change user's password (local auth only)
- **Headers:** `Authorization: Bearer jwt_token_here`
- **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword456!"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```

#### Request Password Reset
- **Endpoint:** `POST /auth/forgot-password`
- **Description:** Request a password reset email
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Password reset email sent"
  }
  ```

#### Reset Password
- **Endpoint:** `POST /auth/reset-password`
- **Description:** Reset password using token from email
- **Request Body:**
  ```json
  {
    "token": "reset_token_from_email",
    "newPassword": "NewSecurePassword789!"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Password reset successfully"
  }
  ```

## Usage Example

### Express.js Integration

```javascript
const express = require('express');
const authModule = require('module-auth-localAndGoogle');

const app = express();

// Initialize authentication module
app.use(express.json());
app.use(authModule.initialize({
  database: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL
}));

// Use authentication routes
app.use('/auth', authModule.routes);

// Protect routes with authentication middleware
app.get('/api/protected', authModule.authenticate, (req, res) => {
  res.json({ 
    message: 'This is a protected route',
    user: req.user 
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Frontend Integration Example (React)

```javascript
import axios from 'axios';

// Login with local credentials
const loginLocal = async (email, password) => {
  try {
    const response = await axios.post('http://localhost:3000/auth/login', {
      email,
      password
    });
    
    // Store token
    localStorage.setItem('token', response.data.token);
    return response.data;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

// Login with Google
const loginGoogle = () => {
  window.location.href = 'http://localhost:3000/auth/google';
};

// Make authenticated requests
const fetchProtectedData = async () => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.get('http://localhost:3000/api/protected', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};
```

## Middleware

### Authentication Middleware

The module provides middleware to protect routes:

```javascript
const { authenticate } = require('module-auth-localAndGoogle');

// Protect a single route
app.get('/api/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Protect multiple routes
app.use('/api', authenticate);
```

### Optional Authentication Middleware

For routes where authentication is optional:

```javascript
const { optionalAuth } = require('module-auth-localAndGoogle');

app.get('/api/public', optionalAuth, (req, res) => {
  if (req.user) {
    res.json({ message: 'Authenticated user', user: req.user });
  } else {
    res.json({ message: 'Anonymous user' });
  }
});
```

## Error Handling

All authentication endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Error Codes

- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Invalid credentials or token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - User or resource not found
- `409 Conflict` - User already exists (during registration)
- `500 Internal Server Error` - Server-side error

## Security Features

- **Password Hashing:** Uses bcrypt for secure password hashing
- **JWT Tokens:** Stateless authentication with configurable expiration
- **CSRF Protection:** Built-in CSRF token validation
- **Rate Limiting:** Prevents brute-force attacks on authentication endpoints
- **Input Validation:** Validates and sanitizes all user inputs
- **Secure Session Management:** HTTPOnly cookies with secure flags

## Password Requirements

By default, passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/Abdulrahiman7/module-auth-localAndGoogle).

## Changelog

### Version 1.0.0
- Initial release
- Local authentication support
- Google OAuth 2.0 support
- JWT token authentication
- Session management
- Password reset functionality
