# NFL Confidence Pool

A modern, mobile-first NFL confidence pool application built with Next.js 15, Supabase, and TailwindCSS.

## 🚀 Features

- **User Management**: Admin can add/remove participants from pools
- **Weekly Picks**: Participants submit confidence-based picks for NFL games
- **Screenshot Feature**: Generate shareable images of weekly submissions
- **Color-Coded Results**: Visual indicators for wins, losses, and pending games
- **Mobile-First Design**: Responsive design with device rotation prompts
- **Tie-Breaker System**: Multiple methods to resolve scoring ties
- **Automated Updates**: Supabase cron jobs for game results and standings
- **Real-time Scoring**: Live updates and automatic calculations

## 🛠️ Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: TailwindCSS 4, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Database**: PostgreSQL with real-time subscriptions
- **Deployment**: Vercel with production optimizations
- **Build Tools**: SWC, Turbopack for development

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project
- Vercel account (for deployment)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd nfl_confidence_pool
npm install
```

### 2. Environment Setup

Copy the environment template and fill in your values:

```bash
cp env.example .env.local
```

Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Setup

```bash
npm run setup-db
```

### 4. Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🚀 Production Deployment

### Vercel Deployment

1. **Push to GitHub**: Ensure your code is in a GitHub repository
2. **Connect to Vercel**: Import your repository at [vercel.com](https://vercel.com)
3. **Set Environment Variables**: Configure all required environment variables
4. **Deploy**: Vercel will automatically build and deploy

### Environment Variables for Production

Set these in your Vercel dashboard:

```bash
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
```

### Build Commands

```bash
# Production build
npm run build:prod

# Production start
npm run start:prod

# Vercel build (used by Vercel)
npm run vercel-build
```

## 📱 Mobile Features

- **Responsive Design**: Mobile-first approach with TailwindCSS
- **Device Rotation**: Prompts for optimal viewing on small screens
- **Touch Optimization**: Touch-friendly interactions and gestures
- **Performance**: Optimized for mobile networks and devices

## 🏆 Tie-Breaker System

### Available Methods

1. **Total Points**: Break ties by total points across all weeks
2. **Correct Picks**: Break ties by total correct picks across all weeks
3. **Accuracy**: Break ties by percentage of correct picks
4. **Last Week**: Break ties by performance in the most recent week
5. **Custom Question**: Admin-defined tie-breaker questions

### Admin Configuration

- Access tie-breaker settings in the admin dashboard
- Choose from built-in methods or create custom questions
- Set correct answers for custom tie-breakers
- Real-time preview of how tie-breakers will work

## 🔄 Automated Systems

### Supabase Cron Jobs

- **Game Updates**: Automatically update NFL game results
- **Score Calculation**: Recalculate standings after games
- **Winner Detection**: Identify weekly and quarterly winners

### Edge Functions

- **update-games**: Main function for game updates and scoring
- **Scheduled Execution**: Runs every 4 hours during NFL season
- **Error Handling**: Graceful fallbacks and logging

## 📊 Screenshot Feature

### Usage

1. **Admin Dashboard**: Navigate to Submissions tab
2. **Select Week**: Choose the week to capture
3. **Generate Screenshot**: Click "Take Screenshot" button
4. **Export Options**: 
   - Download as PNG image
   - Copy as text for messaging apps
   - Share directly to group chats

### Features

- **High Quality**: 2x resolution for crisp images
- **Mobile Optimized**: Responsive layout for all screen sizes
- **Color Coding**: Visual indicators for game results
- **Text Export**: Plain text format for easy sharing

## 🎨 UI Components

### shadcn/ui Integration

- **Consistent Design**: Unified component library
- **Accessibility**: WCAG compliant components
- **Customization**: Easy theming and styling
- **Mobile Ready**: Responsive by default

### Custom Components

- **Device Rotation Prompt**: Mobile optimization helper
- **Tie-Breaker Settings**: Admin configuration interface
- **Participant Management**: User administration tools
- **Submissions Screenshot**: Image generation component

## 🔧 Development Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for development
npm run start           # Start development server

# Production
npm run build:prod      # Build for production
npm run start:prod      # Start production server
npm run vercel-build    # Build for Vercel

# Utilities
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint errors
npm run type-check      # TypeScript type checking
npm run clean           # Clean build artifacts

# Database
npm run setup-db        # Setup database tables
npm run seed            # Seed sample data
```

## 📁 Project Structure

```
nfl_confidence_pool/
├── src/
│   ├── app/                    # Next.js 15 app router
│   │   ├── admin/             # Admin dashboard pages
│   │   ├── api/               # API routes
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── admin/            # Admin-specific components
│   │   ├── auth/             # Authentication components
│   │   ├── ui/               # Reusable UI components
│   │   └── ...               # Feature-specific components
│   ├── lib/                  # Utility functions
│   │   ├── supabase.ts       # Database configuration
│   │   ├── tie-breakers.ts   # Tie-breaker logic
│   │   └── environment.ts    # Environment detection
│   └── actions/              # Server actions
├── supabase/                 # Supabase Edge Functions
├── scripts/                  # Database and utility scripts
├── vercel.json              # Vercel configuration
├── next.config.ts           # Next.js configuration
└── package.json             # Dependencies and scripts
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Errors**: Run `npm run type-check` to identify TypeScript issues
2. **Environment Variables**: Ensure all required variables are set
3. **Database Connection**: Verify Supabase credentials and project status
4. **Mobile Issues**: Check device rotation and responsive design

### Development Tips

- Use `npm run dev` for local development
- Check browser console for detailed error messages
- Verify environment variables in `.env.local`
- Test mobile responsiveness with browser dev tools

## 📚 Documentation

- **Vercel Deployment**: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- **API Reference**: Check `src/app/api/` for endpoint documentation
- **Component Library**: See `src/components/ui/` for available components
- **Database Schema**: Review `src/lib/supabase.ts` for table structures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Issues**: Create an issue on GitHub
- **Documentation**: Check the README and deployment guide
- **Development**: Review the code structure and comments

---

**Built with ❤️ using Next.js, Supabase, and TailwindCSS**
