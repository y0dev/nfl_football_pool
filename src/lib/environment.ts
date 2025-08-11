/**
 * Environment detection utilities
 * Helps determine if the app is running in production, development, or Vercel
 */

export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isVercel = process.env.VERCEL === '1';

/**
 * Get the current environment name
 */
export function getEnvironment(): 'production' | 'development' | 'test' {
  return (process.env.NODE_ENV as 'production' | 'development' | 'test') || 'development';
}

/**
 * Check if the app is running in a production-like environment
 */
export function isProductionLike(): boolean {
  return isProduction || isVercel;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  return {
    isProduction,
    isDevelopment,
    isVercel,
    isProductionLike: isProductionLike(),
    environment: getEnvironment(),
    // Add any other environment-specific values here
    apiUrl: isProduction ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:3000',
    debugMode: isDevelopment,
  };
}

/**
 * Log environment information (only in development)
 */
export function logEnvironmentInfo() {
  if (isDevelopment) {
    console.log('🌍 Environment Info:', getEnvironmentConfig());
  }
}

/**
 * Get a configuration value based on environment
 */
export function getConfigValue<T>(
  productionValue: T,
  developmentValue: T,
  testValue?: T
): T {
  switch (getEnvironment()) {
    case 'production':
      return productionValue;
    case 'development':
      return developmentValue;
    case 'test':
      return testValue ?? developmentValue;
    default:
      return developmentValue;
  }
}

/**
 * Environment-specific feature flags
 */
export const featureFlags = {
  // Enable debug logging only in development
  debugLogging: isDevelopment,
  
  // Enable detailed error messages only in development
  detailedErrors: isDevelopment,
  
  // Enable performance monitoring in production
  performanceMonitoring: isProduction,
  
  // Enable analytics in production
  analytics: isProduction,
  
  // Enable hot reload in development
  hotReload: isDevelopment,
} as const;
