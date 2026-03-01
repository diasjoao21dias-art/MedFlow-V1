import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Types derived from schema
type LoginInput = z.infer<typeof api.auth.login.input>;

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const res = await fetch(api.auth.login.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid username or password");
        throw new Error("Login failed");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({
        title: "Welcome back",
        description: `Logged in as ${user.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, { 
        method: "POST",
        credentials: "include" 
      });
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear(); // Clear all data on logout
    },
  });

  const userValue = React.useMemo(() => user, [user]);
  const isLoadingValue = React.useMemo(() => isLoading, [isLoading]);
  const errorValue = React.useMemo(() => error, [error]);
  const loginFn = React.useCallback(loginMutation.mutate, [loginMutation.mutate]);
  const isLoggingInValue = React.useMemo(() => loginMutation.isPending, [loginMutation.isPending]);
  const logoutFn = React.useCallback(logoutMutation.mutate, [logoutMutation.mutate]);

  return React.useMemo(() => ({
    user: userValue,
    isLoading: isLoadingValue,
    error: errorValue,
    login: loginFn,
    isLoggingIn: isLoggingInValue,
    logout: logoutFn,
  }), [userValue, isLoadingValue, errorValue, loginFn, isLoggingInValue, logoutFn]);
}
