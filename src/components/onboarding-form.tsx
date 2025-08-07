"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface OnboardingFormProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingForm({ onComplete, onSkip }: OnboardingFormProps) {
  const [tradingExperience, setTradingExperience] = useState<string>("");
  const [tradeTypes, setTradeTypes] = useState<string[]>([]);
  const [tradingDurations, setTradingDurations] = useState<Record<string, string>>({});
  const [startMonth, setStartMonth] = useState<string>("");
  const [startYear, setStartYear] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const tradeTypeOptions = [
    { id: 'stocks', label: 'Stocks/Equities' },
    { id: 'options', label: 'Options' },
    { id: 'forex', label: 'Forex/FX' },
    { id: 'crypto', label: 'Cryptocurrency' },
    { id: 'futures', label: 'Futures' },
    { id: 'etfs', label: 'ETFs' },
    { id: 'bonds', label: 'Bonds' },
    { id: 'commodities', label: 'Commodities' }
  ];

  const durationOptions = [
    { value: 'less-than-6m', label: 'Less than 6 months' },
    { value: '6m-1y', label: '6 months - 1 year' },
    { value: '1-2y', label: '1-2 years' },
    { value: '2-3y', label: '2-3 years' },
    { value: '3-5y', label: '3-5 years' },
    { value: 'more-than-5y', label: 'More than 5 years' }
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

  const handleTradeTypeChange = (tradeType: string, checked: boolean) => {
    if (checked) {
      setTradeTypes(prev => [...prev, tradeType]);
    } else {
      setTradeTypes(prev => prev.filter(type => type !== tradeType));
      setTradingDurations(prev => {
        const newDurations = { ...prev };
        delete newDurations[tradeType];
        return newDurations;
      });
    }
  };

  const handleDurationChange = (tradeType: string, duration: string) => {
    setTradingDurations(prev => ({
      ...prev,
      [tradeType]: duration
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tradingExperience) {
      toast({
        title: "Please select your overall trading experience",
        variant: "destructive",
      });
      return;
    }

    if (tradeTypes.length === 0) {
      toast({
        title: "Please select at least one type of trading",
        variant: "destructive",
      });
      return;
    }

    // Check if all selected trade types have duration specified
    for (const tradeType of tradeTypes) {
      if (!tradingDurations[tradeType]) {
        toast({
          title: "Please specify duration for all selected trade types",
          variant: "destructive",
        });
        return;
      }
    }

    if (!startMonth || !startYear) {
      toast({
        title: "Please specify when you started trading",
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
      // Update the user's comprehensive profile in Firestore
      const response = await fetch('/api/firebase/updateUserProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUserId: user.uid,
          tradingExperience,
          tradeTypes,
          tradingDurations,
          startMonth,
          startYear,
          tradingStartDate: `${startMonth} ${startYear}`
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
      console.error('Error updating user profile:', error);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center relative">
          {onSkip && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onClick={onSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <CardTitle>Welcome to Trade Insights Pro!</CardTitle>
          <CardDescription>
            Let's set up your profile to provide personalized trading analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Overall Experience Level */}
            <div className="space-y-3">
              <Label className="text-base font-medium">
                What's your overall trading experience level?
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

            {/* Trade Types */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                What types of trading do you do? (Select all that apply)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {tradeTypeOptions.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.id}
                      checked={tradeTypes.includes(option.id)}
                      onCheckedChange={(checked) => handleTradeTypeChange(option.id, !!checked)}
                    />
                    <Label htmlFor={option.id} className="cursor-pointer text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Duration for each trade type */}
            {tradeTypes.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  How long have you been trading each type?
                </Label>
                <div className="space-y-3">
                  {tradeTypes.map((tradeType) => {
                    const tradeTypeLabel = tradeTypeOptions.find(opt => opt.id === tradeType)?.label;
                    return (
                      <div key={tradeType} className="flex items-center justify-between gap-4">
                        <Label className="text-sm min-w-0 flex-shrink-0">
                          {tradeTypeLabel}:
                        </Label>
                        <div className="flex-1 max-w-xs">
                          <Select
                            value={tradingDurations[tradeType] || ""}
                            onValueChange={(value) => handleDurationChange(tradeType, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              {durationOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Start Date */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                When did you start trading?
              </Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="start-month" className="text-sm text-muted-foreground">
                    Month
                  </Label>
                  <Select value={startMonth} onValueChange={setStartMonth}>
                    <SelectTrigger id="start-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="start-year" className="text-sm text-muted-foreground">
                    Year
                  </Label>
                  <Select value={startYear} onValueChange={setStartYear}>
                    <SelectTrigger id="start-year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !tradingExperience || tradeTypes.length === 0}
              >
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Continue to Brokerage Connection
              </Button>
              
              {onSkip && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={onSkip}
                  disabled={loading}
                >
                  Connect Brokerage Later
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}