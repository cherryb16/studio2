"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface OnboardingFormProps {
  onComplete: () => void;
}

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const [tradingExperience, setTradingExperience] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tradingExperience) {
      toast({
        title: "Please select your trading experience",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Update the user's trading experience in Firestore
      const response = await fetch('/api/firebase/updateTradingExperience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUserId: user.uid,
          tradingExperience,
        }),
      });

      if (response.ok) {
        toast({
          title: "Profile updated successfully!",
          description: "Now let's connect your brokerage account.",
        });
        onComplete();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating trading experience:', error);
      toast({
        title: "Error",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle>Welcome to AITrader!</CardTitle>
          <CardDescription>
            Let's set up your profile to get started with trading analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">
                What's your trading experience level?
              </Label>
              <RadioGroup
                value={tradingExperience}
                onValueChange={setTradingExperience}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="beginner" id="beginner" />
                  <Label htmlFor="beginner" className="cursor-pointer">
                    Beginner (0-1 years)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="intermediate" id="intermediate" />
                  <Label htmlFor="intermediate" className="cursor-pointer">
                    Intermediate (1-3 years)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="advanced" id="advanced" />
                  <Label htmlFor="advanced" className="cursor-pointer">
                    Advanced (3-5 years)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="expert" id="expert" />
                  <Label htmlFor="expert" className="cursor-pointer">
                    Expert (5+ years)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !tradingExperience}
            >
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Continue to Brokerage Connection
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}