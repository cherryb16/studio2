"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ConnectBrokerageButton() {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setLoading(true);
    setDisabled(true);
    try {
      const response = await fetch("/api/snaptrade/create-connect-link");
      const data = await response.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast({
          title: "Error",
          description: "Failed to create SnapTrade connect link.",
          variant: "destructive",
        });
        setLoading(false);
        setDisabled(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to SnapTrade. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      setDisabled(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={disabled}>
      Connect Brokerage
    </Button>
  );
}
