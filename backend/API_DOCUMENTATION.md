# 📚 Note.Lab API Documentation

## Overview

The Note.Lab API is a RESTful service built on Cloudflare Workers with the following features:

- **Authentication**: JWT-based authentication with session management
- **Notes Management**: Full CRUD operations with search and categorization
- **Categories**: Custom note categorization system
- **Rate Limiting**: Built-in rate limiting for API protection
- **Activity Logging**: Comprehensive activity tracking
- **Security**: Input validation, sanitization, and secure password hashing

## Base URL

```
https://your-worker-domain.workers.dev/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP address
- **Headers**: 
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "jwt-token",
    "sessionId": "session-uuid",
    "expiresAt": "2025-01-08T00:00:00.000Z"
  }
}
```

#### POST /auth/login
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "jwt-token",
    "sessionId": "session-uuid",
    "expiresAt": "2025-01-08T00:00:00.000Z"
  }
}
```

#### POST /auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "If an account with this email exists, a reset link has been sent."
  }
}
```

#### POST /auth/reset-password
Reset password using token.

**Request Body:**
```json
{
  "token": "reset-token",
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

#### GET /user/profile
Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLoginAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /user/profile
Update user profile.

**Request Body:**
```json
{
  "name": "John Smith"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully"
  }
}
```

### Notes Management

#### GET /notes
Get user's notes with filtering and pagination.

**Query Parameters:**
- `limit` (optional): Number of notes per page (default: 50, max: 100)
- `offset` (optional): Number of notes to skip (default: 0)
- `search` (optional): Search in title and content
- `starred` (optional): Filter by starred status (true/false)
- `tags` (optional): Comma-separated list of tags
- `type` (optional): Filter by note type (standard, plan, code, credentials)
- `category` (optional): Filter by category ID
- `sort` (optional): Sort field (created_at, updated_at, title, starred)
- `order` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "uuid",
        "title": "Note Title",
        "content": "Note content...",
        "type": "standard",
        "starred": false,
        "tags": ["tag1", "tag2"],
        "metadata": {},
        "categoryNames": ["Category 1"],
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z",
        "preview": "Note content preview..."
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 100,
      "hasMore": true
    }
  }
}
```

#### POST /notes
Create a new note.

