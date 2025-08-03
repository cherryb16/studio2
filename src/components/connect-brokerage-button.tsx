"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function ConnectBrokerageButton() {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [credentials, setCredentials] = useState<{snaptradeUserId: string; userSecret: string} | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch credentials when user changes
  useEffect(() => {
    const fetchCredentials = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
        if (response.ok) {
          const creds = await response.json();
          setCredentials(creds);
        }
      } catch (error) {
        console.error('Error fetching credentials:', error);
      }
    };

    fetchCredentials();
  }, [user]);

  const handleClick = async () => {
    setLoading(true);
    setDisabled(true);
    
    if (!user || !credentials) {
      toast({
        title: "Error",
        description: "User not authenticated or credentials not found.",
        variant: "destructive",
      });
      setLoading(false);
      setDisabled(false);
      return;
    }
    
    try {
      const response = await fetch('/api/snaptrade/login-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseUserId: user.uid }),
      });
      const result = await response.json();

      if (response.ok && result.redirectURI) {
        window.location.href = result.redirectURI;
      } else {
        toast({
          title: "Error",
          description: "Failed to create SnapTrade connect link.",
          variant: "destructive",
        });
      }
    } catch (error) {
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
    <Button onClick={handleClick} disabled={disabled || !user || !credentials}>
      {loading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      Connect Brokerage
    </Button>
  );
}