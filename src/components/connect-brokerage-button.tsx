"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getSnapTradeLoginUrl } from "@/app/actions/snaptrade-enhanced"; // Import the server action
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth'; // Import useAuth

export function ConnectBrokerageButton() {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth(); // Get the user from useAuth

  const handleClick = async () => {
    setLoading(true);
    setDisabled(true);
    if (!user) { // Add a check if user is null
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
      // Call the server action with user.uid
      const result = await getSnapTradeLoginUrl(user.uid);

      if (result.data?.redirectUrl) {
        window.location.href = result.data.redirectUrl;
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create SnapTrade connect link.",
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
    <Button onClick={handleClick} disabled={disabled || !user}>
      {loading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      Connect Brokerage
    </Button>
  );
}
