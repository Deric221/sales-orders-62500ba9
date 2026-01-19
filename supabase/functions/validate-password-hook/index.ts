import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface PasswordValidationRequest {
  user_id: string;
  email: string;
  password?: string;
}

serve(async (req) => {
  try {
    const payload: PasswordValidationRequest = await req.json();
    
    // Only validate on signup when password is provided
    if (!payload.password) {
      return new Response(
        JSON.stringify({ 
          decision: "continue"
        }),
        { 
          headers: { "Content-Type": "application/json" },
          status: 200 
        }
      );
    }

    const password = payload.password;
    
    // Server-side password complexity validation
    const errors: string[] = [];
    
    if (password.length < 12) {
      errors.push("Password must be at least 12 characters long");
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    // Reject if validation fails
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          decision: "reject",
          message: errors.join(". ")
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Allow signup if password meets requirements
    return new Response(
      JSON.stringify({
        decision: "continue"
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    console.error("Password validation error:", error);
    
    // On error, reject to be safe
    return new Response(
      JSON.stringify({
        decision: "reject",
        message: "Password validation failed. Please try again."
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
  }
});
