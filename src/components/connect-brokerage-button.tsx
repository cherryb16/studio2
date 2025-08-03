"use client";

import { useState, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export const ConnectBrokerageButton = forwardRef<HTMLButtonElement>((props, ref) => {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleClick = async () => {
    setLoading(true);
    setDisabled(true);
    
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated.",
        variant: "destructive",
      });
      setLoading(false);
      setDisabled(false);
      return;
    }
    
    try {
      console.log('Attempting to get SnapTrade login URL for user:', user.uid);
      const response = await fetch('/api/snaptrade/login-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseUserId: user.uid }),
      });
      
      console.log('API response status:', response.status);
      const result = await response.json();
      console.log('API response:', result);

      if (response.ok && result.redirectURI) {
        console.log('Redirecting to SnapTrade:', result.redirectURI);
        // Direct redirect - no iframe needed
        window.location.href = result.redirectURI;
      } else {
        console.error('API error:', result);
        toast({
          title: "Error",
          description: result.error || "Failed to create SnapTrade connect link.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Connect brokerage error:', error);
      toast({
        title: "Error",
        description: "Failed to connect to SnapTrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDisabled(false);
    }
  };

  return (
    <Button ref={ref} onClick={handleClick} disabled={disabled || !user}>
      {loading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      Connect Brokerage
    </Button>
  );
});

ConnectBrokerageButton.displayName = 'ConnectBrokerageButton';