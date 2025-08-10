"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { 
  OnboardingAnswers, 
  OnboardingFlow, 
  OnboardingService,
  ONBOARDING_QUESTIONS 
} from '@/lib/onboarding-schema';

interface OnboardingFormProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingForm({ onComplete, onSkip }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Get current step questions using step-based navigation
  const currentQuestions = OnboardingFlow.getQuestionsForStep(currentStep, answers);
  const totalSteps = OnboardingFlow.getTotalSteps(answers);
  const isComplete = currentStep >= totalSteps;

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleArrayAnswerChange = (questionId: keyof OnboardingAnswers, optionValue: string, checked: boolean) => {
    setAnswers(prev => {
      const currentArray = (prev as any)[questionId] as string[] || [];
      if (checked) {
        return { ...prev, [questionId]: [...currentArray, optionValue] };
      } else {
        return { ...prev, [questionId]: currentArray.filter(item => item !== optionValue) };
      }
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
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
      // Create complete user profile with scoring and personalized advice
      const completeAnswers = {
        ...answers,
        completedAt: new Date(),
        version: '1.0'
      } as OnboardingAnswers;

      const userProfile = OnboardingFlow.createUserProfile(completeAnswers);
      
      // Save to Firestore
      await OnboardingService.saveUserProfile(user.uid, userProfile);

      // Show personalized welcome message
      toast({
        title: 'Welcome to Trade Insights Pro!',
        description: userProfile.personalizedAdvice.welcomeMessage,
      });

      onComplete();
    } catch (error) {
      console.error('Error saving onboarding profile:', error);
      toast({
        title: "Error",
        description: "Failed to save your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question: any) => {
    const answerValue = (answers as any)[question.id];

    switch (question.type) {
      case 'radio':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">{question.question}</Label>
            <RadioGroup
              value={answerValue || ""}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
              className="space-y-2"
            >
              {question.options.map((option: any) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-4">
            <Label className="text-base font-medium">{question.question}</Label>
            <div className="grid grid-cols-1 gap-3">
              {question.options.map((option: any) => {
                const isChecked = (answerValue as string[] || []).includes(option.value);
                return (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.value}
                      checked={isChecked}
                      onCheckedChange={(checked) => 
                        handleArrayAnswerChange(question.id, option.value, !!checked)
                      }
                    />
                    <Label htmlFor={option.value} className="cursor-pointer text-sm">
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">{question.question}</Label>
            <Textarea
              value={answerValue || ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder={question.placeholder || ""}
              rows={4}
              className="resize-none"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Calculate current progress
  const getProgress = () => {
    return Math.min((currentStep + 1) / totalSteps * 100, 100);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 0: return "Basic Profile";
      case 1: 
        return answers.selfRatedSkill && ['intermediate', 'advanced', 'expert'].includes(answers.selfRatedSkill) 
          ? "Strategy & Knowledge" 
          : "Risk Management";
      case 2:
        return answers.selfRatedSkill && ['intermediate', 'advanced', 'expert'].includes(answers.selfRatedSkill)
          ? "Risk Management"
          : "Goals & Objectives";
      case 3: 
        return answers.selfRatedSkill && ['intermediate', 'advanced', 'expert'].includes(answers.selfRatedSkill)
          ? "Goals & Objectives"
          : "Current Challenges";
      case 4: return "Current Challenges";
      default: return "Complete";
    }
  };

  const canProceed = () => {
    if (currentQuestions.length === 0) return true; // All done
    
    // Check if required questions are answered
    return currentQuestions.every(q => {
      if (!q.required) return true;
      const answer = (answers as any)[q.id];
      if (q.type === 'checkbox') {
        return Array.isArray(answer) && answer.length > 0;
      }
      return answer !== undefined && answer !== '';
    });
  };

  const isLastStep = () => {
    return currentStep === totalSteps - 1;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
          <CardTitle>Options Trading Profile Setup</CardTitle>
          <CardDescription>
            Help us customize Trade Insights Pro for your trading style - we'll use this to personalize your experience
          </CardDescription>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{getStepTitle()}</span>
              <span>{Math.round(getProgress())}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!isComplete ? (
            <div className="space-y-6">
              {/* Render current step questions */}
              {currentQuestions.map((question) => (
                <div key={question.id}>
                  {renderQuestion(question)}
                </div>
              ))}

              {/* Navigation buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>

                {isLastStep() ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(totalSteps)}
                    disabled={!canProceed()}
                    className="flex items-center gap-2"
                  >
                    Review & Complete
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="flex items-center gap-2"
                  >
                    Next Step
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Final step - show summary and complete
            <div className="space-y-6 text-center">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Profile Complete!</h3>
                <p className="text-muted-foreground">
                  Based on your answers, we'll provide personalized insights and recommendations 
                  tailored to your trading style and goals.
                </p>
                
                {/* Show preview of their profile */}
                {(() => {
                  const preview = OnboardingFlow.createUserProfile(answers as OnboardingAnswers);
                  return (
                    <div className="bg-blue-50 p-4 rounded-lg text-left">
                      <h4 className="font-medium mb-2">Your Trading Profile:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Experience Level: <span className="font-medium capitalize">{preview.score.skillLevel}</span></li>
                        <li>• Learning Track: <span className="font-medium capitalize">{preview.score.learningTrack}</span></li>
                      </ul>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleSubmit} 
                  className="w-full" 
                  disabled={loading}
                  size="lg"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Setup & Connect Brokerage
                </Button>
                
                {onSkip && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={onSkip}
                    disabled={loading}
                  >
                    Skip Brokerage Connection
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}