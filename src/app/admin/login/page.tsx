'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { loginUser } from '@/actions/loginUser';
import { useAuth } from '@/lib/auth';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { AuthProvider } from '@/lib/auth';

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

function AdminLoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { signIn } = useAuth();

  const form = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: AdminLoginFormData) => {
    setIsLoading(true);
    try {
      const result = await loginUser(data.email, data.password);
      
      if (result.success && result.user) {
        // Set the user in the auth context
        await signIn(result.user);
        
        toast({
          title: 'Success',
          description: 'Admin login successful!',
        });
        // Redirect to admin dashboard
        window.location.href = '/admin/dashboard';
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Admin login error:', error);
      toast({
        title: 'Error',
        description: 'Login failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to main page link */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to main page
          </Link>
        </div>

        {/* Admin Login Card */}
        <Card className="w-full shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
            <CardDescription>
              Sign in to manage your NFL Confidence Pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="admin@example.com" 
                          className="h-12 text-base"
                          autoComplete="email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="Enter your password" 
                            className="h-12 text-base pr-12"
                            autoComplete="current-password"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In as Admin'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your pool administrator
          </p>
        </div>
        
        {/* Additional links */}
        <div className="mt-4 space-y-2">
          <div className="text-center">
            <Link href="/admin/register" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Create Admin Account
            </Link>
          </div>
          <div className="text-center">
            <Link href="/super-admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Super Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <AuthProvider>
      <AdminLoginContent />
    </AuthProvider>
  );
}
