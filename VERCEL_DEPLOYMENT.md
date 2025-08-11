# Vercel Deployment Guide

This guide will help you deploy the NFL Confidence Pool app to Vercel with proper production environment configuration.

## 🚀 Quick Deploy

1. **Push to GitHub**: Ensure your code is pushed to a GitHub repository
2. **Connect to Vercel**: Go to [vercel.com](https://vercel.com) and import your repository
3. **Configure Environment**: Set the required environment variables
4. **Deploy**: Vercel will automatically build and deploy your app

## ⚙️ Environment Variables

Set these environment variables in your Vercel dashboard:

### Required Variables
```bash
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
```

### Optional Variables
```bash
NEXT_PUBLIC_API_SPORTS_KEY=your_api_sports_key
NEXT_PUBLIC_IS_PRODUCTION=true
NEXT_PUBLIC_IS_VERCEL=true
```

## 🔧 Build Configuration

### Build Command
```bash
npm run vercel-build
```

### Output Directory
```
.next
```

### Install Command
```bash
npm install
```

## 📁 Project Structure

```
nfl_confidence_pool/
├── src/
│   ├── app/                 # Next.js 15 app router
│   ├── components/          # React components
│   ├── lib/                 # Utility functions
│   └── actions/             # Server actions
├── supabase/                # Supabase Edge Functions
├── vercel.json             # Vercel configuration
├── next.config.ts          # Next.js configuration
└── package.json            # Dependencies and scripts
```

## 🚨 Common Issues & Solutions

### 1. Build Errors
- **Issue**: TypeScript compilation errors
- **Solution**: Run `npm run type-check` locally before deploying

### 2. Environment Variables
- **Issue**: App thinks it's in development mode
- **Solution**: Ensure `NODE_ENV=production` is set in Vercel

### 3. Supabase Connection
- **Issue**: Database connection failures
- **Solution**: Verify Supabase environment variables are correct

### 4. API Routes
- **Issue**: 500 errors on API endpoints
- **Solution**: Check server-side environment variables

## 🔍 Pre-Deployment Checklist

- [ ] All TypeScript errors are resolved
- [ ] Environment variables are configured in Vercel
- [ ] Supabase project is in production mode
- [ ] Database tables are created
- [ ] Edge functions are deployed
- [ ] Local build succeeds (`npm run build:prod`)

## 🧪 Testing Production Build

### Local Production Build
```bash
npm run build:prod
npm run start:prod
```

### Environment Check
```bash
# Should show "production"
echo $NODE_ENV

# Should show "true"
echo $NEXT_PUBLIC_IS_PRODUCTION
```

## 📊 Performance Optimizations

The app includes several production optimizations:

- **SWC Minification**: Faster builds and smaller bundles
- **Image Optimization**: WebP and AVIF support
- **Security Headers**: XSS protection and content type validation
- **Standalone Output**: Optimized for serverless deployment
- **Compression**: Gzip compression for static assets

## 🔐 Security Features

- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: XSS protection headers
- **Referrer Policy**: Controls referrer information

## 📱 Mobile Optimization

- **Responsive Design**: Mobile-first approach
- **Device Rotation**: Prompts for optimal viewing
- **Touch-Friendly**: Optimized for mobile interaction
- **Performance**: Optimized for mobile networks

## 🚀 Deployment Commands

### Manual Deployment
```bash
# Build for production
npm run build:prod

# Start production server
npm run start:prod

# Deploy to Vercel (if using Vercel CLI)
vercel --prod
```

### Automatic Deployment
- **GitHub Integration**: Automatic deployment on push to main branch
- **Preview Deployments**: Automatic preview deployments on pull requests
- **Environment Variables**: Automatically available in all deployments

## 📈 Monitoring & Analytics

### Vercel Analytics
- **Performance Metrics**: Core Web Vitals tracking
- **Error Monitoring**: Automatic error tracking
- **Real User Monitoring**: User experience metrics

### Custom Monitoring
- **Supabase Dashboard**: Database performance and usage
- **Edge Function Logs**: Function execution monitoring
- **API Response Times**: Endpoint performance tracking

## 🔄 Updates & Maintenance

### Regular Updates
1. **Dependencies**: Keep npm packages updated
2. **Security**: Monitor for security vulnerabilities
3. **Performance**: Monitor Core Web Vitals
4. **Database**: Regular backup and optimization

### Rollback Strategy
- **Vercel Rollback**: Quick rollback to previous deployment
- **Database Backup**: Regular Supabase backups
- **Feature Flags**: Gradual feature rollouts

## 📞 Support

### Vercel Support
- **Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

### App Support
- **Issues**: GitHub repository issues
- **Documentation**: README.md and component documentation
- **Development**: Local development setup guide

---

**Happy Deploying! 🎉**

Your NFL Confidence Pool app is now ready for production deployment on Vercel with proper environment configuration and optimizations.