**Request Body:**
```json
{
  "title": "Note Title",
  "content": "Note content...",
  "type": "standard",
  "starred": false,
  "tags": ["tag1", "tag2"],
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "note": {
      "id": "uuid",
      "title": "Note Title",
      "content": "Note content...",
      "type": "standard",
      "starred": false,
      "tags": ["tag1", "tag2"],
      "metadata": {},
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /notes/:id
Get a specific note.

**Response:**
```json
{
  "success": true,
  "data": {
    "note": {
      "id": "uuid",
      "title": "Note Title",
      "content": "Note content...",
      "type": "standard",
      "starred": false,
      "tags": ["tag1", "tag2"],
      "metadata": {},
      "categoryNames": ["Category 1"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /notes/:id
Update a note.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "starred": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "note": {
      "id": "uuid",
      "title": "Updated Title",
      "content": "Updated content...",
      "type": "standard",
      "starred": true,
      "tags": ["tag1", "tag2"],
      "metadata": {},
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### DELETE /notes/:id
Delete a note (soft delete).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Note deleted successfully"
  }
}
```

#### GET /notes/search
Search notes using full-text search.

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results (default: 20, max: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "title": "Note Title",
        "content": "Note content...",
        "type": "standard",
        "starred": false,
        "tags": ["tag1", "tag2"],
        "metadata": {},
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z",
        "preview": "Note content preview...",
        "rank": 0.5
      }
    ],
    "query": "search term",
    "total": 1
  }
}
```

#### POST /notes/bulk-update
Update multiple notes at once.

**Request Body:**
```json
{
  "noteIds": ["uuid1", "uuid2"],
  "updates": {
    "starred": true,
    "tags": ["new-tag"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Updated 2 notes successfully",
    "affectedCount": 2
  }
}
```

#### GET /notes/stats
Get note statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalNotes": 100,
      "starredNotes": 10,
      "planNotes": 20,
      "codeNotes": 30,
      "credentialNotes": 5,
      "standardNotes": 45,
      "totalCharacters": 50000,
      "lastUpdated": "2025-01-01T00:00:00.000Z"
    },
    "topTags": [
      { "tag": "important", "count": 15 },
      { "tag": "work", "count": 12 }
    ]
  }
}
```

### Categories Management

#### GET /categories
Get user's categories.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Category Name",
        "color": "#238636",
        "icon": "📄",
        "sortOrder": 0,
        "noteCount": 5,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### POST /categories
Create a new category.

**Request Body:**
```json
{
  "name": "Category Name",
  "color": "#238636",
  "icon": "📄",
  "sortOrder": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "id": "uuid",
      "name": "Category Name",
      "color": "#238636",
      "icon": "📄",
      "sortOrder": 0,
      "noteCount": 0,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /categories/:id
Update a category.

**Request Body:**
```json
{
  "name": "Updated Category Name",
  "color": "#2f81f7"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "id": "uuid",
      "name": "Updated Category Name",
      "color": "#2f81f7",
      "icon": "📄",
      "sortOrder": 0,
      "noteCount": 5,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### DELETE /categories/:id
Delete a category (only if no notes are assigned).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Category deleted successfully"
  }
}
```

#### POST /categories/assign
Assign categories to a note.

**Request Body:**
```json
{
  "noteId": "note-uuid",
  "categoryIds": ["category-uuid1", "category-uuid2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Categories assigned successfully"
  }
}
```

#### GET /notes/:noteId/categories
Get categories assigned to a specific note.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Category Name",
        "color": "#238636",
        "icon": "📄",
        "sortOrder": 0
      }
    ]
  }
}
```

### System

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_TITLE` | Note title is required |
| `INVALID_USER_ID` | Invalid user ID format |
| `INVALID_NOTE_ID` | Invalid note ID format |
| `INVALID_CATEGORY_ID` | Invalid category ID format |
| `NOTE_NOT_FOUND` | Note not found |
| `CATEGORY_NOT_FOUND` | Category not found |
| `DUPLICATE_NAME` | Category name already exists |
| `CATEGORY_HAS_NOTES` | Cannot delete category with assigned notes |
| `INVALID_PASSWORD` | Password doesn't meet requirements |
| `INVALID_CREDENTIALS` | Email or password is incorrect |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `MISSING_QUERY` | Search query is required |
| `NO_UPDATES` | No updates provided |
| `NO_VALID_UPDATES` | No valid updates provided |
| `MISSING_NOTE_IDS` | Note IDs are required |
| `MISSING_UPDATES` | Updates are required |
| `MISSING_NAME` | Category name is required |
| `INVALID_SORT_FIELD` | Invalid sort field |
| `INVALID_SORT_ORDER` | Invalid sort order |

## Data Types

### Note Types
- `standard`: General notes
- `plan`: Planning and task notes
- `code`: Code snippets and technical notes
- `credentials`: Secure credential storage

### Note Object
```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "type": "note-type",
  "starred": "boolean",
  "tags": ["string"],
  "metadata": "object",
  "categoryNames": ["string"],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "preview": "string"
}
```

### Category Object
```json
{
  "id": "uuid",
  "name": "string",
  "color": "hex-color",
  "icon": "string",
  "sortOrder": "number",
  "noteCount": "number",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### User Object
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "createdAt": "ISO-8601",
  "lastLoginAt": "ISO-8601"
}
```

## Security Considerations

1. **Password Requirements**: Minimum 8 characters with at least one letter and one number
2. **Input Validation**: All inputs are validated and sanitized
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **JWT Tokens**: 7-day expiration with secure signing
5. **Session Management**: Secure session tracking with automatic cleanup
6. **Activity Logging**: All user actions are logged for security monitoring

## Development Notes

- All timestamps are in ISO-8601 format
- UUIDs are used for all IDs
- Soft deletes are used for notes (deleted_at field)
- Full-text search is available for notes
- Categories support multiple assignments per note
- Activity logging is non-blocking (errors don't affect main functionality)
