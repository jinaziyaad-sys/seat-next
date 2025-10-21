import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Mail, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  created_at: string;
}

export const StaffManagement = ({ venueId }: { venueId: string }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [loading, setLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [fetchingStaff, setFetchingStaff] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStaffMembers();
  }, [venueId]);

  const fetchStaffMembers = async () => {
    setFetchingStaff(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select(`
        id,
        user_id,
        role,
        created_at
      `)
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    if (data && !error) {
      // Fetch email addresses for each user
      const staffWithEmails = await Promise.all(
        data.map(async (member) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", member.user_id)
            .single();
          
          return {
            ...member,
            email: profile?.email || "Unknown"
          };
        })
      );
      setStaffMembers(staffWithEmails);
    }
    setFetchingStaff(false);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Call the edge function to create staff account
      const { data, error } = await supabase.functions.invoke('create-merchant', {
        body: {
          email,
          password,
          venueId,
          role, // Pass the selected role
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        toast({
          title: "Success!",
          description: `Staff account created for ${email}`,
        });

        // Reset form
        setEmail("");
        setPassword("");
        setRole("staff");
        
        // Refresh staff list
        fetchStaffMembers();
      }
    } catch (error: any) {
      console.error('Error creating staff:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create staff account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (staffId: string, userEmail: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", staffId);

      if (error) throw error;

      toast({
        title: "Staff Removed",
        description: `${userEmail} has been removed from your venue`,
      });

      fetchStaffMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove staff member",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "staff":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Staff Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Staff Form */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              <CardTitle>Add New Staff</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a new staff account for your venue
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="staff@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Share this password securely with the staff member
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: "admin" | "staff") => setRole(value)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="admin">Admin - Full access</SelectItem>
                    <SelectItem value="staff">Staff - Limited access</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Admins can manage staff and settings, Staff can only manage orders and waitlist
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Create Staff Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Current Staff List */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Current Staff</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage your venue's staff members
            </p>
          </CardHeader>
          <CardContent>
            {fetchingStaff ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading staff...
              </div>
            ) : staffMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No staff members yet
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {staffMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(member.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {member.email} from your venue?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStaff(member.id, member.email || "this staff member")}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-semibold text-sm mb-2">Role Permissions:</h4>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p><strong>Admin:</strong> Full access to manage orders, waitlist, staff, and venue settings</p>
          <p><strong>Staff:</strong> Can manage orders and waitlist, but cannot add/remove staff or change settings</p>
        </div>
      </div>
    </div>
  );
};
