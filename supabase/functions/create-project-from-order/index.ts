import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createProjectSchema = z.object({
  customerName: z.string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(200, 'Customer name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-.,'"&()]+$/, 'Customer name contains invalid characters'),
  quoteNumber: z.string()
    .trim()
    .min(3, 'Quote number must be at least 3 characters')
    .max(50, 'Quote number must be less than 50 characters')
    .regex(/^[A-Z0-9\-]+$/i, 'Quote number contains invalid characters'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated and has orders or admin role
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has orders or admin role
    const { data: userRole, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('department_role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: User role not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userRole.department_role !== 'orders' && userRole.department_role !== 'admin') {
      console.error('Insufficient permissions:', userRole.department_role);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = createProjectSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { customerName, quoteNumber } = validationResult.data;

    // Generate project number
    const { data: existingProjects, error: countError } = await supabaseClient
      .from('projects')
      .select('project_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (countError) {
      console.error('Error fetching project count:', countError);
      throw countError;
    }

    let nextNumber = 1;
    if (existingProjects && existingProjects.length > 0) {
      const lastNumber = existingProjects[0].project_number.split('-')[1];
      nextNumber = parseInt(lastNumber) + 1;
    }
    
    const projectNumber = `PRJ-${String(nextNumber).padStart(4, '0')}`;
    const projectName = `${customerName} - ${quoteNumber}`;

    // Create project using service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: project, error: insertError } = await supabaseAdmin
      .from('projects')
      .insert({
        project_name: projectName,
        description: `Project for order ${quoteNumber}`,
        status: 'pending',
        created_by: user.id,
        project_number: projectNumber,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating project:', insertError);
      throw insertError;
    }

    console.log('Project created successfully:', project.id);

    // Log the action
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'CREATE',
        table_name: 'projects',
        record_id: project.id,
        new_data: project,
      });

    return new Response(
      JSON.stringify({ project }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-project-from-order:', error);
    
    let userMessage = 'Failed to create project';
    let statusCode = 500;
    
    if (error instanceof z.ZodError) {
      userMessage = 'Invalid input data';
      statusCode = 400;
    } else if (error instanceof Error) {
      if (error.message?.includes('Unauthorized') || error.message?.includes('JWT')) {
        userMessage = 'Unauthorized';
        statusCode = 401;
      } else if (error.message?.includes('Forbidden')) {
        userMessage = 'Forbidden: Insufficient permissions';
        statusCode = 403;
      } else if (error.message?.includes('not found')) {
        userMessage = 'Resource not found';
        statusCode = 404;
      }
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
