'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, Search, Trophy, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 404 Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Page Not Found</h2>
          <p className="text-gray-600 text-lg">
            Oops! The page you're looking for doesn't exist.
          </p>
        </div>

        {/* Main Content Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-gray-800">
              What happened?
            </CardTitle>
            <CardDescription className="text-gray-600">
              The page you're trying to access might have been moved, deleted, or you entered the wrong URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Common Issues */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Common Issues
              </h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Check if the URL is spelled correctly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>The page might have been moved or deleted</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>You might need to log in to access this page</span>
                </li>
              </ul>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center gap-2">
                  <Home className="h-6 w-6 text-blue-600" />
                  <div className="text-center">
                    <div className="font-semibold">Go Home</div>
                    <div className="text-xs text-gray-500">Return to the main page</div>
                  </div>
                </Button>
              </Link>

              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center gap-2">
                  <Users className="h-6 w-6 text-green-600" />
                  <div className="text-center">
                    <div className="font-semibold">Login</div>
                    <div className="text-xs text-gray-500">Access your account</div>
                  </div>
                </Button>
              </Link>
            </div>

            {/* Pool Management */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Looking for a Pool?
              </h3>
              <p className="text-sm text-green-800 mb-3">
                If you're trying to access a specific NFL Confidence Pool, make sure you have the correct link from the pool administrator.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Browse Pools
                  </Button>
                </Link>
                <Link href="/login" className="flex-1">
                  <Button size="sm" className="w-full">
                    Join Pool
                  </Button>
                </Link>
              </div>
            </div>

            {/* Technical Support */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">
                Still having trouble? Contact the pool administrator or technical support.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <Badge variant="outline" className="text-xs">
                  NFL Football Pool
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Version 1.0
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
