'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
});

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signUp, googleSignIn } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      // Call the updated signUp function with minimal data
      await signUp({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        dob: 0, // No DOB required
        tradingExperience: '', // Will be collected in onboarding
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }
  
  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      // Google Sign-In redirect handled in AuthProvider
      await googleSignIn();
      // After redirect, AuthProvider will handle user creation and data collection
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.62-4.88 1.62-4.41 0-7.99-3.59-7.99-7.99s3.58-7.99 7.99-7.99c2.39 0 4.1.93 5.37 2.1l2.4-2.4C18.96 3.24 16.11 2 12.48 2 7.1 2 2.99 6.13 2.99 11.5s4.11 9.5 9.49 9.5c2.99 0 5.48-1.02 7.33-2.86 1.96-1.96 2.58-4.91 2.58-7.78 0-.6-.05-1.18-.16-1.72h-9.56z"
      />
    </svg>
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Create an account</CardTitle>
        <CardDescription>Enter your email and password to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="First Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Last Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
        </Form>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
           {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-4 w-4" />}
            Google
        </Button>
        <div className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
