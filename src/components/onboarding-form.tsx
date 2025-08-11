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
                
                {/* Show gamified profile with score and level */}
                {(() => {
                  const preview = OnboardingFlow.createUserProfile(answers as OnboardingAnswers);
                  const { score } = preview;
                  
                  // Calculate level progression
                  const maxScore = 35; // Rough estimate of max possible score
                  const progressPercent = Math.min((score.totalScore / maxScore) * 100, 100);
                  
                  // Level badge colors
                  const getLevelColor = (level: string) => {
                    switch(level) {
                      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
                      case 'intermediate': return 'bg-blue-100 text-blue-800 border-blue-200';
                      case 'advanced': return 'bg-purple-100 text-purple-800 border-purple-200';
                      default: return 'bg-gray-100 text-gray-800 border-gray-200';
                    }
                  };
                  
                  return (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg text-left border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">🎯 Your Trading Level</h4>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getLevelColor(score.skillLevel)}`}>
                          Level: {score.skillLevel.charAt(0).toUpperCase() + score.skillLevel.slice(1)}
                        </div>
                      </div>
                      
                      {/* Score Display */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Trading Score</span>
                          <span className="text-2xl font-bold text-indigo-600">{score.totalScore}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Complete trainings and connect more accounts to level up! 🚀
                        </p>
                      </div>

                      {/* Score Breakdown */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-white/50 rounded p-3">
                          <div className="text-lg font-semibold text-gray-800">{score.experienceScore}</div>
                          <div className="text-xs text-gray-600">Experience</div>
                        </div>
                        <div className="bg-white/50 rounded p-3">
                          <div className="text-lg font-semibold text-gray-800">{score.riskManagementScore}</div>
                          <div className="text-xs text-gray-600">Risk Mgmt</div>
                        </div>
                        <div className="bg-white/50 rounded p-3">
                          <div className="text-lg font-semibold text-gray-800">{score.strategyDepthScore}</div>
                          <div className="text-xs text-gray-600">Strategy</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Learning Track:</span> {score.learningTrack.charAt(0).toUpperCase() + score.learningTrack.slice(1)}
                        </p>
                      </div>
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