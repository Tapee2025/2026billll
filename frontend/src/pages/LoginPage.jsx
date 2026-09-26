import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Printer, LogIn } from "lucide-react";
import { login } from "@/lib/auth";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(username, password)) {
      setError("");
      onLogin();
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 paper-bg">
      <Card className="w-full max-w-sm" data-testid="login-card">
        <CardHeader className="items-center text-center">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center mb-2">
            <Printer className="w-5 h-5" />
          </div>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="login-form"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="login-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p
                className="text-sm text-destructive"
                data-testid="login-error"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              data-testid="login-submit"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
