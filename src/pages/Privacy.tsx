import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ReadyUp Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <h2 className="text-lg font-semibold">1. Introduction</h2>
          <p>
            ReadyUp ("we", "our", "us") is committed to protecting your personal information in accordance with the 
            Protection of Personal Information Act (POPIA) of South Africa. This policy explains how we collect, 
            use, store, and protect your data.
          </p>

          <h2 className="text-lg font-semibold">2. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> Name, email address, phone number</li>
            <li><strong>Usage data:</strong> Order history, waitlist entries, dining preferences</li>
            <li><strong>Device data:</strong> Browser type, device info (for error reporting only)</li>
            <li><strong>Location data:</strong> Only when you explicitly use venue discovery features</li>
          </ul>

          <h2 className="text-lg font-semibold">3. Purpose of Processing</h2>
          <p>We process your personal information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Manage your waitlist and food order notifications</li>
            <li>Provide personalised dining recommendations</li>
            <li>Manage loyalty programs and rewards</li>
            <li>Send you relevant notifications (with your consent)</li>
            <li>Improve our services through analytics</li>
          </ul>

          <h2 className="text-lg font-semibold">4. Your Rights Under POPIA</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate personal data</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data</li>
            <li><strong>Object:</strong> Object to the processing of your personal data</li>
            <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
          </ul>
          <p>
            You can exercise these rights from your <strong>Profile → Data &amp; Privacy</strong> section, 
            or by contacting us directly.
          </p>

          <h2 className="text-lg font-semibold">5. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to provide services. 
            Upon account deletion request, your data will be removed within 30 days, except where retention 
            is required by law.
          </p>

          <h2 className="text-lg font-semibold">6. Data Security</h2>
          <p>
            We employ industry-standard security measures including encryption in transit (TLS), 
            row-level security policies, and secure authentication through Supabase.
          </p>

          <h2 className="text-lg font-semibold">7. Third-Party Sharing</h2>
          <p>
            We do not sell your personal data. We share data only with venue partners 
            (for order/waitlist management) and essential service providers (Supabase for hosting).
          </p>

          <h2 className="text-lg font-semibold">8. Cookies and Local Storage</h2>
          <p>
            We use local storage for authentication tokens, theme preferences, and app state. 
            No third-party tracking cookies are used.
          </p>

          <h2 className="text-lg font-semibold">9. Information Officer</h2>
          <p>
            For any privacy-related queries, data requests, or complaints, please use the 
            "Request Data Export" or "Request Account Deletion" features in your profile settings.
          </p>

          <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of significant changes 
            through the app or via email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
