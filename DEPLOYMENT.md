# 🚀 Deployment Guide - Note.Lab

This guide covers deploying Note.Lab to Cloudflare's platform.

## Prerequisites

1. **Cloudflare Account**: Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Wrangler CLI**: Install globally: `npm install -g wrangler`
3. **Node.js**: Version 16 or higher

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
# Create the database
wrangler d1 create note-lab-db

# Copy the database_id from output and update wrangler.toml
```

Update `wrangler.toml` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "note-lab-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Initialize Database Schema

```bash
# Run the schema migration
wrangler d1 execute note-lab-db --file=backend/schema/schema.sql

# Optional: Add sample data
wrangler d1 execute note-lab-db --file=backend/schema/migrations.sql
```

### 5. Create KV Namespace

```bash
# Create KV namespace for sessions
wrangler kv:namespace create "SESSIONS"

# Copy the id and update wrangler.toml
```

Update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "YOUR_KV_ID_HERE"
preview_id = "YOUR_PREVIEW_ID_HERE"
```

### 6. Create R2 Bucket

```bash
# Create R2 bucket for file attachments
wrangler r2 bucket create note-lab-attachments
```

### 7. Set Environment Variables

```bash
# Set JWT secret (generate a secure random string)
wrangler secret put JWT_SECRET

# Set environment
wrangler secret put ENVIRONMENT
# Enter: production
```

### 8. Deploy Backend

```bash
# Deploy the Workers
wrangler deploy
```

### 9. Deploy Frontend

For the frontend, you have several options:

#### Option A: Cloudflare Pages (Recommended)

1. Connect your GitHub repository to Cloudflare Pages
2. Set build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`

#### Option B: Manual Upload

```bash
# Build frontend
npm run build

# Upload to Pages manually or serve from another provider
```

## Configuration

### Environment Variables

Set these in Cloudflare Workers:

```bash
wrangler secret put JWT_SECRET      # Random secure string
wrangler secret put ENVIRONMENT     # "production"
```

### Database Configuration

Your `wrangler.toml` should look like:

```toml
name = "note-lab"
main = "backend/src/index.js"
compatibility_date = "2023-12-01"

[env.production]
name = "note-lab-prod"

[[d1_databases]]
binding = "DB"
database_name = "note-lab-db"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-id"

[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "note-lab-attachments"

[vars]
ENVIRONMENT = "production"
```

## Testing Deployment

1. **API Health Check**:
   ```bash
   curl https://your-worker-domain.workers.dev/api/health
   ```

2. **Database Connection**:
   ```bash
   wrangler d1 execute note-lab-db --command="SELECT COUNT(*) FROM users"
   ```

3. **Frontend Access**:
   Visit your Pages URL or frontend deployment

## Monitoring

### Logs

```bash
# View real-time logs
wrangler tail

# View specific deployment logs
wrangler tail --format=pretty
```

### Analytics

Monitor your deployment in:
- Cloudflare Dashboard → Workers & Pages
- Analytics tab for usage metrics
- Logs tab for error tracking

## Updating

### Backend Updates

```bash
# Deploy new version
wrangler deploy
```

### Database Updates

```bash
# Run migration scripts
wrangler d1 execute note-lab-db --file=backend/schema/new-migration.sql
```

### Frontend Updates

For Cloudflare Pages with GitHub integration, updates deploy automatically on push.

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Verify database ID in `wrangler.toml`
   - Ensure schema has been applied
   - Check D1 binding name matches code

2. **Authentication Failures**:
   - Verify JWT_SECRET is set
   - Check CORS headers
   - Ensure tokens are properly formatted

3. **CORS Issues**:
   - Verify frontend domain is allowed
   - Check OPTIONS handling in workers
   - Update cors.js if needed

### Debug Commands

```bash
# Test database locally
wrangler d1 execute note-lab-db --local --command="SELECT * FROM users LIMIT 5"

# Run worker locally
wrangler dev

# Check environment variables
wrangler secret list
```

## Security Considerations

1. **JWT Secret**: Use a strong, random secret (32+ characters)
2. **CORS**: Restrict to your frontend domain in production
3. **Rate Limiting**: Consider adding rate limiting for production
4. **Input Validation**: Ensure all inputs are validated
5. **HTTPS**: Always use HTTPS in production

## Performance Tips

1. **Caching**: Implement KV caching for frequently accessed data
2. **Database Indexing**: Ensure proper indexes on search columns
3. **Compression**: Enable compression for large responses
4. **CDN**: Use Cloudflare's CDN for static assets

## Backup Strategy

1. **Database Backups**: Regular D1 exports
2. **Configuration**: Version control all configuration
3. **Secrets**: Securely store secret values

```bash
# Export database backup
wrangler d1 export note-lab-db --output=backup.sql
```

## Support

For issues or questions:
- Check Cloudflare documentation
- Review logs in dashboard
- Test locally with `wrangler dev`
