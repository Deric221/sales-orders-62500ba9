-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  project_number TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold')),
  start_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add project_id to workflow_tracker to link orders to projects
ALTER TABLE public.workflow_tracker 
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects team can view all projects
CREATE POLICY "Projects team can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'projects'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'orders'::app_role)
);

-- Projects team can create projects
CREATE POLICY "Projects team can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'projects'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Projects team can update projects
CREATE POLICY "Projects team can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'projects'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create trigger for projects updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster project lookups
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_project_number ON public.projects(project_number);
CREATE INDEX idx_workflow_tracker_project_id ON public.workflow_tracker(project_id);