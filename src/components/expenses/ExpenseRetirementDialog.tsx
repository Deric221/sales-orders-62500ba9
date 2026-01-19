import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface ExpenseRetirementDialogProps {
  ticketId: string;
  onClose: () => void;
}

const ExpenseRetirementDialog = ({ ticketId, onClose }: ExpenseRetirementDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user!.id}/${ticketId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("expense-retirements")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create retirement record
      const { error: dbError } = await supabase.from("expense_retirements").insert({
        expense_ticket_id: ticketId,
        file_name: file.name,
        file_path: fileName,
        uploaded_by: user!.id,
        notes,
      });

      if (dbError) throw dbError;

      // Update ticket status to retired
      const { error: updateError } = await supabase
        .from("expense_tickets")
        .update({ status: "retired" })
        .eq("id", ticketId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Retirement document uploaded successfully",
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Retirement Document</DialogTitle>
          <DialogDescription>
            Upload proof of payment or retirement document for this expense ticket
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Select Document (PDF, Image)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={uploading || !file} className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={uploading} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseRetirementDialog;
